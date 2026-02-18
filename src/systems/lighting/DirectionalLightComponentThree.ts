import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import { VenusGame } from "@engine/core/VenusGame"

/**
 * Simple Three.js directional light component
 * No complex shadow management - just Three.js native properties
 */
export class DirectionalLightComponent extends Component {
  private light: THREE.DirectionalLight

  constructor(
    options: {
      color?: THREE.ColorRepresentation
      intensity?: number
      castShadow?: boolean
      shadowMapSize?: number
      shadowCamera?: {
        left?: number
        right?: number
        top?: number
        bottom?: number
        near?: number
        far?: number
      }
    } = {}
  ) {
    super()

    // Create the light with Three.js defaults
    this.light = new THREE.DirectionalLight(options.color || 0xffffff, options.intensity || 1)

    // Set up shadows if requested - Three.js native approach
    if (options.castShadow) {
      this.light.castShadow = true

      // Configure shadow map
      if (options.shadowMapSize) {
        this.light.shadow.mapSize.width = options.shadowMapSize
        this.light.shadow.mapSize.height = options.shadowMapSize
      }

      // Configure shadow camera
      if (options.shadowCamera) {
        const cam = this.light.shadow.camera
        if (options.shadowCamera.left !== undefined) cam.left = options.shadowCamera.left
        if (options.shadowCamera.right !== undefined) cam.right = options.shadowCamera.right
        if (options.shadowCamera.top !== undefined) cam.top = options.shadowCamera.top
        if (options.shadowCamera.bottom !== undefined) cam.bottom = options.shadowCamera.bottom
        if (options.shadowCamera.near !== undefined) cam.near = options.shadowCamera.near
        if (options.shadowCamera.far !== undefined) cam.far = options.shadowCamera.far
      }
    }
  }

  protected onCreate(): void {
    // Add light to the scene via this GameObject
    this.gameObject.add(this.light)

    // Set light position from GameObject position
    this.light.position.copy(this.gameObject.position)

    // Set light target to look at origin by default (can be changed with setTarget)
    this.light.target.position.set(0, 0, 0)

    // Add target to scene so light direction works properly
    VenusGame.scene.add(this.light.target)
  }

  protected onCleanup(): void {
    // Remove light from the scene
    this.gameObject.remove(this.light)
  }

  /**
   * Get the Three.js light for direct access
   */
  public getLight(): THREE.DirectionalLight {
    return this.light
  }

  /**
   * Set light position
   */
  public setPosition(x: number, y: number, z: number): void {
    this.light.position.set(x, y, z)
  }

  /**
   * Set light target position
   */
  public setTarget(x: number, y: number, z: number): void {
    this.light.target.position.set(x, y, z)
  }

  /**
   * Set light intensity
   */
  public setIntensity(intensity: number): void {
    this.light.intensity = intensity
  }

  /**
   * Set light color
   */
  public setColor(color: THREE.ColorRepresentation): void {
    this.light.color.set(color)
  }

  /**
   * Enable/disable shadow casting
   */
  public setCastShadow(enabled: boolean): void {
    this.light.castShadow = enabled
  }
}
