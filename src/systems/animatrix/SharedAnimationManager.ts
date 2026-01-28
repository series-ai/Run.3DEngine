import * as THREE from "three"

/**
 * Shared animation clip registry
 * Stores clips once, characters create their own mixers
 * 
 * Note: We tried using AnimationObjectGroup for true sharing, but it had
 * issues with certain animations not applying to some character models.
 * Per-character mixers are slightly less efficient but much more reliable.
 */
export class SharedAnimationManager {
  private static instance: SharedAnimationManager | null = null
  
  // Cached clips (shared by all characters - this is the main memory savings)
  private clips: Map<string, THREE.AnimationClip> = new Map()
  
  private constructor() {}
  
  public static getInstance(): SharedAnimationManager {
    if (!SharedAnimationManager.instance) {
      SharedAnimationManager.instance = new SharedAnimationManager()
    }
    return SharedAnimationManager.instance
  }
  
  /**
   * Register an animation clip once
   */
  public registerClip(name: string, clip: THREE.AnimationClip): void {
    if (this.clips.has(name)) return
    this.clips.set(name, clip)
  }
  
  public getClip(name: string): THREE.AnimationClip | undefined {
    return this.clips.get(name)
  }
  
  public getRegisteredClipNames(): string[] {
    return [...this.clips.keys()]
  }
  
  /**
   * No-op for backward compatibility
   * Per-character mixers update themselves
   */
  public update(_deltaTime: number): void {
    // Each character's controller updates its own mixer
  }
}

/**
 * Per-character animation controller with its own mixer
 * Uses shared clips from SharedAnimationManager for memory efficiency
 */
export class CharacterAnimationController {
  private manager: SharedAnimationManager
  private mixer: THREE.AnimationMixer
  private actions: Map<string, THREE.AnimationAction> = new Map()
  private currentAnimation: string | null = null
  private crossfadeDuration: number = 0.2 // Default crossfade time in seconds
  private isPaused: boolean = false

  constructor(model: THREE.Object3D, manager: SharedAnimationManager) {
    this.manager = manager
    this.mixer = new THREE.AnimationMixer(model)
  }
  
  /**
   * Pause animation updates (for off-screen or distant characters)
   */
  public setPaused(paused: boolean): void {
    this.isPaused = paused
  }
  
  /**
   * Check if animation is paused
   */
  public getIsPaused(): boolean {
    return this.isPaused
  }

  /**
   * Set the crossfade duration for animation transitions
   */
  public setCrossfadeDuration(duration: number): void {
    this.crossfadeDuration = Math.max(0, duration)
  }

  /**
   * Play a single animation with crossfade transition
   */
  public playAnimation(name: string, startTime: number = 0): void {
    if (this.currentAnimation === name) return

    const clip = this.manager.getClip(name)
    if (!clip) {
      console.warn(`[CharacterAnimController] Animation '${name}' not registered!`)
      return
    }

    // Get or create action for the new animation
    let newAction = this.actions.get(name)
    if (!newAction) {
      newAction = this.mixer.clipAction(clip)
      this.actions.set(name, newAction)
    }

    // Get current action if exists
    const currentAction = this.currentAnimation ? this.actions.get(this.currentAnimation) : null

    if (currentAction && this.crossfadeDuration > 0) {
      // Crossfade from current to new animation
      newAction.reset()
      newAction.time = startTime
      newAction.setEffectiveTimeScale(1)
      newAction.setEffectiveWeight(1)
      newAction.play()
      currentAction.crossFadeTo(newAction, this.crossfadeDuration, true)
    } else {
      // No current animation or no crossfade - just play immediately
      if (currentAction) {
        currentAction.fadeOut(0.1)
      }
      newAction.reset()
      newAction.time = startTime
      newAction.setEffectiveTimeScale(1)
      newAction.setEffectiveWeight(1)
      newAction.fadeIn(0.1)
      newAction.play()
    }

    this.currentAnimation = name
  }
  
  /**
   * Update the mixer - MUST be called every frame
   * Returns early if paused (for performance optimization of off-screen characters)
   */
  public update(deltaTime: number): void {
    if (this.isPaused) return
    this.mixer.update(deltaTime)
  }
  
  /**
   * Stop all animations
   */
  public stopAll(): void {
    for (const action of this.actions.values()) {
      action.stop()
    }
    this.currentAnimation = null
  }
  
  /**
   * Cleanup
   */
  public dispose(): void {
    this.stopAll()
    this.mixer.stopAllAction()
  }
}
