import * as THREE from "three"
import { Component } from "@engine/core"
import { AssetManager } from "@engine/assets"

/**
 * Three.js version of GLBRenderer
 * Handles complex GLTF/GLB assets with hierarchies, animations, and materials
 * Supports both shared assets (instancing) and individual assets (cloning)
 */
export class GLBRenderer extends Component {
  private _group: THREE.Group | null = null
  private _assetPath: string
  private _useSharedAsset: boolean
  private _addShadows: boolean
  private _meshes: THREE.Mesh[] = []
  private _isCloned: boolean = false
  private _animationMixer: THREE.AnimationMixer | null = null
  private _animations: THREE.AnimationAction[] = []
  private _skeleton: THREE.Skeleton | null = null

  /**
   * Create a GLBRenderer
   * @param assetPath Path to the GLB/GLTF file
   * @param useSharedAsset If true, uses shared asset instance (default: true, better performance)
   * @param addShadows Whether to add shadows (default: true)
   */
  constructor(
    assetPath: string,
    useSharedAsset: boolean = true,
    addShadows: boolean = true,
  ) {
    super()
    this._assetPath = assetPath
    this._addShadows = addShadows
    this._useSharedAsset = useSharedAsset
  }

  /**
   * Create the hierarchy when the component is created
   */
  protected onCreate(): void {
    this.createHierarchy()
  }

  /**
   * Create the hierarchy by loading the GLB asset
   */
  private async createHierarchy(): Promise<void> {
    if (!this._assetPath) return

    try {
      // Ensure asset is loaded
      const isLoaded = await AssetManager.loadAsset(this._assetPath)
      if (!isLoaded) {
        console.error(`Failed to load asset '${this._assetPath}'`)
        return
      }

      // Create root group for this instance
      this._group = new THREE.Group()
      this._group.name = `glb_${this._assetPath.split("/").pop()}`

      // Add to the GameObject
      this.gameObject.add(this._group)

      if (this._useSharedAsset) {
        // Use shared asset with instancing
        this.createSharedInstance()
      } else {
        // Clone the asset for individual use
        this.createClonedInstance()
      }

      // Set up shadows if requested
      if (this._addShadows) {
        this.setupShadows()
      }

      // Set up animations if available
      this.setupAnimations()

      console.log(
        `GLBRenderer created for '${this._assetPath}' (${this._useSharedAsset ? "shared" : "cloned"}) with ${this._meshes.length} meshes`,
      )
    } catch (error) {
      console.error(
        `Failed to create GLB hierarchy for asset '${this._assetPath}':`,
        error,
      )
    }
  }

  /**
   * Create a shared instance (better performance, shared materials)
   */
  private createSharedInstance(): void {
    const assetGroup = AssetManager.getAssetGroup(this._assetPath)
    if (!assetGroup) {
      console.error(`No asset group found for '${this._assetPath}'`)
      return
    }

    // Create instances of all meshes while preserving hierarchy
    this.createInstanceHierarchy(assetGroup, this._group!)

    this._isCloned = false
  }

