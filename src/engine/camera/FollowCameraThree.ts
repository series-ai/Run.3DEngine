import * as THREE from "three"
import { Component, GameObject } from "@engine/core"

/**
 * Component that handles camera following a target (like a player)
 * Replicates the BurgerSimCamera behavior from the original system
 */
export class FollowCameraThree extends Component {
  private camera: THREE.PerspectiveCamera | null = null
  private target: GameObject | null = null
  private enabled: boolean = true

  // Camera settings (matching original BurgerSimCamera)
  private cameraHeight: number = 40
  private cameraAlpha: number = 0 // Horizontal angle in radians
  private cameraBeta: number = 0 // Vertical angle in radians
  private cameraFov: number = 0 // Field of view in radians
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

  // Follow smoothness - using speed instead of factor for frame-independent movement
  private followSpeed: number = 4.0 // Lower values = smoother/slower following

  /**
   * Set the camera to control
   */
  public setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera
    this.setupCameraSettings()
  }

  /**
   * Set the target to follow
   */
  public setTarget(target: GameObject): void {
    this.target = target
    if (this.target) {
      this.cameraTarget.copy(this.target.position)
    }
  }

  /**
   * Set the target to follow without jumping cameraTarget (for smooth transitions)
   */
  public setTargetSmooth(target: GameObject): void {
    this.target = target
    // Don't copy target position - let cameraTarget smoothly lerp to new target
  }

  /**
   * Setup camera with BurgerSimCamera settings
   */
  private setupCameraSettings(): void {
    if (!this.camera) return

    // BurgerSimCamera settings (matching original camera script)
    this.cameraHeight = 50 // Default distance
    this.cameraAlpha = this.degreesToRadians(225) // Horizontal angle
    this.cameraBeta = this.degreesToRadians(33) // Vertical angle
    this.cameraFov = this.degreesToRadians(35) // Field of view

    // Set camera FOV (convert from radians to degrees for Three.js)
    this.camera.fov = this.radiansToDegrees(this.cameraFov)
    this.camera.updateProjectionMatrix()

    // Calculate initial camera position
    this.updateCameraPosition()
  }

  /**
   * Enable the follow camera
   */
  public enable(): void {
    this.enabled = true
  }

  /**
   * Disable the follow camera
   */
  public disable(): void {
    this.enabled = false
  }

  /**
   * Check if follow camera is currently enabled
   */
  public isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Called after all updates to ensure smooth following after objects have moved.
   * Using lateUpdate ensures the camera follows the final positions of objects.
   */
  public lateUpdate(deltaTime: number): void {
    if (!this.enabled || !this.camera || !this.target) return

    // Calculate frame-independent lerp factor
    // Using 1 - Math.exp(-speed * deltaTime) for proper frame-independent exponential smoothing
    const lerpFactor = this.followSpeed * deltaTime;
    
    // Smoothly move target towards player position
    this.cameraTarget.lerp(this.target.position, lerpFactor)

    // Update camera position based on target
    this.updateCameraPosition()
  }

  /**
   * Calculate camera position from spherical coordinates
   */
  private updateCameraPosition(): void {
    if (!this.camera) return

    // Convert spherical coordinates (radius, alpha, beta) to Cartesian coordinates
    const x =
      this.cameraHeight * Math.sin(this.cameraBeta) * Math.cos(this.cameraAlpha)
    const y = this.cameraHeight * Math.cos(this.cameraBeta)
    const z =
      this.cameraHeight * Math.sin(this.cameraBeta) * Math.sin(this.cameraAlpha)

    // Position camera relative to target
    this.camera.position.set(
      this.cameraTarget.x + x,
      this.cameraTarget.y + y,
      this.cameraTarget.z + z,
    )

    // Always look at the target
    this.camera.lookAt(this.cameraTarget)
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180
  }

  /**
   * Convert radians to degrees
   */
  private radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI
  }

  /**
   * Reset camera to default settings
   */
  public resetToDefaults(): void {
    this.setupCameraSettings()
    if (this.target) {
      this.cameraTarget.copy(this.target.position)
      this.updateCameraPosition()
    }
  }

  /**
   * Get current camera target position
   */
  public getCameraTarget(): THREE.Vector3 {
    return this.cameraTarget.clone()
  }
}
