import * as THREE from "three"
import { Component } from "@engine/core"
import { AssetManager } from "@engine/assets"

/**
 * Rendering modes for ObjRenderer
 */
export enum RenderingMode {
  GPU_INSTANCING = "gpu_instancing", // Best performance: InstancedMesh with frustum culling
  SHARED_INSTANCING = "shared_instancing", // Good performance: Shared geometry/materials
  CLONED = "cloned", // Individual objects: Full cloning for unique materials/scaling
}

/**
 * Three.js version of ObjRenderer
 * Loads OBJ files and applies materials using Three.js systems
 * Uses GPU instancing by default for optimal performance
 * REQUIRES ALL ASSETS TO BE PRELOADED - purely synchronous operation
 */
export class ObjRenderer extends Component {
  private _group: THREE.Group | null = null
  private _assetPath: string
  private _material: THREE.Material | null
  private _addShadows: boolean
  private _renderingMode: RenderingMode
  private _mesh: THREE.Mesh | null = null
  private _isCloned: boolean = false
  private _lastScale: THREE.Vector3 | null = null
  private _scaleWarningShown: boolean = false
  private _gpuInstanceId: string | null = null
  private _isStatic: boolean

  /**
   * Create an ObjRenderer
   * @param assetPath Path to the OBJ file
   * @param material Material to apply to the mesh (optional - will use asset materials if not provided)
   * @param renderingMode Rendering mode to use (default: GPU_INSTANCING)
   * @param addShadows Whether to add shadows (default: true)
   * @param isStatic Whether this object is static (won't move after creation) - static objects don't trigger batch updates (default: false)
   */
  constructor(
    assetPath: string,
    material?: THREE.Material,
    renderingMode: RenderingMode = RenderingMode.GPU_INSTANCING,
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

  /**
   * Create the mesh when the component is created
   * REQUIRES ASSET TO BE PRELOADED - will throw error if not
   * Purely synchronous operation
   */
  protected onCreate(): void {
    this.createMesh()
  }

  /**
   * Update method - currently disabled for performance
   */
  protected onUpdate(): void {
    // Scale monitoring disabled for performance - can be re-enabled if needed
  }

  /**
   * Create the mesh synchronously using preloaded assets
   * @throws Error if asset is not preloaded
   */
  private createMesh(): void {
    if (!this._assetPath) {
      throw new Error("ObjRenderer: No asset path specified")
    }

    try {
      // Require asset to be preloaded (throws if not)
      const asset = AssetManager.requireAsset(this._assetPath)

      // Choose rendering path based on mode
      if (this._renderingMode === RenderingMode.GPU_INSTANCING) {
        try {
          this.tryCreateGPUInstance()
          return // GPU instance created successfully
        } catch (gpuError) {
          console.warn(
            `GPU instancing failed for '${this._assetPath}', falling back to object-level instancing:`,
            gpuError,
          )
          // Fall through to object-level instancing
        }
      }

      // Use object-level instancing
      this.createObjectLevelInstance()
    } catch (error) {
      console.error(`Failed to create mesh for '${this._assetPath}':`, error)
      throw error
    }
  }

  /**
   * Try to create a GPU instance using InstancedMesh
   * @throws Error if GPU instancing fails (no fallback)
   */
  private tryCreateGPUInstance(): void {
    const material =
      this._material || AssetManager.getMaterials(this._assetPath)[0]
    if (!material) {
      throw new Error(
        `No material found for GPU instancing: ${this._assetPath}`,
      )
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

    // Set initial visibility based on GameObject's enabled state
    const initiallyVisible = this.gameObject.isEnabled()
    AssetManager.setGPUInstanceVisible(
      this._assetPath,
      this._gpuInstanceId,
      initiallyVisible,
    )
  }

  /**
   * Create object-level instance (shared or cloned)
   */
  private createObjectLevelInstance(): void {
    // Create root group for this instance
    this._group = new THREE.Group()
    this._group.name = `obj_${this._assetPath.split("/").pop()}`

    // Add to the GameObject
    this.gameObject.add(this._group)

    if (this._renderingMode === RenderingMode.SHARED_INSTANCING) {
      this.createSharedInstance()
    } else {
      this.createClonedInstance()
    }

    // Set up shadows if requested
    if (this._addShadows && this._mesh) {
      this.setupShadows(this._mesh)
    }

    // Store initial scale for monitoring if using shared instancing
    if (this._renderingMode === RenderingMode.SHARED_INSTANCING && this._mesh) {
      this._lastScale = this._mesh.scale.clone()
    }
  }

  /**
   * Create a shared instance (instancing - better performance, shared materials)
   */
  private createSharedInstance(): void {
    const primaryMesh = AssetManager.getMesh(this._assetPath)
    if (!primaryMesh) {
      throw new Error(`No mesh found in preloaded asset '${this._assetPath}'`)
    }

    // Create an instance by sharing geometry and materials
    this._mesh = new THREE.Mesh(
      primaryMesh.geometry,
      this._material || primaryMesh.material,
    )
    this._mesh.name = `${primaryMesh.name}_instance_${Math.random().toString(36).substring(2, 7)}`
    this._mesh.frustumCulled = false // Disable Three.js built-in frustum culling

    // Copy transformations from original
    this._mesh.position.copy(primaryMesh.position)
    this._mesh.rotation.copy(primaryMesh.rotation)
    this._mesh.scale.copy(primaryMesh.scale)

    // Add to group
    this._group!.add(this._mesh)

    // Track instance creation
    AssetManager.trackInstanceCreated(this._assetPath, true, false)
  }

  /**
   * Create a cloned instance (independent materials, can be safely scaled)
   */
  private createClonedInstance(): void {
    const assetGroup = AssetManager.getAssetGroup(this._assetPath)
    if (!assetGroup) {
      throw new Error(
        `No asset group found for preloaded asset '${this._assetPath}'`,
      )
    }

    // Clone the entire group
    const clonedGroup = assetGroup.clone()
    clonedGroup.name = `${assetGroup.name}_clone_${Math.random().toString(36).substring(2, 7)}`

    // Apply custom material if provided and disable frustum culling
    if (this._material) {
      clonedGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.material = this._material!
          child.frustumCulled = false // Disable Three.js built-in frustum culling
        }
      })
    } else {
      // Still disable frustum culling even without custom material
      clonedGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = false // Disable Three.js built-in frustum culling
        }
      })
    }

    // Add to group and find primary mesh
    this._group!.add(clonedGroup)

    // Find the primary mesh for shadow setup
    clonedGroup.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && !this._mesh) {
        this._mesh = child
      }
    })

    this._isCloned = true

    // Track instance creation
    AssetManager.trackInstanceCreated(this._assetPath, false, false)
  }

  /**
   * Convert a shared instance to a cloned instance to maintain scale independence
   */
  private convertToClonedInstance(): void {
    if (
      this._renderingMode !== RenderingMode.SHARED_INSTANCING ||
      this._isCloned
    )
      return

    // Store current transform
    const currentPosition = this._mesh?.position.clone()
    const currentRotation = this._mesh?.rotation.clone()
    const currentScale = this._mesh?.scale.clone()
    const currentMaterial = this._mesh?.material

    // Remove current mesh
    if (this._group && this._mesh) {
      this._group.remove(this._mesh)
    }

    // Track the broken instance before creating new one
    AssetManager.trackInstanceBroken(this._assetPath)

    // Create cloned instance
    this._renderingMode = RenderingMode.CLONED
    this.createClonedInstance()

    // Restore transform
    if (this._mesh && currentPosition && currentRotation && currentScale) {
      this._mesh.position.copy(currentPosition)
      this._mesh.rotation.copy(currentRotation)
      this._mesh.scale.copy(currentScale)

      if (currentMaterial) {
        this._mesh.material = currentMaterial
      }
    }
  }

  /**
   * Set up shadows for the mesh
   */
  private setupShadows(mesh: THREE.Mesh): void {
    if (!this._addShadows) return

    // Three.js shadows are just properties
    mesh.castShadow = true
    mesh.receiveShadow = true
  }

  /**
   * Get the primary mesh
   */
  public getMesh(): THREE.Mesh | null {
    return this._mesh
  }

  /**
   * Get all meshes in the renderer
   */
  public getMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []

    if (this._group) {
      this._group.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          meshes.push(object)
        }
      })
    }

    return meshes
  }

  /**
   * Get the root group
   */
  public getGroup(): THREE.Group | null {
    return this._group
  }

  /**
   * Set the material for all meshes
   */
  public setMaterial(material: THREE.Material): void {
    this._material = material

    if (this._group) {
      this._group.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.material = material
        }
      })
    }
  }

  /**
   * Get the current material
   */
  public getMaterial(): THREE.Material | null {
    return this._material
  }

  /**
   * Get the bounds size for this rendered object
   * Returns the size vector for physics/navigation use
   */
  public getBounds(): THREE.Vector3 | null {
    // Try to get bounds from original mesh first (most accurate)
    const originalMesh = AssetManager.getMesh(this._assetPath)
    if (originalMesh) {
      // Calculate bounds from original mesh geometry
      if (!originalMesh.geometry.boundingBox) {
        originalMesh.geometry.computeBoundingBox()
      }

      const boundingBox = originalMesh.geometry.boundingBox!
      const size = new THREE.Vector3()
      boundingBox.getSize(size)

      // Apply GameObject scale
      const gameObjectScale = this.gameObject.scale
      size.multiply(gameObjectScale)

      return size
    }

    // Fallback: try to get bounds from rendered mesh
    if (this._mesh) {
      if (!this._mesh.geometry.boundingBox) {
        this._mesh.geometry.computeBoundingBox()
      }

      const boundingBox = this._mesh.geometry.boundingBox!
      const size = new THREE.Vector3()
      boundingBox.getSize(size)

      return size
    }

    // No bounds available
    console.warn(
      `ObjRenderer: Could not calculate bounds for ${this._assetPath}`,
    )
    return null
  }

  /**
   * Set shadow casting enabled/disabled
   */
  public setCastShadow(enabled: boolean): void {
    if (this._group) {
      this._group.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = enabled
        }
      })
    }
  }

  /**
   * Set shadow receiving enabled/disabled
   */
  public setReceiveShadow(enabled: boolean): void {
    if (this._group) {
      this._group.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.receiveShadow = enabled
        }
      })
    }
  }

  /**
   * Check if the renderer is ready
   */
  public isReady(): boolean {
    return this._group !== null && this._mesh !== null
  }

  /**
   * Check if this renderer uses cloning (true) or shared assets (false)
   */
  public isCloned(): boolean {
    return this._isCloned
  }

  /**
   * Check if this renderer uses shared assets (instancing)
   */
  public isShared(): boolean {
    return (
      this._renderingMode === RenderingMode.SHARED_INSTANCING && !this._isCloned
    )
  }

  /**
   * Get the asset path
   */
  public getAssetPath(): string {
    return this._assetPath
  }

  /**
   * Get the rendering mode
   */
  public getRenderingMode(): RenderingMode {
    return this._renderingMode
  }

  /**
   * Get bounding box of the rendered object
   */
  public getBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3()

    if (this._group) {
      box.setFromObject(this._group)
    }

    return box
  }

  /**
   * Get bounding sphere of the rendered object
   */
  public getBoundingSphere(): THREE.Sphere {
    const sphere = new THREE.Sphere()

    if (this._group) {
      const box = new THREE.Box3().setFromObject(this._group)
      box.getBoundingSphere(sphere)
    }

    return sphere
  }

  /**
   * Set the visibility of the rendered object
   */
  public setVisible(visible: boolean): void {
    if (this._group) {
      // Object-level instancing: use group visibility
      this._group.visible = visible
    } else if (this._gpuInstanceId) {
      // GPU instancing: control via AssetManager
      AssetManager.setGPUInstanceVisible(
        this._assetPath,
        this._gpuInstanceId,
        visible,
      )
    }
  }

  /**
   * Get the visibility of the rendered object
   */
  public getVisible(): boolean {
    if (this._group) {
      // Object-level instancing: use group visibility
      return this._group.visible
    } else if (this._gpuInstanceId) {
      // GPU instancing: check via AssetManager
      return AssetManager.getGPUInstanceVisible(
        this._assetPath,
        this._gpuInstanceId,
      )
    }
    return false
  }

  /**
   * Show the rendered object (convenience method)
   */
  public show(): void {
    this.setVisible(true)
  }

  /**
   * Hide the rendered object (convenience method)
   */
  public hide(): void {
    this.setVisible(false)
  }

  /**
   * Called when the GameObject becomes enabled
   */
  public onEnabled(): void {
    this.setVisible(true)
  }

  /**
   * Called when the GameObject becomes disabled
   */
  public onDisabled(): void {
    this.setVisible(false)
  }

  /**
   * Check if this renderer uses GPU instancing
   */
  public isGPUInstanced(): boolean {
    return this._gpuInstanceId !== null
  }

  /**
   * Check if this renderer is static (won't move after creation)
   */
  public isStatic(): boolean {
    return this._isStatic
  }

  /**
   * Clean up resources when the component is removed
   */
  protected onCleanup(): void {
    // Clean up GPU instance
    if (this._gpuInstanceId) {
      AssetManager.removeGPUInstance(this._assetPath, this._gpuInstanceId)
      this._gpuInstanceId = null
      return // GPU instances don't need further cleanup
    }

    // Track instance destruction before cleanup (object-level instances)
    if (this._mesh) {
      AssetManager.trackInstanceDestroyed(
        this._assetPath,
        this.isShared(),
        false,
      )
    }

    if (this._group) {
      // Remove from parent
      if (this._group.parent) {
        this._group.parent.remove(this._group)
      }

      // Dispose of cloned geometries and materials if this is a clone
      if (this._isCloned) {
        this._group.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose()

            // Only dispose materials if they were cloned
            if (object.material && object.material !== this._material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material) => material.dispose())
              } else {
                object.material.dispose()
              }
            }
          }
        })
      }

      this._group = null
    }

    this._mesh = null
    this._lastScale = null
  }
}
