import * as THREE from "three"
import { Component } from "@engine/core"
import { AssetManager } from "@engine/assets"

/**
 * Rendering modes for FBXRenderer
 */
export enum FBXRenderingMode {
  GPU_INSTANCING = "gpu_instancing",
  SHARED_INSTANCING = "shared_instancing",
  CLONED = "cloned",
}

/**
 * Three.js FBX renderer using the shared AssetManager
 * - Requires assets to be preloaded via AssetManager
 * - Supports GPU instancing, shared instancing, or fully cloned instances
 */
export class FBXRenderer extends Component {
  private _group: THREE.Group | null = null
  private _assetPath: string
  private _material: THREE.Material | null
  private _addShadows: boolean
  private _renderingMode: FBXRenderingMode
  private _mesh: THREE.Mesh | null = null
  private _isCloned: boolean = false
  private _gpuInstanceId: string | null = null
  private _isStatic: boolean

  constructor(
    assetPath: string,
    material?: THREE.Material,
    renderingMode: FBXRenderingMode = FBXRenderingMode.GPU_INSTANCING,
    addShadows: boolean = true,
    isStatic: boolean = false,
  ) {
    super()
    this._assetPath = assetPath
    this._material = material || null
    this._addShadows = addShadows
    this._renderingMode = renderingMode
    this._isStatic = isStatic
  }

  protected onCreate(): void {
    this.createMesh()
  }

  private createMesh(): void {
    if (!this._assetPath) {
      throw new Error("FBXRenderer: No asset path specified")
    }

    // Require asset to be preloaded
    const _ = AssetManager.requireAsset(this._assetPath)

    if (this._renderingMode === FBXRenderingMode.GPU_INSTANCING) {
      try {
        this.tryCreateGPUInstance()
        return
      } catch (e) {
        console.warn(
          `GPU instancing failed for '${this._assetPath}', falling back to object-level instancing:`,
          e,
        )
      }
    }

    this.createObjectLevelInstance()
  }

  private tryCreateGPUInstance(): void {
    const material =
      this._material || AssetManager.getMaterials(this._assetPath)[0]
    if (!material) {
      throw new Error(`No material found for GPU instancing: ${this._assetPath}`)
    }

    this._gpuInstanceId = AssetManager.addGPUInstance(
      this._assetPath,
      this.gameObject,
      material,
      this._isStatic,
    )

    if (!this._gpuInstanceId) {
      throw new Error(
        `GPU instancing failed for '${this._assetPath}' - addGPUInstance returned null`,
      )
    }

    const initiallyVisible = this.gameObject.isEnabled()
    AssetManager.setGPUInstanceVisible(
      this._assetPath,
      this._gpuInstanceId,
      initiallyVisible,
    )
  }

  private createObjectLevelInstance(): void {
    this._group = new THREE.Group()
    this._group.name = `fbx_${this._assetPath.split("/").pop()}`
    this.gameObject.add(this._group)

    if (this._renderingMode === FBXRenderingMode.SHARED_INSTANCING) {
      this.createSharedInstance()
    } else {
      this.createClonedInstance()
    }

    if (this._addShadows && this._group) {
      this.applyShadowsToObject(this._group)
    }
  }

  private createSharedInstance(): void {
    const primaryMesh = AssetManager.getMesh(this._assetPath)
    if (!primaryMesh) {
      throw new Error(`No mesh found in preloaded asset '${this._assetPath}'`)
    }

    this._mesh = new THREE.Mesh(
      primaryMesh.geometry,
      this._material || primaryMesh.material,
    )
    this._mesh.name = `${primaryMesh.name}_instance_${Math.random().toString(36).substring(2, 7)}`
    this._mesh.frustumCulled = false
    this._group!.add(this._mesh)

    AssetManager.trackInstanceCreated(this._assetPath, true, false)
  }

  private createClonedInstance(): void {
    const assetGroup = AssetManager.getAssetGroup(this._assetPath)
    if (!assetGroup) {
      throw new Error(
        `No asset group found for preloaded asset '${this._assetPath}'`,
      )
    }

    const clonedGroup = assetGroup.clone()
    clonedGroup.name = `${assetGroup.name}_clone_${Math.random().toString(36).substring(2, 7)}`

    if (this._material) {
      clonedGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.material = this._material!
          child.frustumCulled = false
        }
      })
    } else {
      clonedGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = false
        }
      })
    }

    this._group!.add(clonedGroup)

    clonedGroup.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && !this._mesh) {
        this._mesh = child
      }
    })

    this._isCloned = true
    AssetManager.trackInstanceCreated(this._assetPath, false, false)
  }

  private setupShadows(mesh: THREE.Mesh): void {
    if (!this._addShadows) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  }

  private applyShadowsToObject(root: THREE.Object3D): void {
    root.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }

  public getGroup(): THREE.Group | null {
    return this._group
  }

  public getMesh(): THREE.Mesh | null {
    return this._mesh
  }

  public getBounds(): THREE.Vector3 | null {
    const originalMesh = AssetManager.getMesh(this._assetPath)
    if (originalMesh) {
      if (!originalMesh.geometry.boundingBox) {
        originalMesh.geometry.computeBoundingBox()
      }
      const boundingBox = originalMesh.geometry.boundingBox!
      const size = new THREE.Vector3()
      boundingBox.getSize(size)
      const gameObjectScale = this.gameObject.scale
      size.multiply(gameObjectScale)
      return size
    }

    if (this._mesh) {
      if (!this._mesh.geometry.boundingBox) {
        this._mesh.geometry.computeBoundingBox()
      }
      const boundingBox = this._mesh.geometry.boundingBox!
      const size = new THREE.Vector3()
      boundingBox.getSize(size)
      return size
    }
    console.warn(`FBXRenderer: Could not calculate bounds for ${this._assetPath}`)
    return null
  }

  public setVisible(visible: boolean): void {
    if (this._group) {
      this._group.visible = visible
    } else if (this._gpuInstanceId) {
      AssetManager.setGPUInstanceVisible(
        this._assetPath,
        this._gpuInstanceId,
        visible,
      )
    }
  }

  public show(): void {
    this.setVisible(true)
  }

  public hide(): void {
    this.setVisible(false)
  }

  protected onCleanup(): void {
    if (this._gpuInstanceId) {
      AssetManager.removeGPUInstance(this._assetPath, this._gpuInstanceId)
      this._gpuInstanceId = null
      return
    }

    if (this._group) {
      if (this._isCloned) {
        this._group.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()
            if (object.material && object.material !== this._material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((m) => m.dispose())
              } else {
                object.material.dispose()
              }
            }
          }
        })
      }

      if (this._group.parent) {
        this._group.parent.remove(this._group)
      }
      this._group = null
    }
    this._mesh = null
  }
}


