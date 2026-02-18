import * as THREE from "three"
import { Component, GameObject } from "@engine/core"
import { UISystem, UIElement } from "@systems/ui"

/**
 * Three.js interaction system using raycasting and proximity detection
 * Replaces Babylon.js physics triggers with efficient raycasting
 */
export class InteractionSystemThree {
  private static raycaster: THREE.Raycaster = new THREE.Raycaster()
  private static mouse: THREE.Vector2 = new THREE.Vector2()
  private static interactableObjects: Map<string, InteractionZone> = new Map()
  private static camera: THREE.Camera | null = null
  private static scene: THREE.Scene | null = null
  private static isInitialized: boolean = false

  // Player reference for proximity checks
  private static playerObject: GameObject | null = null
  private static maxInteractionDistance: number = 5.0

  // Current interaction state
  private static hoveredObject: InteractionZone | null = null
  private static nearbyObjects: Set<InteractionZone> = new Set()

  /**
   * Initialize the interaction system
   */
  public static initialize(camera: THREE.Camera, scene: THREE.Scene): void {
    if (InteractionSystemThree.isInitialized) {
      return
    }

    InteractionSystemThree.camera = camera
    InteractionSystemThree.scene = scene

    // Set up event listeners
    InteractionSystemThree.setupEventListeners()

    InteractionSystemThree.isInitialized = true
    console.log("🤝 InteractionSystemThree initialized")
  }

  /**
   * Set up mouse and keyboard event listeners
   */
  private static setupEventListeners(): void {
    // Mouse move for hover detection
    document.addEventListener("mousemove", InteractionSystemThree.onMouseMove)

    // Click for interaction
    document.addEventListener("click", InteractionSystemThree.onClick)

    // Keyboard for interaction key
    document.addEventListener("keydown", InteractionSystemThree.onKeyDown)

    // Touch events for mobile
    document.addEventListener("touchstart", InteractionSystemThree.onTouchStart)
  }

  /**
   * Handle mouse movement for hover detection
   */
  private static onMouseMove(event: MouseEvent): void {
    if (!InteractionSystemThree.camera) return

    // Calculate mouse position in normalized device coordinates
    InteractionSystemThree.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    InteractionSystemThree.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

    InteractionSystemThree.updateHover()
  }

  /**
   * Handle click for interaction
   */
  private static onClick(event: MouseEvent): void {
    if (InteractionSystemThree.hoveredObject) {
      InteractionSystemThree.triggerInteraction(InteractionSystemThree.hoveredObject)
    }
  }

  /**
   * Handle keyboard for interaction key (E)
   */
  private static onKeyDown(event: KeyboardEvent): void {
    if (event.code === "KeyE") {
      // Find nearest interactable object
      const nearest = InteractionSystemThree.findNearestInteractable()
      if (nearest) {
        InteractionSystemThree.triggerInteraction(nearest)
      }
    }
  }

  /**
   * Handle touch for mobile interaction
   */
  private static onTouchStart(event: TouchEvent): void {
    if (event.touches.length > 0) {
      const touch = event.touches[0]
      InteractionSystemThree.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1
      InteractionSystemThree.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1

      InteractionSystemThree.updateHover()

      if (InteractionSystemThree.hoveredObject) {
        InteractionSystemThree.triggerInteraction(InteractionSystemThree.hoveredObject)
      }
    }
  }

  /**
   * Update hover detection using raycasting
   */
  private static updateHover(): void {
    if (!InteractionSystemThree.camera || !InteractionSystemThree.scene) return

    // Update raycaster
    InteractionSystemThree.raycaster.setFromCamera(
      InteractionSystemThree.mouse,
      InteractionSystemThree.camera
    )

    // Get all interactable meshes
    const interactableMeshes: THREE.Mesh[] = []
    InteractionSystemThree.interactableObjects.forEach((zone) => {
      if (zone.mesh && zone.isActive()) {
        interactableMeshes.push(zone.mesh)
      }
    })

    // Perform raycast
    const intersects = InteractionSystemThree.raycaster.intersectObjects(interactableMeshes)

    // Handle hover state
    const previousHovered = InteractionSystemThree.hoveredObject
    InteractionSystemThree.hoveredObject = null

    if (intersects.length > 0) {
      const intersectedMesh = intersects[0].object as THREE.Mesh

      // Find the interaction zone for this mesh
      InteractionSystemThree.interactableObjects.forEach((zone) => {
        if (zone.mesh === intersectedMesh) {
          InteractionSystemThree.hoveredObject = zone
        }
      })
    }

    // Handle hover change events
    // if (previousHovered !== InteractionSystemThree.hoveredObject) {
    //   if (previousHovered) {
    //     previousHovered.onHoverExit()
    //   }
    //   const currentHovered = InteractionSystemThree.hoveredObject
    //   if (currentHovered) {
    //     currentHovered.onHoverEnter()
    //   }
    // }
  }

