import * as THREE from "three"
import {
  World,
  RigidBody,
  Collider,
  RigidBodyDesc,
  ColliderDesc,
  EventQueue,
  ActiveEvents,
} from "@dimforge/rapier3d"

/**
 * Three.js physics system using Rapier
 * Much simpler than Babylon.js Havok integration
 */
export class PhysicsSystem {
  private static world: World | null = null
  private static isInitialized: boolean = false
  private static rigidBodies: Map<string, RigidBody> = new Map()
  private static colliders: Map<string, Collider> = new Map()
  private static stepCount: number = 0 // Debug step counter

  // Fixed-step integration
  private static fixedTimeStep: number = 1 / 120 // 120 Hz physics for smoother motion
  private static maxSubSteps: number = 8 // Prevent spiral of death
  private static accumulator: number = 0
  private static alpha: number = 0 // Interpolation alpha (0..1)

  /**
   * Configure physics stepping parameters at runtime
   */
  public static configure(
    params: { fixedTimeStep?: number; maxSubSteps?: number } = {},
  ): void {
    if (typeof params.fixedTimeStep === "number" && params.fixedTimeStep > 0) {
      PhysicsSystem.fixedTimeStep = params.fixedTimeStep
    }
    if (typeof params.maxSubSteps === "number" && params.maxSubSteps >= 1) {
      PhysicsSystem.maxSubSteps = params.maxSubSteps
    }
  }

  /**
   * Get interpolation alpha for rendering (accumulator / fixedTimeStep)
   */
  public static getInterpolationAlpha(): number {
    return PhysicsSystem.alpha
  }

  // Proper Rapier collision event system
  private static eventQueue: EventQueue | null = null
  private static colliderHandleToComponent: Map<number, any> = new Map() // Maps collider handle to component
  private static colliderHandleToId: Map<number, string> = new Map() // Maps collider handle to ID
  private static colliderIdToGameObject: Map<string, any> = new Map() // Maps collider ID to GameObject (for all colliders)

  // Debug visualization
  private static debugEnabled: boolean = false
  private static debugScene: THREE.Scene | null = null
  private static debugMeshes: Map<string, THREE.Mesh> = new Map()
  private static debugMaterial: THREE.Material | null = null

