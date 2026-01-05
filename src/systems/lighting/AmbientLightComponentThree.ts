import * as THREE from "three"
import { Component } from "@engine/core/GameObject"

/**
 * Enhanced Three.js ambient light component that mimics Babylon.js HemisphericLight
 * Provides directional ambient lighting with ground color support
 */
export class AmbientLightComponent extends Component {
  private ambientLight!: THREE.AmbientLight
  private hemisphereLight: THREE.HemisphereLight | null = null
  private useHemispheric: boolean = false

  constructor(
    options: {
      color?: THREE.ColorRepresentation
      intensity?: number
      groundColor?: THREE.ColorRepresentation // If provided, creates hemispheric lighting
      direction?: THREE.Vector3 // For hemispheric lighting
    } = {},
  ) {
    super()

    // If ground color is provided, use hemispheric lighting (like Babylon.js)
    if (options.groundColor !== undefined) {
      this.useHemispheric = true
      this.hemisphereLight = new THREE.HemisphereLight(
        options.color || 0xffffff, // sky color
        options.groundColor, // ground color
        options.intensity || 0.4,
      )

      // Set direction if provided
      if (options.direction) {
        this.hemisphereLight.position.copy(options.direction)
      }
    } else {
      // Use simple ambient light
      this.ambientLight = new THREE.AmbientLight(
        options.color || 0x404040,
        options.intensity || 0.4,
      )
    }
  }

  protected onCreate(): void {
    // Add the appropriate light to the scene via this GameObject
    if (this.useHemispheric && this.hemisphereLight) {
      this.gameObject.add(this.hemisphereLight)
    } else {
      this.gameObject.add(this.ambientLight)
    }
  }

  protected onCleanup(): void {
    // Remove light from the scene
    if (this.useHemispheric && this.hemisphereLight) {
      this.gameObject.remove(this.hemisphereLight)
    } else {
      this.gameObject.remove(this.ambientLight)
    }
  }

  /**
   * Get the Three.js light for direct access
   */
  public getLight(): THREE.Light {
    return this.useHemispheric && this.hemisphereLight
      ? this.hemisphereLight
      : this.ambientLight
  }

  /**
   * Set light intensity
   */
  public setIntensity(intensity: number): void {
    if (this.useHemispheric && this.hemisphereLight) {
      this.hemisphereLight.intensity = intensity
    } else {
      this.ambientLight.intensity = intensity
    }
  }

  /**
   * Set sky color (main color)
   */
  public setColor(color: THREE.ColorRepresentation): void {
    if (this.useHemispheric && this.hemisphereLight) {
      this.hemisphereLight.color.set(color)
    } else {
      this.ambientLight.color.set(color)
    }
  }

  /**
   * Set ground color (only works with hemispheric lighting)
   */
  public setGroundColor(color: THREE.ColorRepresentation): void {
    if (this.useHemispheric && this.hemisphereLight) {
      this.hemisphereLight.groundColor.set(color)
    }
  }
}