  /**
   * Update proximity detection (called from game loop)
   */
  public static updateProximity(): void {
    if (!InteractionSystemThree.playerObject) return

    const playerPosition = InteractionSystemThree.playerObject.position
    const previousNearby = new Set(InteractionSystemThree.nearbyObjects)
    InteractionSystemThree.nearbyObjects.clear()

    // Check distance to all interactable objects
    InteractionSystemThree.interactableObjects.forEach((zone) => {
      if (!zone.isActive()) return

      const distance = playerPosition.distanceTo(zone.getPosition())

      if (distance <= InteractionSystemThree.maxInteractionDistance) {
        InteractionSystemThree.nearbyObjects.add(zone)

        // Trigger enter event if newly nearby
        if (!previousNearby.has(zone)) {
          zone.onProximityEnter()
        }
      }
    })

    // Trigger exit events for objects no longer nearby
    previousNearby.forEach((zone) => {
      if (!InteractionSystemThree.nearbyObjects.has(zone)) {
        zone.onProximityExit()
      }
    })
  }

  /**
   * Find the nearest interactable object to the player
   */
  private static findNearestInteractable(): InteractionZone | null {
    if (!InteractionSystemThree.playerObject || InteractionSystemThree.nearbyObjects.size === 0) {
      return null
    }

    const playerPosition = InteractionSystemThree.playerObject.position
    let nearest: InteractionZone | null = null
    let nearestDistance = Infinity

    InteractionSystemThree.nearbyObjects.forEach((zone) => {
      const distance = playerPosition.distanceTo(zone.getPosition())
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = zone
      }
    })

    return nearest
  }

  /**
   * Trigger interaction with an object
   */
  private static triggerInteraction(zone: InteractionZone): void {
    zone.onInteract()
  }

  /**
   * Register an interactable object
   */
  public static registerInteractable(zone: InteractionZone): void {
    InteractionSystemThree.interactableObjects.set(zone.id, zone)
  }

  /**
   * Unregister an interactable object
   */
  public static unregisterInteractable(id: string): void {
    const zone = InteractionSystemThree.interactableObjects.get(id)
    if (zone) {
      // Clean up any UI elements
      zone.hideInteractionPrompt()
      InteractionSystemThree.interactableObjects.delete(id)

      // Clean up hover/proximity state
      if (InteractionSystemThree.hoveredObject === zone) {
        InteractionSystemThree.hoveredObject = null
      }
      InteractionSystemThree.nearbyObjects.delete(zone)
    }
  }

  /**
   * Set the player object for proximity detection
   */
  public static setPlayer(player: GameObject): void {
    InteractionSystemThree.playerObject = player
  }

  /**
   * Set maximum interaction distance
   */
  public static setMaxInteractionDistance(distance: number): void {
    InteractionSystemThree.maxInteractionDistance = distance
  }

  /**
   * Get all nearby interactable objects
   */
  public static getNearbyObjects(): InteractionZone[] {
    return Array.from(InteractionSystemThree.nearbyObjects)
  }

  /**
   * Dispose of the interaction system
   */
  public static dispose(): void {
    // Remove event listeners
    document.removeEventListener("mousemove", InteractionSystemThree.onMouseMove)
    document.removeEventListener("click", InteractionSystemThree.onClick)
    document.removeEventListener("keydown", InteractionSystemThree.onKeyDown)
    document.removeEventListener("touchstart", InteractionSystemThree.onTouchStart)

    // Clear all registered objects
    InteractionSystemThree.interactableObjects.clear()
    InteractionSystemThree.nearbyObjects.clear()
    InteractionSystemThree.hoveredObject = null
    InteractionSystemThree.playerObject = null
    InteractionSystemThree.camera = null
    InteractionSystemThree.scene = null
    InteractionSystemThree.isInitialized = false
  }
}

/**
 * Interaction zone component for Three.js objects
 * Replaces the Babylon.js InteractionZone with raycasting-based detection
 */
export class InteractionZone extends Component {
  public readonly id: string
  public mesh: THREE.Mesh | null = null

  private active: boolean = true
  private onInteractCallback?: () => void
  private onHoverEnterCallback?: () => void
  private onHoverExitCallback?: () => void
  private onProximityEnterCallback?: () => void
  private onProximityExitCallback?: () => void

  private interactionPrompt: UIElement | null = null
  private options: InteractionZoneOptions

