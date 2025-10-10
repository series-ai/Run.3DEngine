import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import { AnimationLibrary } from "./animation-library"

/**
 * Component for managing animation library functionality
 * Provides centralized animation loading and caching as a component
 */
export class AnimationLibraryComponent extends Component {
  private loadedAnimations: Set<string> = new Set()
  private debug: boolean = false

  constructor(debug: boolean = false) {
    super()
    this.debug = debug
  }

  /**
   * Load a single animation and add it to the library
   */
  public async loadAnimation(
    id: string,
    path: string,
  ): Promise<THREE.AnimationClip> {
    try {
      const clip = await AnimationLibrary.loadAnimation(id, path)
      this.loadedAnimations.add(id)

      if (this.debug) {
        console.log(
          `[AnimationLibraryComponent] Loaded animation: ${id} from ${path}`,
        )
      }

      return clip
    } catch (error) {
      console.error(
        `[AnimationLibraryComponent] Failed to load animation ${id} from ${path}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Load multiple animations in parallel
   */
  public async loadAnimations(paths: { [id: string]: string }): Promise<void> {
    try {
      await AnimationLibrary.loadAnimations(paths)

      // Track loaded animations
      Object.keys(paths).forEach((id) => this.loadedAnimations.add(id))

      if (this.debug) {
        console.log(
          `[AnimationLibraryComponent] Loaded ${Object.keys(paths).length} animations:`,
          Object.keys(paths),
        )
      }
    } catch (error) {
      console.error(
        `[AnimationLibraryComponent] Failed to load animations:`,
        error,
      )
      throw error
    }
  }

  /**
   * Get an animation clip from the library
   */
  public getClip(id: string): THREE.AnimationClip | undefined {
    return AnimationLibrary.getClip(id)
  }

  /**
   * Get a cloned copy of an animation clip
   */
  public cloneClip(id: string): THREE.AnimationClip | undefined {
    return AnimationLibrary.cloneClip(id)
  }

  /**
   * Check if an animation is loaded in the library
   */
  public hasClip(id: string): boolean {
    return AnimationLibrary.hasClip(id)
  }

  /**
   * Get all loaded animations
   */
  public getAllClips(): Map<string, THREE.AnimationClip> {
    return AnimationLibrary.getAllClips()
  }

  /**
   * Get list of animations loaded by this component instance
   */
  public getLoadedAnimationIds(): string[] {
    return Array.from(this.loadedAnimations)
  }

  /**
   * Set debug mode for the animation library
   */
  public setDebug(enabled: boolean): void {
    this.debug = enabled
    AnimationLibrary.setDebug(enabled)
  }

  // ========== Component Lifecycle ==========

  protected onCreate(): void {
    if (this.debug) {
      console.log(
        `[AnimationLibraryComponent] Component created on ${this.gameObject.name}`,
      )
    }
  }

  protected onCleanup(): void {
    // Note: We don't clear the global AnimationLibrary on cleanup since other objects might be using it
    // The global library persists across component instances

    if (this.debug) {
      console.log(
        `[AnimationLibraryComponent] Component cleaned up on ${this.gameObject.name}. Animations remain in global library.`,
      )
    }
  }

  public onEnabled(): void {
    if (this.debug) {
      console.log(
        `[AnimationLibraryComponent] Component enabled on ${this.gameObject.name}`,
      )
    }
  }

  public onDisabled(): void {
    if (this.debug) {
      console.log(
        `[AnimationLibraryComponent] Component disabled on ${this.gameObject.name}`,
      )
    }
  }

  // ========== Utility Methods ==========

  /**
   * Preload a standard set of character animations
   * Useful for common character animation setups
   */
  public async preloadCharacterAnimations(
    basePath: string = "assets/characters/",
  ): Promise<void> {
    const standardAnimations = {
      idle: `${basePath}anim_idle.fbx`,
      walk: `${basePath}anim_walk.fbx`,
      sitting_eating: `${basePath}anim_sitting_eating.fbx`,
      carry_idle: `${basePath}anim_carry_idle.fbx`,
      carry_walk: `${basePath}anim_carry_walking.fbx`,
    }

    await this.loadAnimations(standardAnimations)
  }

  /**
   * Check if all required animations are loaded
   */
  public hasAllAnimations(requiredIds: string[]): boolean {
    return requiredIds.every((id) => this.hasClip(id))
  }

  /**
   * Get missing animations from a required list
   */
  public getMissingAnimations(requiredIds: string[]): string[] {
    return requiredIds.filter((id) => !this.hasClip(id))
  }
}