  /**
   * Create a cloned instance (full mesh access, individual materials)
   */
  private createClonedInstance(): void {
    const assetGroup = AssetManager.getAssetGroup(this._assetPath)
    if (!assetGroup) {
      console.error(`No asset group found for '${this._assetPath}'`)
      return
    }

    // Clone the entire asset group
    const clonedGroup = assetGroup.clone()
    clonedGroup.name = `${assetGroup.name}_clone_${Math.random().toString(36).substring(2, 7)}`

    // Collect all meshes from the cloned group
    this._meshes = []
    clonedGroup.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        this._meshes.push(object)
      }
    })

    // Add to our group
    this._group!.add(clonedGroup)

    this._isCloned = true
  }

  /**
   * Create instance hierarchy while preserving parent-child relationships
   */
  private createInstanceHierarchy(
    sourceGroup: THREE.Group,
    targetGroup: THREE.Group,
  ): void {
    // Create a mapping to preserve hierarchy
    const nodeMap = new Map<THREE.Object3D, THREE.Object3D>()
    nodeMap.set(sourceGroup, targetGroup)

    // First pass - create instances for all meshes
    sourceGroup.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        // Create instance
        const instanceMesh = new THREE.Mesh(object.geometry, object.material)
        instanceMesh.name = `${object.name}_instance_${Math.random().toString(36).substring(2, 7)}`

        // Copy transformations
        instanceMesh.position.copy(object.position)
        instanceMesh.rotation.copy(object.rotation)
        instanceMesh.scale.copy(object.scale)

        // Map for hierarchy building
        nodeMap.set(object, instanceMesh)

        // Track meshes
        this._meshes.push(instanceMesh)
      } else if (object !== sourceGroup) {
        // Create empty objects for non-mesh nodes
        const emptyObject = new THREE.Object3D()
        emptyObject.name = `${object.name}_instance_${Math.random().toString(36).substring(2, 7)}`

        // Copy transformations
        emptyObject.position.copy(object.position)
        emptyObject.rotation.copy(object.rotation)
        emptyObject.scale.copy(object.scale)

        // Map for hierarchy building
        nodeMap.set(object, emptyObject)
      }
    })

    // Second pass - build hierarchy
    sourceGroup.traverse((object: THREE.Object3D) => {
      if (object !== sourceGroup) {
        const targetObject = nodeMap.get(object)
        const targetParent = nodeMap.get(object.parent!)

        if (targetObject && targetParent) {
          targetParent.add(targetObject)
        }
      }
    })
  }

  /**
   * Set up shadows for all meshes - Three.js native approach
   */
  private setupShadows(): void {
    if (!this._addShadows) return

    // Three.js shadows are just properties on meshes - simple!
    for (const mesh of this._meshes) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  }

  /**
   * Set up animations if available
   */
  private setupAnimations(): void {
    const animations = AssetManager.getAnimations(this._assetPath)
    if (animations.length === 0) return

    // Create animation mixer
    this._animationMixer = new THREE.AnimationMixer(this._group!)

    // Create actions for all animations
    this._animations = []
    for (const clip of animations) {
      const action = this._animationMixer.clipAction(clip)
      this._animations.push(action)
    }

    console.log(
      `Set up ${this._animations.length} animations for '${this._assetPath}'`,
    )
  }

  /**
   * Update method to handle animations
   */
  public update(deltaTime: number): void {
    if (this._animationMixer) {
      this._animationMixer.update(deltaTime)
    }
  }

  /**
   * Play an animation by name
   */
  public playAnimation(
    animationName: string,
    loop: boolean = true,
  ): THREE.AnimationAction | null {
    if (!this._animationMixer) return null

    const action = this._animations.find(
      (action) => action.getClip().name === animationName,
    )
    if (!action) {
      console.warn(`Animation '${animationName}' not found`)
      return null
    }

    action.setLoop(
      loop ? THREE.LoopRepeat : THREE.LoopOnce,
      loop ? Infinity : 1,
    )
    action.play()

    return action
  }

  /**
   * Play animation by index
   */
  public playAnimationByIndex(
    index: number,
    loop: boolean = true,
  ): THREE.AnimationAction | null {
    if (!this._animationMixer || index < 0 || index >= this._animations.length)
      return null

    const action = this._animations[index]
    action.setLoop(
      loop ? THREE.LoopRepeat : THREE.LoopOnce,
      loop ? Infinity : 1,
    )
    action.play()

    return action
  }

  /**
   * Stop an animation by name
   */
  public stopAnimation(animationName: string): void {
    if (!this._animationMixer) return

    const action = this._animations.find(
      (action) => action.getClip().name === animationName,
    )
    if (action) {
      action.stop()
    }
  }

  /**
   * Stop all animations
   */
  public stopAllAnimations(): void {
    for (const action of this._animations) {
      action.stop()
    }
  }

  /**
   * Get all animation names
   */
  public getAnimationNames(): string[] {
    return this._animations.map((action) => action.getClip().name)
  }

  /**
   * Get all meshes
   */
  public get meshes(): THREE.Mesh[] {
    return this._meshes
  }

  /**
   * Get the primary mesh (usually the first mesh)
   */
  public get mainMesh(): THREE.Mesh | null {
    return this._meshes.length > 0 ? this._meshes[0] : null
  }

  /**
   * Get the root group
   */
  public getGroup(): THREE.Group | null {
    return this._group
  }

  /**
   * Get the animation mixer
   */
  public getAnimationMixer(): THREE.AnimationMixer | null {
    return this._animationMixer
  }

  /**
   * Get skeleton if available
   */
  public getSkeleton(): THREE.Skeleton | null {
    return this._skeleton
  }

  /**
   * Check if this renderer uses cloning (true) or shared assets (false)
   */
  public isCloned(): boolean {
    return this._isCloned
  }

  /**
   * Check if the hierarchy has been created
   */
  public isReady(): boolean {
    return this._group !== null && this._meshes.length > 0
  }

  /**
   * Get the asset path
   */
  public getAssetPath(): string {
    return this._assetPath
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
      this._group.visible = visible
    }
  }

  /**
   * Get the visibility of the rendered object
   */
  public getVisible(): boolean {
    return this._group?.visible || false
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
   * Set shadow casting enabled/disabled
   */
  public setCastShadow(enabled: boolean): void {
    for (const mesh of this._meshes) {
      mesh.castShadow = enabled
    }
  }

  /**
   * Set shadow receiving enabled/disabled
   */
  public setReceiveShadow(enabled: boolean): void {
    for (const mesh of this._meshes) {
      mesh.receiveShadow = enabled
    }
  }

  /**
   * Apply a material override to all meshes
   */
  public setMaterialOverride(material: THREE.Material): void {
    for (const mesh of this._meshes) {
      mesh.material = material
    }
  }

  /**
   * Clean up resources when the component is removed
   */
  protected onCleanup(): void {
    // Stop all animations
    this.stopAllAnimations()

    // Dispose animation mixer
    if (this._animationMixer) {
      this._animationMixer.stopAllAction()
      this._animationMixer = null
    }

    // Clean up group
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

            // Dispose materials
            if (object.material) {
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

    // Clear arrays
    this._meshes = []
    this._animations = []
    this._skeleton = null
  }
}
