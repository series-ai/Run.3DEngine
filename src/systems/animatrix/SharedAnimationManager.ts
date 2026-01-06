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
  
  constructor(model: THREE.Object3D, manager: SharedAnimationManager) {
    this.manager = manager
    this.mixer = new THREE.AnimationMixer(model)
  }
  
  /**
   * Play a single animation
   */
  public playAnimation(name: string): void {
    if (this.currentAnimation === name) return
    
    const clip = this.manager.getClip(name)
    if (!clip) {
      console.warn(`[CharacterAnimController] Animation '${name}' not registered!`)
      return
    }
    
    // Stop current animation
    if (this.currentAnimation) {
      const currentAction = this.actions.get(this.currentAnimation)
      if (currentAction) {
        currentAction.stop()
      }
    }
    
    // Get or create action for this clip
    let action = this.actions.get(name)
    if (!action) {
      action = this.mixer.clipAction(clip)
      this.actions.set(name, action)
    }
    
    action.reset()
    action.play()
    this.currentAnimation = name
  }
  
  /**
   * Update the mixer - MUST be called every frame
   */
  public update(deltaTime: number): void {
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
