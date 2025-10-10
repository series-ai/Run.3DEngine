import * as THREE from "three"
import { Component, GameObject } from "@engine/core"
import { FollowCameraThree } from "./FollowCameraThree.ts"
import { FreeCameraThree } from "./FreeCameraThree.ts"

/**
 * Camera modes
 */
export enum CameraMode {
  FOLLOW = "follow",
  FREE = "free",
}

/**
 * Component that manages camera modes and switching between them
 * Handles both follow camera (player following) and free camera (orbit controls)
 */
export class CameraManager extends Component {
  private camera: THREE.PerspectiveCamera | null = null
  private canvas: HTMLCanvasElement | null = null
  private target: GameObject | null = null

  // Camera components
  private followCamera: FollowCameraThree | null = null
  private freeCamera: FreeCameraThree | null = null

  // Current mode
  private currentMode: CameraMode = CameraMode.FOLLOW

  /**
   * Initialize the camera manager with camera and canvas
   */
  public initialize(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ): void {
    this.camera = camera
    this.canvas = canvas

    // Create camera components
    this.setupCameraComponents()
  }

  /**
   * Set the target for cameras to follow/orbit around
   */
  public setTarget(target: GameObject): void {
    this.target = target

    if (this.followCamera) {
      this.followCamera.setTarget(target)
    }

    if (this.freeCamera) {
      this.freeCamera.setTarget(target)
    }
  }

  /**
   * Switch camera mode
   */
  public setCameraMode(mode: CameraMode): void {
    if (this.currentMode === mode) return

    // Disable current mode
    if (this.currentMode === CameraMode.FOLLOW && this.followCamera) {
      this.followCamera.disable()
    } else if (this.currentMode === CameraMode.FREE && this.freeCamera) {
      this.freeCamera.disable()
    }

    // Enable new mode
    this.currentMode = mode

    if (mode === CameraMode.FOLLOW && this.followCamera) {
      // Reset follow camera to defaults for smooth transition
      this.followCamera.resetToDefaults()
      this.followCamera.enable()
    } else if (mode === CameraMode.FREE && this.freeCamera) {
      // Set orbit target to current follow camera target for smooth transition
      if (this.followCamera) {
        const currentTarget = this.followCamera.getCameraTarget()
        this.freeCamera.setOrbitTarget(currentTarget)
      }
      this.freeCamera.enable()
    }
  }

  /**
   * Get current camera mode
   */
  public getCameraMode(): CameraMode {
    return this.currentMode
  }

  /**
   * Toggle between follow and free camera
   */
  public toggleCameraMode(): void {
    const newMode =
      this.currentMode === CameraMode.FOLLOW
        ? CameraMode.FREE
        : CameraMode.FOLLOW
    this.setCameraMode(newMode)
  }

  /**
   * Enable/disable free camera (for external API compatibility)
   */
  public setFreeCameraEnabled(enabled: boolean): void {
    this.setCameraMode(enabled ? CameraMode.FREE : CameraMode.FOLLOW)
  }

  /**
   * Check if free camera is enabled (for external API compatibility)
   */
  public isFreeCameraEnabled(): boolean {
    return this.currentMode === CameraMode.FREE
  }

  /**
   * Setup camera components
   */
  private setupCameraComponents(): void {
    if (!this.camera || !this.canvas) return

    // Create follow camera component
    this.followCamera = new FollowCameraThree()
    this.gameObject.addComponent(this.followCamera)
    this.followCamera.setCamera(this.camera)

    // Create free camera component
    this.freeCamera = new FreeCameraThree()
    this.gameObject.addComponent(this.freeCamera)
    this.freeCamera.setCamera(this.camera, this.canvas)

    // Set target if we have one
    if (this.target) {
      this.setTarget(this.target)
    }

    // Initialize with default mode (FOLLOW enabled, FREE disabled)
    if (this.currentMode === CameraMode.FOLLOW) {
      this.followCamera.enable()
      this.freeCamera.disable()
    } else {
      this.followCamera.disable()
      this.freeCamera.enable()
    }
  }



  /**
   * Get the follow camera component (for external access)
   */
  public getFollowCamera(): FollowCameraThree | null {
    return this.followCamera
  }

  /**
   * Get the free camera component (for external access)
   */
  public getFreeCamera(): FreeCameraThree | null {
    return this.freeCamera
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    // Components will be cleaned up automatically by the GameObject
    this.followCamera = null
    this.freeCamera = null
  }
}
