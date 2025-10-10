import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { SkeletonUtils } from "three-stdlib"

/**
 * Instance-based cache system for skeletal/animated FBX models
 * Uses SkeletonUtils.clone() for proper bone/animation preservation
 * Used internally by AssetManager
 */
export class SkeletonCache {
  private loader = new FBXLoader()
  private originals: Map<string, THREE.Object3D> = new Map()
  private loading: Map<string, Promise<THREE.Object3D>> = new Map()

  public isLoaded(path: string): boolean {
    return this.originals.has(path)
  }

  /**
   * Preload a skeletal FBX model
   */
  public async preload(path: string): Promise<THREE.Object3D> {
    if (this.originals.has(path)) {
      return this.originals.get(path)!
    }
    if (this.loading.has(path)) {
      return this.loading.get(path)!
    }
    const p = this.loader.loadAsync(path).then((object) => {
      this.originals.set(path, object)
      this.loading.delete(path)
      return object
    }).catch((err) => {
      this.loading.delete(path)
      throw err
    })

    this.loading.set(path, p)
    return p
  }

  /**
   * Register a skeletal model directly (for StowKit or other loaders)
   */
  public register(path: string, object: THREE.Object3D): void {
    if (this.originals.has(path)) {
      console.warn(`[SkeletonCache] Model '${path}' already registered`)
      return
    }
    this.originals.set(path, object)
  }

  /**
   * Get a properly cloned skeletal model
   * Uses SkeletonUtils.clone() to preserve bone relationships
   */
  public getClone(path: string): THREE.Object3D | null {
    const original = this.originals.get(path)
    if (!original) return null
    
    // Deep clone skinned meshes/skeletons safely
    const clone = SkeletonUtils.clone(original)
    return clone as THREE.Object3D
  }

  /**
   * Get the original (non-cloned) model
   */
  public getOriginal(path: string): THREE.Object3D | null {
    return this.originals.get(path) || null
  }

  /**
   * Clear all cached models (for cleanup/testing)
   */
  public clear(): void {
    this.originals.clear()
    this.loading.clear()
  }

  /**
   * Get all cached paths
   */
  public getCachedPaths(): string[] {
    return Array.from(this.originals.keys())
  }
}
