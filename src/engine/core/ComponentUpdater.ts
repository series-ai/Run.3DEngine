import * as THREE from "three"
import { Component } from "./GameObject"

/**
 * Component updater for Three.js components
 * Handles the update loop for all registered components
 */
export class ComponentUpdater {
  private static updateableComponents = new Set<Component>()
  private static lateUpdateableComponents = new Set<Component>()
  private static updateCount = 0 // Debug counter

  /**
   * Register a component for updates
   * @internal Only called by Component class
   */
  static registerComponent(component: Component): void {
    ComponentUpdater.updateableComponents.add(component)
    // Removed excessive logging: console.log(`📝 ComponentUpdater: Registered ${component.constructor.name} for updates. Total: ${ComponentUpdater.updateableComponents.size}`);
  }

  /**
   * Unregister a component from updates
   * @internal Only called by Component class
   */
  static unregisterComponent(component: Component): void {
    ComponentUpdater.updateableComponents.delete(component)
    // Component unregistered from updates
  }

  /**
   * Register a component for late updates
   * @internal Only called by Component class
   */
  static registerLateUpdateComponent(component: Component): void {
    ComponentUpdater.lateUpdateableComponents.add(component)
    console.log(
      `📝 ComponentUpdater: Registered ${component.constructor.name} for late updates. Total: ${ComponentUpdater.lateUpdateableComponents.size}`
    )
  }

  /**
   * Unregister a component from late updates
   * @internal Only called by Component class
   */
  static unregisterLateUpdateComponent(component: Component): void {
    ComponentUpdater.lateUpdateableComponents.delete(component)
    // Component unregistered from late updates
  }

  /**
   * Initialize the component updater
   */
  static initialize(scene: THREE.Scene): void {
    // ComponentUpdater initialized
  }

  /**
   * Update all registered components
   */
  static update(deltaTime: number): void {
    this.updateCount++
    for (const component of ComponentUpdater.updateableComponents) {
      if (component.getGameObject().visible) {
        try {
          component.update?.(deltaTime)
        } catch (error) {
          console.error(`❌ Error updating component ${component.constructor.name}:`, error)
        }
      }
    }
  }

  /**
   * Late update all registered components
   */
  static lateUpdate(deltaTime: number): void {
    for (const component of ComponentUpdater.lateUpdateableComponents) {
      if (component.getGameObject().visible) {
        try {
          component.lateUpdate?.(deltaTime)
        } catch (error) {
          console.error(`❌ Error late updating component ${component.constructor.name}:`, error)
        }
      }
    }
  }

  /**
   * Dispose all components
   */
  static dispose(): void {
    ComponentUpdater.updateableComponents.clear()
    ComponentUpdater.lateUpdateableComponents.clear()
    console.log("🔄 ComponentUpdater disposed")
  }
}