  /**
   * Initialize Rapier physics world
   */
  public static async initialize(): Promise<void> {
    if (PhysicsSystem.isInitialized) {
      return
    }

    try {
      // Import Rapier
      const RAPIER = await import("@dimforge/rapier3d")

      // Create physics world with gravity
      const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0)
      PhysicsSystem.world = new RAPIER.World(gravity)

      // Create event queue for collision events
      PhysicsSystem.eventQueue = new RAPIER.EventQueue(true)

      PhysicsSystem.isInitialized = true
    } catch (error) {
      console.error("❌ Failed to initialize PhysicsSystem:", error)
    }
  }

  /**
   * Get the physics world
   */
  public static getWorld(): World | null {
    return PhysicsSystem.world
  }

  /**
   * Check if physics is initialized
   */
  public static isReady(): boolean {
    return PhysicsSystem.isInitialized && PhysicsSystem.world !== null
  }

  /**
   * Step the physics simulation
   */
  public static step(deltaTime: number): void {
    if (!PhysicsSystem.world) {
      console.warn("⚠️ Physics step called but world not initialized")
      return
    }

    // Accumulate time and step in fixed increments
    PhysicsSystem.accumulator += deltaTime
    const h = PhysicsSystem.fixedTimeStep
    const maxTime = PhysicsSystem.maxSubSteps * h
    if (PhysicsSystem.accumulator > maxTime) {
      // Clamp to avoid excessive catch-up work on long frames
      PhysicsSystem.accumulator = maxTime
    }

    let numSteps = 0
    while (PhysicsSystem.accumulator >= h) {
      // Increment step counter
      PhysicsSystem.stepCount++

      // Use fixed timestep for deterministic simulation
      ;(PhysicsSystem.world as any).timestep = h
      if (PhysicsSystem.eventQueue) {
        PhysicsSystem.world.step(PhysicsSystem.eventQueue)
        PhysicsSystem.processCollisionEvents()
      } else {
        PhysicsSystem.world.step()
      }

      PhysicsSystem.accumulator -= h
      numSteps++
    }

    // Store interpolation alpha for optional render smoothing
    PhysicsSystem.alpha = PhysicsSystem.accumulator / h

    // Update debug mesh positions
    PhysicsSystem.updateDebugMeshes()
  }

  /**
   * Create a rigid body
   */
  public static createRigidBody(
    id: string,
    rigidBodyDesc: RigidBodyDesc,
    colliderDesc?: ColliderDesc,
  ): { rigidBody: RigidBody; collider?: Collider } | null {
    if (!PhysicsSystem.world) return null

    // Create rigid body
    const rigidBody = PhysicsSystem.world.createRigidBody(rigidBodyDesc)
    PhysicsSystem.rigidBodies.set(id, rigidBody)

    let collider: Collider | undefined
    if (colliderDesc) {
      collider = PhysicsSystem.world.createCollider(colliderDesc, rigidBody)
      PhysicsSystem.colliders.set(id, collider)

      // Create debug mesh for this collider
      PhysicsSystem.addDebugMesh(id)
    }

    return { rigidBody, collider }
  }

  /**
   * Register a GameObject with its collider ID (called by RigidBodyComponentThree for all colliders)
   */
  public static registerGameObject(colliderId: string, gameObject: any): void {
    PhysicsSystem.colliderIdToGameObject.set(colliderId, gameObject)

    // Enable collision events for all colliders so they can participate in sensor collisions
    const collider = PhysicsSystem.colliders.get(colliderId)
    if (collider) {
      const handle = collider.handle
      // Map handle to ID for collision event processing
      PhysicsSystem.colliderHandleToId.set(handle, colliderId)
      // Enable collision events so this collider can collide with sensors
      collider.setActiveEvents(ActiveEvents.COLLISION_EVENTS)
    }
  }

  /**
   * Unregister a GameObject from collider mapping
   */
  public static unregisterGameObject(colliderId: string): void {
    PhysicsSystem.colliderIdToGameObject.delete(colliderId)

    // Also remove handle mapping if it exists
    const collider = PhysicsSystem.colliders.get(colliderId)
    if (collider) {
      const handle = collider.handle
      PhysicsSystem.colliderHandleToId.delete(handle)
    }
  }

  /**
   * Register a component for trigger events
   */
  public static registerTriggerComponent(
    colliderId: string,
    component: any,
  ): void {
    // Find the collider by ID and get its handle
    const collider = PhysicsSystem.colliders.get(colliderId)
    if (collider) {
      const handle = collider.handle
      // Register the component to receive trigger callbacks
      PhysicsSystem.colliderHandleToComponent.set(handle, component)
      // Handle-to-ID mapping should already be set by registerGameObject
    } else {
      console.error(
        `🔥 PhysicsSystem: Could not find collider with ID ${colliderId}`,
      )
      console.log(
        `🔍 Available collider IDs: ${Array.from(PhysicsSystem.colliders.keys()).join(", ")}`,
      )
    }
  }

  /**
   * Unregister a component from trigger events
   */
  public static unregisterTriggerComponent(colliderId: string): void {
    const collider = PhysicsSystem.colliders.get(colliderId)
    if (collider) {
      const handle = collider.handle
      // Only remove the component mapping - handle-to-ID mapping stays for GameObject lookup
      PhysicsSystem.colliderHandleToComponent.delete(handle)
    }
  }

  /**
   * Process collision events from the event queue
   */
  private static processCollisionEvents(): void {
    if (!PhysicsSystem.eventQueue) return

    let eventCount = 0

    // Drain collision events from the event queue
    PhysicsSystem.eventQueue.drainCollisionEvents(
      (handle1, handle2, started) => {
        eventCount++

        // Get components for both colliders
        const component1 = PhysicsSystem.colliderHandleToComponent.get(handle1)
        const component2 = PhysicsSystem.colliderHandleToComponent.get(handle2)
        const id1 = PhysicsSystem.colliderHandleToId.get(handle1)
        const id2 = PhysicsSystem.colliderHandleToId.get(handle2)

        // Debug: log all collision events to see what's happening
        const gameObject1 = PhysicsSystem.colliderIdToGameObject.get(id1 || "")
        const gameObject2 = PhysicsSystem.colliderIdToGameObject.get(id2 || "")
        // Collision detected: ${gameObject1?.name || id1} <-> ${gameObject2?.name || id2}

        // Components identified

        // Get colliders to check which is sensor
        const collider1 = PhysicsSystem.colliders.get(id1 || "")
        const collider2 = PhysicsSystem.colliders.get(id2 || "")

        if (!collider1 || !collider2) {
          return // Missing colliders
        }

        const collider1IsSensor = collider1.isSensor()
        const collider2IsSensor = collider2.isSensor()

        // Sensor types determined

        // If collider1 is sensor, notify its component about collider2
        if (
          collider1IsSensor &&
          component1 &&
          component1.onTriggerEnter &&
          component1.onTriggerExit
        ) {
          // Find GameObject for collider2 (may or may not have a registered component)
          const gameObject2 =
            component2?.gameObject ||
            PhysicsSystem.colliderIdToGameObject.get(id2 || "")
          if (gameObject2) {
            if (started) {
              component1.onTriggerEnter(gameObject2)
            } else {
              component1.onTriggerExit(gameObject2)
            }
          }
        }

        // If collider2 is sensor, notify its component about collider1
        if (
          collider2IsSensor &&
          component2 &&
          component2.onTriggerEnter &&
          component2.onTriggerExit
        ) {
          // Find GameObject for collider1 (may or may not have a registered component)
          const gameObject1 =
            component1?.gameObject ||
            PhysicsSystem.colliderIdToGameObject.get(id1 || "")
          if (gameObject1) {
            // console.log(`🔥 PhysicsSystem: Calling trigger on component2 (${component2.constructor?.name}) for gameObject: ${gameObject1.name}`); // Reduced spam
            if (started) {
              component2.onTriggerEnter(gameObject1)
            } else {
              component2.onTriggerExit(gameObject1)
            }
          }
        }
      },
    )

    // Events processed silently
  }

  /**
   * Remove a rigid body
   */
  public static removeRigidBody(id: string): void {
    if (!PhysicsSystem.world) return

    // Remove debug mesh first
    PhysicsSystem.removeDebugMesh(id)

    const rigidBody = PhysicsSystem.rigidBodies.get(id)
    if (rigidBody) {
      PhysicsSystem.world.removeRigidBody(rigidBody)
      PhysicsSystem.rigidBodies.delete(id)
    }

    const collider = PhysicsSystem.colliders.get(id)
    if (collider) {
      PhysicsSystem.world.removeCollider(collider, true)
      PhysicsSystem.colliders.delete(id)
    }
  }

  /**
   * Get rigid body by ID
   */
  public static getRigidBody(id: string): RigidBody | null {
    return PhysicsSystem.rigidBodies.get(id) || null
  }

  /**
   * Get collider by ID
   */
  public static getCollider(id: string): Collider | null {
    return PhysicsSystem.colliders.get(id) || null
  }

  /**
   * Sync Three.js object position with physics body
   */
  public static syncObjectToPhysics(
    object: THREE.Object3D,
    rigidBody: RigidBody,
  ): void {
    const translation = rigidBody.translation()
    const rotation = rigidBody.rotation()

    // Update Three.js object position
    object.position.set(translation.x, translation.y, translation.z)
    object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  /**
   * Sync physics body position to Three.js object
   */
  public static syncPhysicsToObject(
    rigidBody: RigidBody,
    object: THREE.Object3D,
  ): void {
    const position = object.position
    const quaternion = object.quaternion

    // Update physics body position
    rigidBody.setTranslation(
      { x: position.x, y: position.y, z: position.z },
      true,
    )
    rigidBody.setRotation(
      {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w,
      },
      true,
    )
  }

  /**
   * Create a ground plane
   */
  public static createGround(
    size: number = 50,
  ): { rigidBody: RigidBody; collider: Collider } | null {
    if (!PhysicsSystem.world) return null

    // Create ground rigid body descriptor
    const groundBodyDesc = RigidBodyDesc.fixed().setTranslation(0, 0, 0)

    // Create ground collider descriptor
    const groundColliderDesc = ColliderDesc.cuboid(size / 2, 0.1, size / 2)

    const result = PhysicsSystem.createRigidBody(
      "ground",
      groundBodyDesc,
      groundColliderDesc,
    )
    return result
      ? { rigidBody: result.rigidBody, collider: result.collider! }
      : null
  }

  /**
   * Create a box collider
   */
  public static createBox(
    id: string,
    position: THREE.Vector3,
    size: THREE.Vector3,
    isDynamic: boolean = true,
  ): { rigidBody: RigidBody; collider: Collider } | null {
    if (!PhysicsSystem.world) return null

    // Create rigid body descriptor
    const bodyDesc = isDynamic ? RigidBodyDesc.dynamic() : RigidBodyDesc.fixed()

    bodyDesc.setTranslation(position.x, position.y, position.z)

    // Create collider descriptor
    const colliderDesc = ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)

    const result = PhysicsSystem.createRigidBody(id, bodyDesc, colliderDesc)
    return result
      ? { rigidBody: result.rigidBody, collider: result.collider! }
      : null
  }

  /**
   * Create a sphere collider
   */
  public static createSphere(
    id: string,
    position: THREE.Vector3,
    radius: number,
    isDynamic: boolean = true,
  ): { rigidBody: RigidBody; collider: Collider } | null {
    if (!PhysicsSystem.world) return null

    // Create rigid body descriptor
    const bodyDesc = isDynamic ? RigidBodyDesc.dynamic() : RigidBodyDesc.fixed()

    bodyDesc.setTranslation(position.x, position.y, position.z)

    // Create collider descriptor
    const colliderDesc = ColliderDesc.ball(radius)

    const result = PhysicsSystem.createRigidBody(id, bodyDesc, colliderDesc)
    return result
      ? { rigidBody: result.rigidBody, collider: result.collider! }
      : null
  }

  /**
   * Initialize debug visualization
   */
  public static initializeDebug(scene: THREE.Scene): void {
    PhysicsSystem.debugScene = scene

    // Create debug material - semi-transparent wireframe that ignores depth
    PhysicsSystem.debugMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      depthTest: false, // Always render on top, ignores depth
      depthWrite: false, // Don't write to depth buffer
    })
  }

  /**
   * Toggle physics debug visualization
   */
  public static setDebugEnabled(enabled: boolean): void {
    PhysicsSystem.debugEnabled = enabled

    if (enabled) {
      PhysicsSystem.showAllDebugMeshes()
    } else {
      PhysicsSystem.hideAllDebugMeshes()
    }
  }

  /**
   * Get debug enabled state
   */
  public static isDebugEnabled(): boolean {
    return PhysicsSystem.debugEnabled
  }

  /**
   * Create debug mesh for a collider
   */
  private static createDebugMesh(
    id: string,
    collider: Collider,
  ): THREE.Mesh | null {
    if (!PhysicsSystem.debugMaterial || !PhysicsSystem.debugScene) return null

    const shape = collider.shape
    let geometry: THREE.BufferGeometry | null = null

    // Create geometry based on collider shape type
    switch (shape.type) {
      case 0: // Ball/Sphere
        const radius = (shape as any).radius
        geometry = new THREE.SphereGeometry(radius, 16, 12)
        break

      case 1: // Cuboid/Box
        const halfExtents = (shape as any).halfExtents
        geometry = new THREE.BoxGeometry(
          halfExtents.x * 2,
          halfExtents.y * 2,
          halfExtents.z * 2,
        )
        break

      case 2: // Capsule
        const capsuleRadius = (shape as any).radius
        const capsuleHalfHeight = (shape as any).halfHeight
        // Create capsule as cylinder + two spheres
        const capsuleGeometry = new THREE.CapsuleGeometry(
          capsuleRadius,
          capsuleHalfHeight * 2,
          8,
          16,
        )
        geometry = capsuleGeometry
        break

      default:
        // For other shapes, create a simple box as fallback
        geometry = new THREE.BoxGeometry(1, 1, 1)
        console.warn(
          `⚠️ Unsupported collider shape type: ${shape.type}, using box fallback`,
        )
        break
    }

    if (!geometry) return null

    // Create debug mesh
    const debugMesh = new THREE.Mesh(geometry, PhysicsSystem.debugMaterial)
    debugMesh.name = `debug_${id}`

    // Position the debug mesh
    const rigidBody = PhysicsSystem.rigidBodies.get(id)
    if (rigidBody) {
      PhysicsSystem.syncObjectToPhysics(debugMesh, rigidBody)
    }

    return debugMesh
  }

  /**
   * Add debug mesh for a physics body
   */
  private static addDebugMesh(id: string): void {
    if (!PhysicsSystem.debugScene || PhysicsSystem.debugMeshes.has(id)) return

    const collider = PhysicsSystem.colliders.get(id)
    if (!collider) return

    const debugMesh = PhysicsSystem.createDebugMesh(id, collider)
    if (debugMesh) {
      PhysicsSystem.debugMeshes.set(id, debugMesh)

      if (PhysicsSystem.debugEnabled) {
        PhysicsSystem.debugScene.add(debugMesh)
      }
    }
  }

  /**
   * Remove debug mesh for a physics body
   */
  private static removeDebugMesh(id: string): void {
    const debugMesh = PhysicsSystem.debugMeshes.get(id)
    if (debugMesh) {
      if (PhysicsSystem.debugScene) {
        PhysicsSystem.debugScene.remove(debugMesh)
      }
      debugMesh.geometry.dispose()
      PhysicsSystem.debugMeshes.delete(id)
    }
  }

  /**
   * Show all debug meshes
   */
  private static showAllDebugMeshes(): void {
    if (!PhysicsSystem.debugScene) return

    PhysicsSystem.debugMeshes.forEach((mesh) => {
      PhysicsSystem.debugScene!.add(mesh)
    })
  }

  /**
   * Hide all debug meshes
   */
  private static hideAllDebugMeshes(): void {
    if (!PhysicsSystem.debugScene) return

    PhysicsSystem.debugMeshes.forEach((mesh) => {
      PhysicsSystem.debugScene!.remove(mesh)
    })
  }

  /**
   * Update debug mesh positions to match physics bodies
   */
  public static updateDebugMeshes(): void {
    if (!PhysicsSystem.debugEnabled || !PhysicsSystem.debugScene) return

    PhysicsSystem.debugMeshes.forEach((mesh, id) => {
      const rigidBody = PhysicsSystem.rigidBodies.get(id)
      if (rigidBody) {
        // Check if rigid body is enabled and show/hide debug mesh accordingly
        const isEnabled = rigidBody.isEnabled()

        if (isEnabled) {
          // Update position and show mesh if not already in scene
          PhysicsSystem.syncObjectToPhysics(mesh, rigidBody)
          if (!PhysicsSystem.debugScene!.children.includes(mesh)) {
            PhysicsSystem.debugScene!.add(mesh)
          }
        } else {
          // Hide mesh if rigid body is disabled
          if (PhysicsSystem.debugScene!.children.includes(mesh)) {
            PhysicsSystem.debugScene!.remove(mesh)
          }
        }
      }
    })
  }

  /**
   * Dispose of physics system
   */
  public static dispose(): void {
    // Clean up debug meshes
    PhysicsSystem.debugMeshes.forEach((mesh) => {
      if (PhysicsSystem.debugScene) {
        PhysicsSystem.debugScene.remove(mesh)
      }
      mesh.geometry.dispose()
    })
    PhysicsSystem.debugMeshes.clear()

    if (PhysicsSystem.debugMaterial) {
      PhysicsSystem.debugMaterial.dispose()
      PhysicsSystem.debugMaterial = null
    }

    PhysicsSystem.debugScene = null
    PhysicsSystem.debugEnabled = false

    if (PhysicsSystem.world) {
      PhysicsSystem.world.free()
      PhysicsSystem.world = null
    }

    if (PhysicsSystem.eventQueue) {
      PhysicsSystem.eventQueue.free()
      PhysicsSystem.eventQueue = null
    }

    PhysicsSystem.rigidBodies.clear()
    PhysicsSystem.colliders.clear()
    PhysicsSystem.colliderHandleToComponent.clear()
    PhysicsSystem.colliderHandleToId.clear()
    PhysicsSystem.isInitialized = false

    console.log("🎯 PhysicsSystem disposed")
  }
}
