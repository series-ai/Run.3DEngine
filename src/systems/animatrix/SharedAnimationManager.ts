import * as THREE from "three"

/**
 * Ultra-lightweight shared animation manager
 * Uses ONE mixer and AnimationObjectGroups for massive performance gains
 */
export class SharedAnimationManager {
  private static instance: SharedAnimationManager | null = null
  
  // Single mixer for ALL animations
  private mixer: THREE.AnimationMixer
  
  // One action per animation clip (shared by all characters)
  private actions: Map<string, THREE.AnimationAction> = new Map()
  
  // AnimationObjectGroup per animation - characters get added/removed from these
  private groups: Map<string, THREE.AnimationObjectGroup> = new Map()
  
  // Cached clips
  private clips: Map<string, THREE.AnimationClip> = new Map()
  
  private constructor() {
    // Create mixer with a dummy root
    this.mixer = new THREE.AnimationMixer(new THREE.Object3D())
  }
  
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
    
    // Create the group for this animation
    const group = new THREE.AnimationObjectGroup()
    this.groups.set(name, group)
    
    // Create ONE action for this animation using the group
    const action = this.mixer.clipAction(clip, group)
    action.play()
    action.weight = 1.0 // Always full weight - we control visibility via group membership
    this.actions.set(name, action)
  }
  
  /**
   * Add a model to an animation (starts playing it)
   */
  public addToAnimation(model: THREE.Object3D, animationName: string): void {
    const group = this.groups.get(animationName)
    if (group) {
      group.add(model)
    }
  }
  
  /**
   * Remove a model from an animation (stops playing it)
   */
  public removeFromAnimation(model: THREE.Object3D, animationName: string): void {
    const group = this.groups.get(animationName)
    if (group) {
      group.remove(model)
    }
  }
  
  /**
   * Remove model from all animations
   */
  public removeFromAll(model: THREE.Object3D): void {
    for (const group of this.groups.values()) {
      group.remove(model)
    }
  }
  
  /**
   * Update the single mixer
   */
  public update(deltaTime: number): void {
    this.mixer.update(deltaTime)
  }
  
  public getClip(name: string): THREE.AnimationClip | undefined {
    return this.clips.get(name)
  }
}

/**
 * Lightweight per-character controller
 * Just manages which animations the character is in
 */
export class CharacterAnimationController {
  private model: THREE.Object3D
  private manager: SharedAnimationManager
  private currentAnimation: string | null = null
  
  constructor(model: THREE.Object3D, manager: SharedAnimationManager) {
    this.model = model
    this.manager = manager
  }
  
  /**
   * Play a single animation (simple case)
   */
  public playAnimation(name: string): void {
    // Don't do anything if already playing this animation
    if (this.currentAnimation === name) {
      return
    }
    
    // IMPORTANT: Remove from ALL animations first to ensure clean state
    this.manager.removeFromAll(this.model)
    
    // Add to the new animation
    this.manager.addToAnimation(this.model, name)
    this.currentAnimation = name
  }
  
  /**
   * Stop all animations
   */
  public stopAll(): void {
    this.manager.removeFromAll(this.model)
    this.currentAnimation = null
  }
  
  /**
   * Cleanup
   */
  public dispose(): void {
    this.manager.removeFromAll(this.model)
    this.currentAnimation = null
  }
}