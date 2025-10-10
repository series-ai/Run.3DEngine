import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Component, GameObject } from "@engine/core"

/**
 * Component that provides free camera controls using OrbitControls
 * Allows orbiting around a target with mouse controls
 */
export class FreeCameraThree extends Component {
  private camera: THREE.PerspectiveCamera | null = null
  private orbitControls: OrbitControls | null = null
  private canvas: HTMLCanvasElement | null = null
  private target: GameObject | null = null

  // Follow target smoothness - using speed for frame-independent movement
  private followSpeed: number = 5.0 // Higher than FollowCamera since orbit controls should be more responsive

  /**
   * Set the camera to control
   */
  public setCamera(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ): void {
    this.camera = camera
    this.canvas = canvas
    this.setupOrbitControls()
  }

  /**
   * Set the target to orbit around
   */
  public setTarget(target: GameObject): void {
    this.target = target
    if (this.orbitControls && this.target) {
      this.orbitControls.target.copy(this.target.position)
      this.orbitControls.update()
    }
  }

  /**
   * Setup orbit controls
   */
  private setupOrbitControls(): void {
    if (!this.camera || !this.canvas) return

    // Create orbit controls
    this.orbitControls = new OrbitControls(this.camera, this.canvas)

    // Configure orbit controls for a good burger shop viewing experience
    this.orbitControls.enableDamping = true
    this.orbitControls.dampingFactor = 0.1
    this.orbitControls.enableZoom = true
    this.orbitControls.minDistance = 5
    this.orbitControls.maxDistance = 100
    this.orbitControls.enablePan = true

    // Initially disabled - will be enabled when component is activated
    this.orbitControls.enabled = false
  }

  /**
   * Enable the free camera controls
   */
  public enable(): void {
    if (this.orbitControls) {
      this.orbitControls.enabled = true
    }
  }

  /**
   * Disable the free camera controls
   */
  public disable(): void {
    if (this.orbitControls) {
      this.orbitControls.enabled = false
    }
  }

  /**
   * Check if free camera is currently enabled
   */
  public isEnabled(): boolean {
    return this.orbitControls ? this.orbitControls.enabled : false
  }

  /**
   * Called after all updates to ensure smooth orbit controls after objects have moved.
   * Using lateUpdate ensures the camera follows the final positions of objects.
   */
  public lateUpdate(deltaTime: number): void {
    if (!this.orbitControls || !this.orbitControls.enabled) return

    // Update orbit target to follow the target if set
    if (this.target) {
      // Calculate frame-independent lerp factor
      const lerpFactor = 1 - Math.exp(-this.followSpeed * deltaTime)
      
      this.orbitControls.target.lerp(
        this.target.position,
        lerpFactor,
      )
    }

    // Update orbit controls
    this.orbitControls.update()
  }

  /**
   * Set the orbit target position directly
   */
  public setOrbitTarget(position: THREE.Vector3): void {
    if (this.orbitControls) {
      this.orbitControls.target.copy(position)
      this.orbitControls.update()
    }
  }

  /**
   * Get the current orbit target
   */
  public getOrbitTarget(): THREE.Vector3 {
    return this.orbitControls
      ? this.orbitControls.target.clone()
      : new THREE.Vector3()
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    if (this.orbitControls) {
      this.orbitControls.dispose()
      this.orbitControls = null
    }
  }
}
