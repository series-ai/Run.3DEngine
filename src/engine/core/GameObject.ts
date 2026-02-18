import * as THREE from "three"
import { VenusGame } from "./VenusGame.ts"
import { ComponentUpdater } from "./ComponentUpdater"

/**
 * Three.js version of GameObject
 * Clean implementation without Babylon.js dependencies
 */
export class GameObject extends THREE.Object3D {
  private components = new Map<new (...args: any[]) => Component, Component>()
  private isDestroyed: boolean = false
  private static idCounter: number = 0

  /**
   * Create a new Three.js GameObject
   * @param name Optional name for the GameObject. If not provided, an auto-generated name will be used.
   */
  constructor(name?: string) {
    super()

    // Generate a name if none provided
    this.name = name || `GameObject_${GameObject.idCounter++}`

    // Add to the scene
    VenusGame.scene.add(this)
  }

  /**
   * Adds a component instance to the GameObject
   * @returns The component instance
   * @throws If component of same type already exists
   */
  addComponent<T extends Component>(component: T): T {
    if (this.isDestroyed) {
      throw new Error("Cannot add component to destroyed GameObject")
    }

    const componentType = component.constructor as new (...args: any[]) => T

    if (this.components.has(componentType)) {
      throw new Error(`Component ${componentType.name} already exists on GameObject ${this.name}`)
    }

    try {
      // Attach the component
      component.attach(this)
      this.components.set(componentType, component)

      return component
    } catch (error) {
      // Provide better context for component initialization errors
      console.error(
        `❌ Failed to add component ${componentType.name} to GameObject "${this.name}":`,
        error
      )
      throw error // Re-throw to stop initialization
    }
  }

  /**
   * Gets a component of the specified type
   * @returns The component if found, undefined otherwise
   */
  getComponent<T extends Component>(componentType: new (...args: any[]) => T): T | undefined {
    return this.components.get(componentType) as T | undefined
  }

  /**
   * Checks if the GameObject has a component of the specified type
   */
  hasComponent<T extends Component>(componentType: new (...args: any[]) => T): boolean {
    return this.components.has(componentType)
  }

  /**
   * Removes a component of the specified type
   * @returns true if component was found and removed
   */
  removeComponent<T extends Component>(componentType: new (...args: any[]) => T): boolean {
    const component = this.components.get(componentType)
    if (!component) return false

    // Cleanup and remove the component
    component.cleanup()
    this.components.delete(componentType)
    return true
  }

  /**
   * Disposes of the GameObject and all its components
   */
  dispose(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true

    // First, recursively dispose all child GameObjects (and their components)
    // Collect children first to avoid modification during iteration
    const childGameObjects: GameObject[] = []
    for (const child of this.children) {
      if (child instanceof GameObject) {
        childGameObjects.push(child)
      }
    }

    // Dispose each child GameObject (this will recursively dispose their children too)
    for (const child of childGameObjects) {
      child.dispose()
    }

    // Cleanup all components on this GameObject
    for (const component of this.components.values()) {
      component.cleanup()
    }

    // Clear components
    this.components.clear()

    // Remove from parent
    if (this.parent) {
      this.parent.remove(this)
    }

    // Dispose of any meshes/materials (for non-GameObject Three.js objects)
    this.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (object.material instanceof THREE.Material) {
          object.material.dispose()
        } else if (Array.isArray(object.material)) {
          object.material.forEach((material: THREE.Material) => material.dispose())
        }
      }
    })

    // Clear remaining children
    this.clear()
  }

  /**
   * Get the Three.js scene the GameObject is in
   */
  getScene(): THREE.Scene {
    return VenusGame.scene
  }

  /**
   * Three.js equivalent of setEnabled - uses visible property
   */
  setEnabled(value: boolean): void {
    const wasEnabled = this.isEnabled()

    // Set visibility
    this.visible = value

    const isNowEnabled = this.isEnabled()

    // If the effective enabled state actually changed, notify components and children
    if (wasEnabled !== isNowEnabled) {
      // GameObject enabled state changed (logging disabled)

      // Notify this GameObject's components
      this.notifyEnabledStateChanged(isNowEnabled)

      // Notify children recursively
      this.notifyChildrenEnabledStateChanged()
    }
  }

  /**
   * Three.js equivalent of isEnabled - checks visible property AND parent hierarchy
   */
  isEnabled(): boolean {
    // Check own visibility first
    if (!this.visible) {
      return false
    }

    // Check parent hierarchy - if any parent is disabled, this object is effectively disabled
    let current = this.parent
    while (current) {
      if (current instanceof GameObject && !current.visible) {
        return false
      }
      // Also check regular Three.js objects in the hierarchy
      if (current instanceof THREE.Object3D && !current.visible) {
        return false
      }
      current = current.parent
    }

    return true
  }

  /**
   * Override THREE.Object3D.add() to handle enabled state propagation
   * When adding a child to a disabled parent, the child should be effectively disabled too
   */
  add(...objects: THREE.Object3D[]): this {
    // Call parent implementation first
    super.add(...objects)

    // For each added object, check if we need to handle enabled state
    for (const object of objects) {
      if (object instanceof GameObject) {
        // Check the child's effective enabled state now that it has a new parent
        const childEffectiveState = object.isEnabled()

        // Notify the child's components about its effective state
        object.notifyEnabledStateChanged(childEffectiveState)

        // Also notify the child's descendants recursively
        object.notifyChildrenEnabledStateChanged()
      }
    }

    return this
  }

  /**
   * Recursively notify all children that their enabled state may have changed
   */
  protected notifyChildrenEnabledStateChanged(): void {
    for (const child of this.children) {
      if (child instanceof GameObject) {
        // Check the child's effective enabled state (now includes parent hierarchy)
        const childIsEnabled = child.isEnabled()

        // Child enabled state change (logging disabled)

        // Notify the child's components based on effective state
        child.notifyEnabledStateChanged(childIsEnabled)

        // Recursively notify grandchildren (they will also check their effective state)
        child.notifyChildrenEnabledStateChanged()
      }
    }
  }

  /**
   * Internal method to trigger enabled state change notifications
   * This causes components to receive onEnabled/onDisabled callbacks
   */
  protected notifyEnabledStateChanged(isEnabled: boolean): void {
    // Notify components (logging disabled)

    // Notify all components
    for (const component of this.components.values()) {
      if (isEnabled) {
        component.onEnabled()
      } else {
        component.onDisabled()
      }
    }
  }
}

