import * as THREE from "three"
import { Component } from "@engine/core"
import { AssetManager } from "@engine/assets"

/**
 * Three.js Skeletal renderer for animated FBX models
 * - Uses AssetManager for preloading coordination
 * - Uses SkeletonCache for proper skeletal cloning
 * - Specifically designed for animated characters
 * - Always cloned, always has shadows, never static
 */
export class SkeletalRenderer extends Component {
  private _group: THREE.Group | null = null
  private _assetPath: string
  private _material: THREE.Material | null
  private _skeletalModel: THREE.Object3D | null = null

  constructor(assetPath: string, material?: THREE.Material) {
    super()
    this._assetPath = assetPath
    this._material = material || null
  }

  protected onCreate(): void {
    this.createSkeletalMesh()
  }

  private createSkeletalMesh(): void {
    if (!this._assetPath) {
      throw new Error("SkeletalRenderer: No asset path specified")
    }

    // Create wrapper group for this instance
    this._group = new THREE.Group()
    this._group.name = `skeletal_${this._assetPath.split("/").pop()}`
    this.gameObject.add(this._group)

    // Get properly cloned skeletal model from AssetManager's skeleton cache
    this._skeletalModel = AssetManager.getSkeletalClone(this._assetPath)

    if (!this._skeletalModel) {
      throw new Error(
        `No skeletal model found for '${this._assetPath}'. Make sure to preload with AssetManager.preloadSkeletalModel() first.`
      )
    }

    // Apply custom material if provided
    if (this._material) {
      this._skeletalModel.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.material = this._material!
          child.frustumCulled = false
        }
      })
    } else {
      this._skeletalModel.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = false
        }
      })
    }

    this._group.add(this._skeletalModel)

    // Always apply shadows for characters
    this.applyShadowsToGroup(this._group)
  }

  private applyShadowsToGroup(group: THREE.Group): void {
    group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }

  // ========== Public API ==========

  /**
   * Get the wrapper group (attached to GameObject)
   */
  public getGroup(): THREE.Group | null {
    return this._group
  }

  /**
   * Get the skeletal model (for animation setup)
   */
  public getSkeletalModel(): THREE.Object3D | null {
    return this._skeletalModel
  }

  /**
   * Get the asset path being rendered
   */
  public getAssetPath(): string {
    return this._assetPath
  }

  /**
   * Enable or disable visibility
   */
  public setVisible(visible: boolean): void {
    if (this._group) {
      this._group.visible = visible
    }
  }

  /**
   * Get visibility state
   */
  public isVisible(): boolean {
    return this._group?.visible ?? false
  }

  // ========== Component Lifecycle ==========

  protected onCleanup(): void {
    if (this._group) {
      this.gameObject.remove(this._group)
    }
    // Note: Don't track instance destruction since AssetManager doesn't track SkeletonCache instances
  }

  public onEnabled(): void {
    this.setVisible(true)
  }

  public onDisabled(): void {
    this.setVisible(false)
  }
}
