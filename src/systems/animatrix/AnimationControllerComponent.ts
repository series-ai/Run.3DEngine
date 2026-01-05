import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import Animatrix, {
  AnimationEvent,
  ParameterType,
  ComparisonOperator,
  TransitionMode,
  BlendType,
  TransitionConfig,
  ActiveTransition,
  AnimationClip,
  LibraryClipFromIdConfig,
  LibraryBlendTree1DWrapper,
} from "./animatrix"
import { AnimationLibrary } from "./animation-library"
import AnimatrixVisualizer from "./visualizer"

/**
 * Component-based wrapper for Animatrix animation system
 * Provides animation state machine functionality as a proper engine component
 */
export class AnimationControllerComponent extends Component {
  private static instances: Set<AnimationControllerComponent> = new Set()
  private static sharedVisualizer: AnimatrixVisualizer | null = null
  private static debugViewEnabled: boolean = false

  private animator: Animatrix | null = null
  private characterModel: THREE.Object3D | null = null
  private debug: boolean = false

  constructor(debug: boolean = false) {
    super()
    this.debug = debug
  }

  /**
   * Enable or disable the debug visualizer for all animation controllers
   */
  public static setDebugViewEnabled(enabled: boolean): void {
    AnimationControllerComponent.debugViewEnabled = enabled

    if (enabled) {
      if (!AnimationControllerComponent.sharedVisualizer) {
        AnimationControllerComponent.sharedVisualizer = new AnimatrixVisualizer()
        AnimationControllerComponent.sharedVisualizer.hide()
      }

      for (const instance of AnimationControllerComponent.instances) {
        if (instance.animator) {
          const name = instance.gameObject?.name || `animator_${AnimationControllerComponent.instances.size}`
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

  /**
   * Check if debug view is currently enabled
   */
  public static isDebugViewEnabled(): boolean {
    return AnimationControllerComponent.debugViewEnabled
  }

  /**
   * Initialize the animation controller with a character model
   */
  public setCharacterModel(model: THREE.Object3D): void {
    this.characterModel = model

    if (this.animator) {
      this.animator.swap_model(model)
    } else {
      this.animator = new Animatrix(model, this.debug)
    }

    if (AnimationControllerComponent.debugViewEnabled && AnimationControllerComponent.sharedVisualizer) {
      const name = this.gameObject?.name || `animator_${AnimationControllerComponent.instances.size}`
      AnimationControllerComponent.sharedVisualizer.add_animator(name, this.animator)
    }
  }

  /**
   * Get the underlying Animatrix instance (for advanced use)
   */
  public getAnimator(): Animatrix | null {
    return this.animator
  }

  // ========== Parameter Management ==========

  public addParameter(
    name: string,
    type: ParameterType,
    initialValue?: any,
  ): void {
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

  public setTrigger(name: string): void {
    this.animator?.set_trigger(name)
  }

  public getBool(name: string): boolean {
    return this.animator?.get_bool(name) ?? false
  }

  public getFloat(name: string): number {
    return this.animator?.get_float(name) ?? 0
  }

  public getInt(name: string): number {
    return this.animator?.get_int(name) ?? 0
  }

  // ========== Animation Clip Management ==========

  public addClip(
    stateId: string,
    animation: THREE.AnimationClip,
    speed: number = 1.0,
    loop: boolean = true,
    startTime: number = 0,
    endTime?: number,
  ): void {
    this.animator?.add_clip(stateId, animation, speed, loop, startTime, endTime)
  }

  public addClipFromLibrary(
    stateId: string,
    libraryId: string,
    speed: number = 1.0,
    loop: boolean = true,
    startTime: number = 0,
    endTime?: number,
  ): boolean {
    return (
      this.animator?.add_clip_from_library(
        stateId,
        libraryId,
        speed,
        loop,
        startTime,
        endTime,
      ) ?? false
    )
  }

  public configureClipsFromLibrary(configs: {
    [stateId: string]: LibraryClipFromIdConfig | LibraryBlendTree1DWrapper
  }): void {
    this.animator?.configure_clips_from_library(configs)
  }

  // ========== State Management ==========

  public setState(stateId: string): boolean {
    return this.animator?.set_state(stateId) ?? false
  }

  public getCurrentState(): string | null {
    return this.animator?.get_current_state() ?? null
  }

  public isState(stateId: string): boolean {
    return this.animator?.is_state(stateId) ?? false
  }

  public isTransitioning(): boolean {
    return this.animator?.is_transitioning() ?? false
  }

  public getActiveTransition(): ActiveTransition | null {
    return this.animator?.get_active_transition() ?? null
  }

  // ========== Transition Management ==========

  public addTransition(config: TransitionConfig): void {
    this.animator?.add_transition(config)
  }

  public configureGraph(transitions: TransitionConfig[]): void {
    this.animator?.configure_graph(transitions)
  }

  // ========== Event Management ==========

  public addEventListener(
    event: AnimationEvent | string,
    callback: (data?: any) => void,
  ): void {
    this.animator?.add_listener(event, callback)
  }

  public removeEventListener(
    event: AnimationEvent | string,
    callback: (data?: any) => void,
  ): void {
    this.animator?.remove_listener(event, callback)
  }

  // ========== Utility Methods ==========

  public getClipProgress(stateId: string): number {
    return this.animator?.get_clip_progress(stateId) ?? 0
  }

  public hasClip(stateId: string): boolean {
    return this.animator?.has_clip(stateId) ?? false
  }

  public setClipSpeed(stateId: string, speed: number): void {
    this.animator?.set_clip_speed(stateId, speed)
  }

  public setClipLoop(stateId: string, loop: boolean): void {
    this.animator?.set_clip_loop(stateId, loop)
  }

  public stopAll(): void {
    this.animator?.stop_all()
  }

  public setDebug(enabled: boolean): void {
    this.debug = enabled
    this.animator?.set_debug(enabled)
  }

  // ========== Async Animation Loading ==========

  public async loadAnimations(paths: {
    [stateId: string]: string
  }): Promise<void> {
    if (!this.animator) {
      throw new Error(
        "Animation controller not initialized - call setCharacterModel first",
      )
    }

    return this.animator.load_animations(paths)
  }

  // ========== Component Lifecycle ==========

  protected onCreate(): void {
    AnimationControllerComponent.instances.add(this)

    if (this.debug) {
      console.log(
        `[AnimationControllerComponent] Component created on ${this.gameObject.name}`,
      )
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

    if (this.debug) {
      console.log(
        `[AnimationControllerComponent] Component cleaned up on ${this.gameObject.name}`,
      )
    }
  }

  public onEnabled(): void {
    // Could potentially resume animations when enabled
    if (this.debug) {
      console.log(
        `[AnimationControllerComponent] Component enabled on ${this.gameObject.name}`,
      )
    }
  }

  public onDisabled(): void {
    // Could potentially pause animations when disabled
    if (this.debug) {
      console.log(
        `[AnimationControllerComponent] Component disabled on ${this.gameObject.name}`,
      )
    }
  }

  public update(deltaTime: number): void {
    if (this.animator && this.gameObject.isEnabled()) {
      this.animator.update(deltaTime)
    }
  }

  // ========== Helper Methods for Common Animation Patterns ==========

  /**
   * Convenient method for setting up a basic walk/idle state machine
   */
  public setupBasicWalkIdleStateMachine(
    idleClipId: string,
    walkClipId: string,
    walkingParameterName: string = "is_walking",
  ): void {
    if (!this.animator) {
      console.warn(
        "[AnimationControllerComponent] Cannot setup state machine - animator not initialized",
      )
      return
    }

    // Add the walking parameter
    this.addParameter(walkingParameterName, ParameterType.BOOL, false)

    // Configure transitions
    this.configureGraph([
      {
        from: idleClipId,
        to: walkClipId,
        conditions: [
          {
            parameter: walkingParameterName,
            operator: ComparisonOperator.EQUALS,
            value: true,
          },
        ],
        duration: 0.1,
        priority: 1,
        blend_type: BlendType.EASE_IN_OUT,
      },
      {
        from: walkClipId,
        to: idleClipId,
        conditions: [
          {
            parameter: walkingParameterName,
            operator: ComparisonOperator.EQUALS,
            value: false,
          },
        ],
        duration: 0.1,
        priority: 1,
        blend_type: BlendType.EASE_IN_OUT,
      },
    ])

    // Set initial state
    this.setState(idleClipId)

    if (this.debug) {
      console.log(
        `[AnimationControllerComponent] Basic walk/idle state machine configured`,
      )
    }
  }

  /**
   * Convenient method for setting up blend trees for carrying animations
   */
  public setupCarryingBlendTree(
    idleClipId: string,
    carryIdleClipId: string,
    walkClipId: string,
    carryWalkClipId: string,
    carryingParameterName: string = "carrying",
  ): void {
    if (!this.animator) {
      console.warn(
        "[AnimationControllerComponent] Cannot setup blend tree - animator not initialized",
      )
      return
    }

    // Add the carrying parameter (0-1 float)
    this.addParameter(carryingParameterName, ParameterType.FLOAT, 0.0)

    // Configure blend trees using the library system
    this.configureClipsFromLibrary({
      idle_blend: {
        blend_tree_1d: {
          parameter: carryingParameterName,
          children: [
            { state_id: idleClipId, threshold: 0.0 },
            { state_id: carryIdleClipId, threshold: 1.0 },
          ],
        },
      },
      walk_blend: {
        blend_tree_1d: {
          parameter: carryingParameterName,
          children: [
            { state_id: walkClipId, threshold: 0.0 },
            { state_id: carryWalkClipId, threshold: 1.0 },
          ],
        },
      },
    })

    if (this.debug) {
      console.log(
        `[AnimationControllerComponent] Carrying blend trees configured`,
      )
    }
  }
}