  constructor(onInteract?: () => void, options: InteractionZoneOptions = {}) {
    super()
    this.id = `interaction_${Math.random().toString(36).substr(2, 9)}`
    this.onInteractCallback = onInteract
    this.options = {
      width: 2,
      height: 0.1,
      depth: 2,
      promptText: "Press E to interact",
      showVisualMesh: false,
      ...options,
    }
  }

  /**
   * Set interaction callbacks
   */
  public setCallbacks(callbacks: {
    onInteract?: () => void
    onHoverEnter?: () => void
    onHoverExit?: () => void
    onProximityEnter?: () => void
    onProximityExit?: () => void
  }): void {
    this.onInteractCallback = callbacks.onInteract
    this.onHoverEnterCallback = callbacks.onHoverEnter
    this.onHoverExitCallback = callbacks.onHoverExit
    this.onProximityEnterCallback = callbacks.onProximityEnter
    this.onProximityExitCallback = callbacks.onProximityExit
  }

  /**
   * Called when component is attached to GameObject
   */
  protected onCreate(): void {
    this.createInteractionMesh()
    InteractionSystemThree.registerInteractable(this)
  }

  /**
   * Create the invisible mesh for raycasting detection
   */
  private createInteractionMesh(): void {
    const geometry = new THREE.BoxGeometry(
      this.options.width,
      this.options.height,
      this.options.depth
    )

    // Create material - invisible by default, visible for debugging
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: this.options.showVisualMesh ? 0.3 : 0,
      wireframe: this.options.showVisualMesh,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.name = `InteractionZone_${this.id}`

    // Apply center offset if specified
    if (this.options.centerOffset) {
      this.mesh.position.copy(this.options.centerOffset)
    }

    // Add to the GameObject
    this.gameObject.add(this.mesh)
  }

  /**
   * Handle interaction event
   */
  public onInteract(): void {
    if (this.active && this.onInteractCallback) {
      this.onInteractCallback()
    }
  }

  /**
   * Handle hover enter event
   */
  public onHoverEnter(): void {
    if (this.onHoverEnterCallback) {
      this.onHoverEnterCallback()
    }

    // Show interaction prompt if specified
    if (this.options.promptText) {
      this.showInteractionPrompt()
    }
  }

  /**
   * Handle hover exit event
   */
  public onHoverExit(): void {
    if (this.onHoverExitCallback) {
      this.onHoverExitCallback()
    }

    this.hideInteractionPrompt()
  }

  /**
   * Handle proximity enter event
   */
  public onProximityEnter(): void {
    if (this.onProximityEnterCallback) {
      this.onProximityEnterCallback()
    }
  }

  /**
   * Handle proximity exit event
   */
  public onProximityExit(): void {
    if (this.onProximityExitCallback) {
      this.onProximityExitCallback()
    }

    this.hideInteractionPrompt()
  }

  /**
   * Show interaction prompt UI
   */
  private showInteractionPrompt(): void {
    if (!this.options.promptText || this.interactionPrompt) return

    // Create world-space UI element
    const promptPosition = this.gameObject.position.clone()
    promptPosition.y += 1 // Offset above the object

    this.interactionPrompt = UISystem.createWorldSpaceUI(
      `prompt_${this.id}`,
      this.options.promptText,
      promptPosition,
      InteractionSystemThree["camera"]!,
      {
        className: "ui-interaction-prompt",
        offset: { x: 0, y: -50 },
      }
    )
  }

  /**
   * Hide interaction prompt UI
   */
  public hideInteractionPrompt(): void {
    if (this.interactionPrompt) {
      this.interactionPrompt.remove()
      this.interactionPrompt = null
    }
  }

  /**
   * Set active state
   */
  public setActive(active: boolean): void {
    this.active = active
    if (this.mesh) {
      this.mesh.visible = active
    }

    if (!active) {
      this.hideInteractionPrompt()
    }
  }

  /**
   * Check if the interaction zone is active
   */
  public isActive(): boolean {
    return this.active
  }

  /**
   * Get the world position of this interaction zone
   */
  public getPosition(): THREE.Vector3 {
    return this.gameObject.position
  }

  /**
   * Show/hide visual mesh for debugging
   */
  public setVisualMeshVisible(visible: boolean): void {
    if (this.mesh && this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.opacity = visible ? 0.3 : 0
      this.mesh.material.wireframe = visible
    }
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    this.hideInteractionPrompt()
    InteractionSystemThree.unregisterInteractable(this.id)

    if (this.mesh) {
      this.gameObject.remove(this.mesh)
      this.mesh.geometry.dispose()
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose()
      }
      this.mesh = null
    }
  }
}

// Interfaces
export interface InteractionZoneOptions {
  width?: number
  height?: number
  depth?: number
  centerOffset?: THREE.Vector3
  promptText?: string
  showVisualMesh?: boolean
}
