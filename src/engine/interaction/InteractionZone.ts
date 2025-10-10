import * as THREE from "three"
import { Component, GameObject } from "@engine/core"
import {
  RigidBodyComponentThree,
  RigidBodyType,
  ColliderShape,
} from "@systems/physics/RigidBodyComponentThree.ts"

/**
 * Simple interaction zone using Rapier physics triggers
 * Replaces the complex raycasting system with simple physics triggers
 */
export class InteractionZone extends Component {
  public readonly id: string

  private active: boolean = true
  private onEnterCallback?: (other: GameObject) => void
  private onExitCallback?: (other: GameObject) => void
  private entitiesInZone: Set<GameObject> = new Set()

  private rigidBody: RigidBodyComponentThree | null = null
  private visualMesh: THREE.Mesh | null = null
  private options: InteractionZoneOptions

  constructor(
    onEnter?: (other: GameObject) => void,
    onExit?: (other: GameObject) => void,
    options: InteractionZoneOptions = {},
  ) {
    super()
    this.id = `interaction_${Math.random().toString(36).substr(2, 9)}`
    this.onEnterCallback = onEnter
    this.onExitCallback = onExit
    this.options = {
      width: 2,
      depth: 2,
      active: true,
      show: true,
      ...options,
    }
    this.active = this.options.active ?? true
  }

  /**
   * Set interaction callbacks
   */
  public setCallbacks(callbacks: {
    onEnter?: (other: GameObject) => void
    onExit?: (other: GameObject) => void
  }): void {
    this.onEnterCallback = callbacks.onEnter
    this.onExitCallback = callbacks.onExit
  }

  /**
   * Called when component is attached to GameObject
   */
  protected onCreate(): void {
    if (this.options.show) {
      this.createVisualMesh()
    }
    this.createTriggerCollider()
    this.setActive(this.active)
  }

  public onEnabled(): void {
    // Trigger registration handled by explicit registerOnTriggerEnter/Exit() calls
    // No additional logic needed here
  }

  /**
   * Create the visual mesh for the interaction zone
   */
  private createVisualMesh(): void {
    const width = this.options.width!
    const height = 0.1 // Fixed height for top-down view
    const depth = this.options.depth!

    // Create box geometry
    const geometry = new THREE.BoxGeometry(width, height, depth)

    // Create semi-transparent material
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000, // Black like the original
      transparent: true,
      opacity: 0.15, // Original opacity
      side: THREE.DoubleSide,
    })

    this.visualMesh = new THREE.Mesh(geometry, material)

    // Add to the GameObject
    this.gameObject.add(this.visualMesh)
    this.visualMesh.position.y += 0.1

    // Visual mesh created
  }

  /**
   * Create the physics trigger collider
   */
  private createTriggerCollider(): void {
    this.rigidBody = new RigidBodyComponentThree({
      type: RigidBodyType.STATIC,
      shape: ColliderShape.BOX,
      size: new THREE.Vector3(this.options.width!, 0.1, this.options.depth!), // Fixed height of 0.1
      isSensor: true, // This makes it a trigger collider
      // No collision groups = default behavior (can detect anything that wants to hit it)
    })

    // Apply center offset if specified (only X and Z since it's Vector2)
    if (this.options.centerOffset) {
      this.gameObject.position.x += this.options.centerOffset.x
      this.gameObject.position.z += this.options.centerOffset.y // Vector2.y maps to world Z
    }

    this.gameObject.addComponent(this.rigidBody)

    // Register methods directly - just like C# actions!
    this.rigidBody.registerOnTriggerEnter(this.onTriggerEnter.bind(this))
    this.rigidBody.registerOnTriggerExit(this.onTriggerExit.bind(this))
  }

  /**
   * Handle trigger enter event (to be called by physics system)
   */
  public onTriggerEnter(other: GameObject): void {
    // console.log(`🎯 ENTER: ${other.name} → InteractionZone ${this.id}`); // Reduced spam

    if (!this.active) {
      console.warn(
        `🎯 InteractionZone ${this.id}: Ignoring enter event - zone is inactive`,
      )
      return
    }

    // Check if parent GameObject is enabled
    if (!this.gameObject.isEnabled()) {
      // console.log(`🎯 InteractionZone ${this.id}: Ignoring enter event - parent GameObject is disabled`);
      return
    }

    if (!this.entitiesInZone.has(other)) {
      this.entitiesInZone.add(other)
      // console.log(`🎯 Added ${other.name} to zone (total: ${this.entitiesInZone.size})`); // Reduced spam

      if (this.onEnterCallback) {
        this.onEnterCallback(other)
      }
    }
  }

  /**
   * Handle trigger exit event (to be called by physics system)
   */
  public onTriggerExit(other: GameObject): void {
    // console.log(`🎯 EXIT: ${other.name} ← InteractionZone ${this.id}`); // Reduced spam

    if (!this.active) {
      // Zone inactive, ignoring exit
      return
    }

    // Check if parent GameObject is enabled
    if (!this.gameObject.isEnabled()) {
      // console.log(`🎯 InteractionZone ${this.id}: Ignoring exit event - parent GameObject is disabled`);
      return
    }

    if (this.entitiesInZone.has(other)) {
      this.entitiesInZone.delete(other)
      // console.log(`🎯 Removed ${other.name} from zone (total: ${this.entitiesInZone.size})`); // Reduced spam

      if (this.onExitCallback) {
        this.onExitCallback(other)
      }
    }
  }

  /**
   * Get all entities currently in the zone
   */
  public getEntitiesInZone(): GameObject[] {
    return Array.from(this.entitiesInZone)
  }

  /**
   * Check if a specific entity is in the zone
   */
  public hasEntity(entity: GameObject): boolean {
    return this.entitiesInZone.has(entity)
  }

  /**
   * Set active state
   */
  public setActive(active: boolean): void {
    this.active = active

    // Show/hide visual mesh (only if visual mesh was created)
    if (this.visualMesh) {
      this.visualMesh.visible = active
    }

    if (this.rigidBody) {
      // TODO: Enable/disable the rigid body when that feature is available
    }

    if (!active) {
      // Clear all entities when deactivated
      this.entitiesInZone.clear()
    }
  }

  /**
   * Check if the interaction zone is active
   */
  public isActive(): boolean {
    return this.active
  }

  /**
   * Get the visual mesh
   */
  public getVisualMesh(): THREE.Mesh | null {
    return this.visualMesh
  }

  /**
   * Get the collider component
   */
  public getCollider(): RigidBodyComponentThree | null {
    return this.rigidBody
  }

  /**
   * Get the GameObject this zone is attached to
   */
  public getGameObject(): GameObject {
    return this.gameObject
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    this.entitiesInZone.clear()

    // Trigger cleanup handled automatically by RigidBodyComponentThree!
    // The registered callbacks will be cleaned up when the RigidBody is destroyed

    // Clean up visual mesh
    if (this.visualMesh) {
      this.visualMesh.geometry.dispose()
      if (this.visualMesh.material instanceof THREE.Material) {
        this.visualMesh.material.dispose()
      }
      this.gameObject.remove(this.visualMesh)
      this.visualMesh = null
    }

    // RigidBodyComponentThree will be cleaned up automatically by the GameObject
  }
}

// Interface for options
export interface InteractionZoneOptions {
  width?: number
  depth?: number
  active?: boolean
  centerOffset?: THREE.Vector2
  show?: boolean
}
