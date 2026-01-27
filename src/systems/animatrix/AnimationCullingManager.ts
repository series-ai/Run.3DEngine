import * as THREE from "three"

/**
 * Animation Culling Manager
 * Handles frustum culling and distance-based optimization for animated characters
 */
export class AnimationCullingManager {
  private static instance: AnimationCullingManager | null = null
  
  // Cameras to use for frustum culling
  private cameras: Set<THREE.Camera> = new Set()
  private primaryCamera: THREE.Camera | null = null
  
  // Frustum for culling checks
  private readonly frustum = new THREE.Frustum()
  private readonly projScreenMatrix = new THREE.Matrix4()
  
  // Reusable temp objects
  private readonly _tempSphere = new THREE.Sphere()
  private readonly _tempBox = new THREE.Box3()
  private readonly _tempVec = new THREE.Vector3()
  
  // Settings
  private frustumCullingEnabled: boolean = true
  private distanceCullingEnabled: boolean = false
  private maxUpdateDistance: number = 100  // Units beyond which animations are skipped
  private lodDistance: number = 50          // Units beyond which animations update at reduced rate
  private frustumExpansion: number = 1.2    // Expand frustum by this factor to avoid pop-in
  
  // Frame counter for LOD updates
  private frameCounter: number = 0
  
  private constructor() {}
  
  public static getInstance(): AnimationCullingManager {
    if (!AnimationCullingManager.instance) {
      AnimationCullingManager.instance = new AnimationCullingManager()
    }
    return AnimationCullingManager.instance
  }
  
  /**
   * Add a camera for frustum culling
   */
  public addCamera(camera: THREE.Camera, isPrimary: boolean = false): void {
    this.cameras.add(camera)
    if (isPrimary || !this.primaryCamera) {
      this.primaryCamera = camera
    }
  }
  
  /**
   * Remove a camera from culling
   */
  public removeCamera(camera: THREE.Camera): void {
    this.cameras.delete(camera)
    if (this.primaryCamera === camera) {
      this.primaryCamera = this.cameras.size > 0 ? (this.cameras.values().next().value ?? null) : null
    }
  }
  
  /**
   * Set the primary camera (used for distance calculations)
   */
  public setPrimaryCamera(camera: THREE.Camera): void {
    this.addCamera(camera, true)
  }
  
  /**
   * Enable/disable frustum culling
   */
  public setFrustumCullingEnabled(enabled: boolean): void {
    this.frustumCullingEnabled = enabled
  }
  
  /**
   * Enable/disable distance-based culling
   */
  public setDistanceCullingEnabled(enabled: boolean): void {
    this.distanceCullingEnabled = enabled
  }
  
  /**
   * Set the maximum distance for animation updates
   */
  public setMaxUpdateDistance(distance: number): void {
    this.maxUpdateDistance = distance
  }
  
  /**
   * Set the LOD distance threshold
   */
  public setLodDistance(distance: number): void {
    this.lodDistance = distance
  }
  
  /**
   * Set the frustum expansion factor.
   * Values > 1.0 expand the frustum to avoid pop-in when characters enter view.
   * Default is 1.2 (20% larger frustum)
   */
  public setFrustumExpansion(factor: number): void {
    this.frustumExpansion = Math.max(1.0, factor)
  }
  
  /**
   * Call once per frame before animation updates
   */
  public beginFrame(): void {
    this.frameCounter++
    
    // Update frustum from primary camera
    if (this.primaryCamera && this.frustumCullingEnabled) {
      this.primaryCamera.updateMatrixWorld()
      this.projScreenMatrix.multiplyMatrices(
        this.primaryCamera.projectionMatrix,
        this.primaryCamera.matrixWorldInverse
      )
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix)
    }
  }
  
  /**
   * Check if an object should have its animation updated this frame
   * @param object The object containing the animated model
   * @param boundingRadius Optional bounding radius for frustum check (default 2 units)
   * @returns { shouldUpdate: boolean, isLod: boolean }
   */
  public shouldUpdateAnimation(
    object: THREE.Object3D, 
    boundingRadius: number = 2
  ): { shouldUpdate: boolean; isLod: boolean } {
    // No cameras - always update
    if (!this.primaryCamera || this.cameras.size === 0) {
      return { shouldUpdate: true, isLod: false }
    }
    
    // Get object world position
    object.getWorldPosition(this._tempVec)
    
    // Distance culling check
    if (this.distanceCullingEnabled) {
      const cameraPos = this.primaryCamera.position
      const distSq = this._tempVec.distanceToSquared(cameraPos)
      const maxDistSq = this.maxUpdateDistance * this.maxUpdateDistance
      
      // Beyond max distance - skip update entirely
      if (distSq > maxDistSq) {
        return { shouldUpdate: false, isLod: false }
      }
      
      // In LOD range - update every other frame
      const lodDistSq = this.lodDistance * this.lodDistance
      if (distSq > lodDistSq) {
        // Update every 2nd frame for distant objects
        return { shouldUpdate: (this.frameCounter % 2) === 0, isLod: true }
      }
    }
    
    // Frustum culling check
    if (this.frustumCullingEnabled) {
      this._tempSphere.center.copy(this._tempVec)
      // Expand the bounding sphere by the frustum expansion factor
      // This makes the "visible area" larger to avoid pop-in
      this._tempSphere.radius = boundingRadius * this.frustumExpansion
      
      // Check if in ANY camera's frustum
      let inFrustum = false
      
      // Check primary camera first (most common case)
      if (this.frustum.intersectsSphere(this._tempSphere)) {
        inFrustum = true
      } else {
        // Check other cameras
        for (const camera of this.cameras) {
          if (camera === this.primaryCamera) continue
          
          camera.updateMatrixWorld()
          this.projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
          )
          this.frustum.setFromProjectionMatrix(this.projScreenMatrix)
          
          if (this.frustum.intersectsSphere(this._tempSphere)) {
            inFrustum = true
            break
          }
        }
      }
      
      if (!inFrustum) {
        return { shouldUpdate: false, isLod: false }
      }
    }
    
    return { shouldUpdate: true, isLod: false }
  }
  
  /**
   * Get debug stats
   */
  public getStats(): { 
    cameraCount: number
    frustumCullingEnabled: boolean
    distanceCullingEnabled: boolean
    frameCounter: number
  } {
    return {
      cameraCount: this.cameras.size,
      frustumCullingEnabled: this.frustumCullingEnabled,
      distanceCullingEnabled: this.distanceCullingEnabled,
      frameCounter: this.frameCounter
    }
  }
}
