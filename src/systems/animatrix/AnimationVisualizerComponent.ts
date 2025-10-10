import { Component } from "@engine/core/GameObject"
import { AnimationControllerComponent } from "./AnimationControllerComponent"
import AnimatrixVisualizer from "./visualizer"

/**
 * Component for visualizing animation state machines
 * Provides debug visualization functionality as a component
 */
export class AnimationVisualizerComponent extends Component {
  private visualizer: AnimatrixVisualizer | null = null
  private animationController: AnimationControllerComponent | null = null
  private name: string

  constructor(name?: string) {
    super()
    this.name = name || `visualizer_${Date.now()}`
  }

  /**
   * Set the animation controller to visualize
   */
  public setAnimationController(
    controller: AnimationControllerComponent,
  ): void {
    this.animationController = controller

    const animator = controller.getAnimator()
    if (animator) {
      if (this.visualizer) {
        // Update existing visualizer
        this.visualizer.add_animator(this.name, animator)
        this.visualizer.set_animator(this.name)
      } else {
        // Create new visualizer
        this.visualizer = new AnimatrixVisualizer(animator, this.name)
        // Hide by default - can be shown via debug panel
        this.visualizer.hide()
      }
    }
  }

  /**
   * Get the underlying visualizer instance
   */
  public getVisualizer(): AnimatrixVisualizer | null {
    return this.visualizer
  }

  /**
   * Show the visualizer UI
   */
  public show(): void {
    this.visualizer?.show()
  }

  /**
   * Hide the visualizer UI
   */
  public hide(): void {
    this.visualizer?.hide()
  }

  /**
   * Toggle visualizer visibility
   */
  public toggleVisibility(): void {
    this.visualizer?.toggle_visibility()
  }

  /**
   * Check if visualizer is currently visible
   */
  public isVisible(): boolean {
    // We can't directly check visibility from the current API, so we assume it's visible if it exists
    return this.visualizer !== null
  }

  /**
   * Destroy the visualizer UI
   */
  public destroyVisualizer(): void {
    if (this.visualizer) {
      this.visualizer.destroy()
      this.visualizer = null
    }
  }

  // ========== Component Lifecycle ==========

  protected onCreate(): void {
    // Try to automatically find an AnimationControllerComponent on the same GameObject
    const controller = this.getComponent(AnimationControllerComponent)
    if (controller) {
      this.setAnimationController(controller)
      console.log(
        `[AnimationVisualizerComponent] Auto-connected to AnimationController on ${this.gameObject.name}`,
      )
    } else {
      console.log(
        `[AnimationVisualizerComponent] Component created on ${this.gameObject.name} - waiting for animation controller`,
      )
    }
  }

  protected onCleanup(): void {
    this.destroyVisualizer()
    console.log(
      `[AnimationVisualizerComponent] Component cleaned up on ${this.gameObject.name}`,
    )
  }

  public onEnabled(): void {
    // Don't automatically show visualizer when component is enabled
    // Let it be controlled manually via debug panel
    // this.show()
  }

  public onDisabled(): void {
    // Hide visualizer when component is disabled
    this.hide()
  }

  // ========== Utility Methods ==========

  /**
   * Auto-setup: find an AnimationControllerComponent on the same GameObject and connect to it
   */
  public autoConnectToController(): boolean {
    const controller = this.getComponent(AnimationControllerComponent)
    if (controller) {
      this.setAnimationController(controller)
      console.log(
        `[AnimationVisualizerComponent] Successfully connected to AnimationController`,
      )
      return true
    }

    console.warn(
      `[AnimationVisualizerComponent] No AnimationControllerComponent found on ${this.gameObject.name}`,
    )
    return false
  }

  /**
   * Connect to a specific animation controller component from another GameObject
   */
  public connectToController(controller: AnimationControllerComponent): void {
    this.setAnimationController(controller)
    console.log(
      `[AnimationVisualizerComponent] Connected to external AnimationController`,
    )
  }
}
