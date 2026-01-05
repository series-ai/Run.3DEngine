import * as THREE from "three"
import { Component, VenusGame } from "@engine/core"
import { createParticleEmitter, EmitterConfig, EmitterAssets, ParticleSystem } from "./index"

/**
 * A reusable particle emitter component that can be attached to any GameObject.
 * The particle system becomes a child of the GameObject and follows it automatically.
 */
export class Particle extends Component {
  private emitter: ParticleSystem | null = null
  private config: EmitterConfig
  private assets: EmitterAssets

  /**
   * Creates a new particle emitter component
   * @param config - The emitter configuration
   * @param assets - The assets (textures) for the particles
   */
  constructor(
    config: EmitterConfig,
    assets: EmitterAssets,
  ) {
    super()
    this.config = config
    this.assets = assets
  }

  protected onCreate(): void {
    // Create the particle emitter
    this.emitter = createParticleEmitter(this.config, this.assets)
    
    // Add the particle mesh as a child of the GameObject
    // This makes it follow the GameObject's transform automatically
    if (this.emitter?.object && this.gameObject) {
      this.gameObject.add(this.emitter.object)
      // Keep particles at local origin so they spawn at GameObject's position
      this.emitter.object.position.set(0, 0, 0)
      // Disable frustum culling to ensure particles are always rendered
      this.emitter.object.frustumCulled = false
    }
  }

  /**
   * Trigger a burst of particles at the current GameObject position
   * @param count - Number of particles to emit
   */
  public trigger(count: number = 10): void {
    if (!this.emitter) return
    
    // Since the particle mesh is a child of the GameObject,
    // we use local position (0,0,0) to spawn at the GameObject's position
    const localOrigin = new THREE.Vector3(0, 0, 0)
    this.emitter.setOrigin(localOrigin)
    this.emitter.burst(localOrigin, count)
  }

  /**
   * Update the particle system
   * @param deltaTime - Time since last frame in seconds
   */
  public update(deltaTime: number): void {
    if (!this.emitter) return

    // Update the particle system
    this.emitter.update(deltaTime, VenusGame.camera)
  }

  /**
   * Get the underlying particle system
   */
  public getEmitter(): ParticleSystem | null {
    return this.emitter
  }

  /**
   * Clean up the particle system
   */
  protected onCleanup(): void {
    // Remove particle mesh from GameObject (it will be disposed with the GameObject)
    if (this.emitter?.object && this.gameObject) {
      this.gameObject.remove(this.emitter.object)
    }
    this.emitter = null
  }
}
