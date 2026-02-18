import { Component } from "@engine/core/GameObject"
import Animatrix, { ParameterType } from "./animatrix"
import AnimatrixVisualizer from "./visualizer"

/**
 * Simplified component wrapper for Animatrix animation visualization
 * Note: For actual animation playback, use AnimationGraphComponent which uses SharedAnimationManager
 */
export class AnimationControllerComponent extends Component {
  private static instances: Set<AnimationControllerComponent> = new Set()
  private static sharedVisualizer: AnimatrixVisualizer | null = null
  private static debugViewEnabled: boolean = false

  private animator: Animatrix | null = null
  private debug: boolean = false

  constructor(debug: boolean = false) {
    super()
    this.debug = debug
  }

  public static setDebugViewEnabled(enabled: boolean): void {
    AnimationControllerComponent.debugViewEnabled = enabled

    if (enabled) {
      if (!AnimationControllerComponent.sharedVisualizer) {
        AnimationControllerComponent.sharedVisualizer = new AnimatrixVisualizer()
        AnimationControllerComponent.sharedVisualizer.hide()
      }

      for (const instance of AnimationControllerComponent.instances) {
        if (instance.animator) {
          const name =
            instance.gameObject?.name || `animator_${AnimationControllerComponent.instances.size}`
          AnimationControllerComponent.sharedVisualizer.add_animator(name, instance.animator)
        }
      }

      AnimationControllerComponent.sharedVisualizer.show()
    } else {
      if (AnimationControllerComponent.sharedVisualizer) {
        AnimationControllerComponent.sharedVisualizer.hide()
      }
    }
  }

  public static isDebugViewEnabled(): boolean {
    return AnimationControllerComponent.debugViewEnabled
  }

  public getAnimator(): Animatrix | null {
    return this.animator
  }

  public addParameter(name: string, type: ParameterType, initialValue?: any): void {
    this.animator?.add_parameter(name, type, initialValue)
  }

  public setBool(name: string, value: boolean): void {
    this.animator?.set_bool(name, value)
  }

  public setFloat(name: string, value: number): void {
    this.animator?.set_float(name, value)
  }

  public setInt(name: string, value: number): void {
    this.animator?.set_int(name, value)
  }

  public setState(stateId: string): boolean {
    this.animator?.set_state(stateId)
    return true
  }

  public getCurrentState(): string | null {
    return this.animator?.get_current_state() ?? null
  }

  public stopAll(): void {
    this.animator?.stop_all()
  }

  protected onCreate(): void {
    AnimationControllerComponent.instances.add(this)
    this.animator = new Animatrix()

    if (
      AnimationControllerComponent.debugViewEnabled &&
      AnimationControllerComponent.sharedVisualizer
    ) {
      const name =
        this.gameObject?.name || `animator_${AnimationControllerComponent.instances.size}`
      AnimationControllerComponent.sharedVisualizer.add_animator(name, this.animator)
    }
  }

  protected onCleanup(): void {
    AnimationControllerComponent.instances.delete(this)

    if (AnimationControllerComponent.sharedVisualizer && this.animator) {
      const name = this.gameObject?.name || "unknown"
      AnimationControllerComponent.sharedVisualizer.remove_animator(name)
    }

    if (this.animator) {
      this.animator.stop_all()
    }
  }

  public update(deltaTime: number): void {
    if (this.animator && this.gameObject.isEnabled()) {
      this.animator.update(deltaTime)
    }
  }
}
