import * as THREE from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"

/**
 * Post-processing pipeline for Three.js with clean ACES tone mapping approach
 * Includes SMAA/SSAA anti-aliasing and Unreal Bloom
 */
export class PostProcessingThree {
  private composer: EffectComposer
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.Camera

  // Passes
  private renderPass: RenderPass | null = null
  private bloomPass: UnrealBloomPass | null = null
  private outputPass: OutputPass | null = null

  // Settings
  private useBloom: boolean = false // Bloom disabled

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera

    // Create effect composer
    this.composer = new EffectComposer(renderer)

    // Build the initial pipeline
    this.buildPipeline()
  }

  /**
   * Build the complete post-processing pipeline
   */
  private buildPipeline(): void {
    // Clear any existing passes
    this.composer.passes = []

    // 1. Render pass (base scene rendering) - renderer has built-in AA
    this.setupRenderPass()

    // 2. Bloom - always disabled

    // 3. Output pass (always last)
    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)
  }

  /**
   * Setup the base render pass - renderer already has built-in anti-aliasing
   */
  private setupRenderPass(): void {
    // Regular render pass - no need for SSAA or SMAA since renderer has antialias: true
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)
  }

  /**
   * Setup bloom effect for lights and bright surfaces
   */
  private setupBloom(): void {
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4, // bloom strength - moderate for restaurant lighting
      0.85, // bloom radius
      0.8, // bloom threshold - only bright lights
    )
    this.composer.addPass(this.bloomPass)
  }

  /**
   * Render the post-processing pipeline
   */
  public render(): void {
    this.composer.render()
  }

  /**
   * Handle window resize
   */
  public onWindowResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight

    this.composer.setSize(width, height)

    // Update bloom pass (if ever re-enabled)
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height)
    }
  }

  // SSAA/SMAA methods removed - renderer has built-in anti-aliasing

  /**
   * Enable or disable bloom effect - always disabled
   */
  public setBloomEnabled(enabled: boolean): void {
    // Bloom is always disabled
    this.useBloom = false
  }

  /**
   * Update bloom settings
   */
  public updateBloomSettings(settings: {
    strength?: number
    radius?: number
    threshold?: number
  }): void {
    if (!this.bloomPass) {
      console.warn("Bloom pass not available")
      return
    }

    if (settings.strength !== undefined) {
      this.bloomPass.strength = settings.strength
    }
    if (settings.radius !== undefined) {
      this.bloomPass.radius = settings.radius
    }
    if (settings.threshold !== undefined) {
      this.bloomPass.threshold = settings.threshold
    }
  }

  /**
   * Get current settings for debugging
   */
  public getSettings(): any {
    return {
      useBloom: this.useBloom,
      builtInAA: true, // Renderer has antialias: true
      bloomSettings: this.bloomPass
        ? {
            strength: this.bloomPass.strength,
            radius: this.bloomPass.radius,
            threshold: this.bloomPass.threshold,
          }
        : null,
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.composer.dispose()

    // Clean up passes
    if (this.bloomPass) {
      this.bloomPass.dispose()
    }
    if (this.outputPass) {
      this.outputPass.dispose()
    }

    console.log("🎨 Post-processing pipeline disposed")
  }
}