/**
 * Three.js Component base class
 * Clean implementation without Babylon.js dependencies
 */
export abstract class Component {
  protected gameObject!: GameObject
  private _isAttached: boolean = false

  /**
   * Get the GameObject this component is attached to
   */
  public getGameObject(): GameObject {
    return this.gameObject
  }

  /**
   * Get the scene the GameObject is in
   */
  protected get scene(): THREE.Scene {
    return this.gameObject.getScene()
  }

  /**
   * Attach this component to a GameObject
   * @internal Called by GameObject.addComponent
   */
  attach(gameObject: GameObject): void {
    if (this._isAttached) {
      throw new Error("Component is already attached to a GameObject")
    }

    this.gameObject = gameObject
    this._isAttached = true

    // Register for updates if the component has an update method
    if (this.update) {
      ComponentUpdater.registerComponent(this)
    }

    // Register for late updates if the component has a lateUpdate method
    if (this.lateUpdate) {
      ComponentUpdater.registerLateUpdateComponent(this)
    }

    // Call the onCreate lifecycle method
    this.onCreate()

    // Call onEnabled if the GameObject is currently enabled
    if (this.gameObject.isEnabled()) {
      this.onEnabled()
    }
  }

  /**
   * Clean up this component
   * @internal Called by GameObject when removing component
   */
  cleanup(): void {
    if (!this._isAttached) return

    // Unregister from updates
    ComponentUpdater.unregisterComponent(this)
    ComponentUpdater.unregisterLateUpdateComponent(this)

    // Call the onCleanup lifecycle method
    this.onCleanup()

    this._isAttached = false
  }

  /**
   * Called when the component is first added to a GameObject
   * Override this method to implement component initialization
   */
  protected onCreate(): void {
    // Default implementation does nothing
  }

  /**
   * Called when the component is being removed/destroyed
   * Override this method to implement component cleanup
   */
  protected onCleanup(): void {
    // Default implementation does nothing
  }

  /**
   * Called when the GameObject becomes enabled
   * Override this method to react to enable state changes
   */
  public onEnabled(): void {
    // Default implementation does nothing
  }

  /**
   * Called when the GameObject becomes disabled
   * Override this method to react to enable state changes
   */
  public onDisabled(): void {
    // Default implementation does nothing
  }

  /**
   * Called every frame if the component's GameObject is enabled
   * Override this method to implement per-frame logic
   * @param deltaTime Time in seconds since last frame
   */
  public update?(deltaTime: number): void

  /**
   * Called every frame after all update() calls have completed
   * Perfect for camera movement, UI updates, and anything that should happen last
   * @param deltaTime Time in seconds since last frame
   */
  public lateUpdate?(deltaTime: number): void

  /**
   * Check if the component is attached to a GameObject
   */
  public isAttached(): boolean {
    return this._isAttached
  }

  /**
   * Gets a component of the specified type from the same GameObject
   * @returns The component if found, undefined otherwise
   */
  getComponent<T extends Component>(componentType: new (...args: any[]) => T): T | undefined {
    return this.gameObject.getComponent(componentType)
  }
}
