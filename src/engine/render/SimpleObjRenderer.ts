import * as THREE from "three"
import { Component } from "@engine/core"
import { AssetManager } from "@engine/assets"

/**
 * Simplified ObjRenderer for Three.js
 * Uses Three.js's default geometry/material sharing - no fancy instancing needed
 */
export class SimpleObjRenderer extends Component {
  private _group: THREE.Group | null = null
  private _assetPath: string
  private _material: THREE.Material | null
  private _addShadows: boolean
  private _mesh: THREE.Mesh | null = null

  /**
   * Create a SimpleObjRenderer
   * @param assetPath Path to the OBJ file
   * @param material Material to apply to the mesh (optional - will use asset materials if not provided)
   * @param addShadows Whether to add shadows (default: true)
   */
  constructor(
    assetPath: string,
    material?: THREE.Material,
    addShadows: boolean = true
  ) {
    super()
    this._assetPath = assetPath
    this._material = material || null
    this._addShadows = addShadows
  }

  /**
   * Create the mesh when the component is created
   */
  protected onCreate(): void {
    this.createMesh()
  }

  /**
   * Create the mesh synchronously using preloaded assets
   */
  private createMesh(): void {
    if (!this._assetPath) {
      throw new Error("SimpleObjRenderer: No asset path specified")
    }

    try {
      // Get the preloaded asset
      const assetGroup = AssetManager.getAssetGroup(this._assetPath)
      if (!assetGroup) {
        throw new Error(
          `Asset not preloaded: '${this._assetPath}'. Make sure to preload all assets first.`
        )
      }

      // Create root group for this instance
      this._group = new THREE.Group()
      this._group.name = `obj_${this._assetPath.split("/").pop()}`

      // Clone the asset group (Three.js will share geometry automatically)
      const clonedGroup = assetGroup.clone()
      
      // Apply material and setup shadows
      clonedGroup.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          // Apply custom material if provided
          if (this._material) {
            child.material = this._material
          }
          
          // Setup shadows
          if (this._addShadows) {
            child.castShadow = true
            child.receiveShadow = true
          }
          
          // Store first mesh reference
          if (!this._mesh) {
            this._mesh = child
          }
        }
      })

      // Add to group
      this._group.add(clonedGroup)
      
      // Add to the GameObject
      this.gameObject.add(this._group)

    } catch (error) {
      console.error(`Failed to create mesh for '${this._assetPath}':`, error)
      throw error
    }
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
   * Get the bounds size for this rendered object
   */
  public getBounds(): THREE.Vector3 | null {
    if (this._mesh && this._mesh.geometry) {
      if (!this._mesh.geometry.boundingBox) {
        this._mesh.geometry.computeBoundingBox()
      }
      
      const boundingBox = this._mesh.geometry.boundingBox!
      const size = new THREE.Vector3()
      boundingBox.getSize(size)
      
      // Apply GameObject scale
      const gameObjectScale = this.gameObject.scale
      size.multiply(gameObjectScale)
      
      return size
    }
    
    return null
  }

  /**
   * Set visibility
   */
  public setVisible(visible: boolean): void {
    if (this._group) {
      this._group.visible = visible
    }
  }

  /**
   * Show the rendered object
   */
  public show(): void {
    this.setVisible(true)
  }

  /**
   * Hide the rendered object
   */
  public hide(): void {
    this.setVisible(false)
  }

  /**
   * Clean up resources when the component is removed
   */
  protected onCleanup(): void {
    if (this._group) {
      // Remove from parent
      if (this._group.parent) {
        this._group.parent.remove(this._group)
      }
      
      // Dispose of materials if they were created specifically for this instance
      // (Three.js will handle geometry sharing automatically)
      
      this._group = null
    }
    
    this._mesh = null
  }
}
