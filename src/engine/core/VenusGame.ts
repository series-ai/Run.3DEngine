import * as THREE from "three"
import { PhysicsSystem } from "@systems/physics/PhysicsSystem.ts"
import { ComponentUpdater } from "./ComponentUpdater"
import { InputManager } from "@systems/input"
import { TweenSystem } from "@systems/math"
import VenusAPI from "@series-inc/rundot-game-sdk/api"
import { AudioSystem } from "@systems/audio"
import { UISystem } from "@systems/ui"
import { InstancedMeshManager } from "@engine/render/InstancedMeshManager"
import { AnimationCullingManager } from "@systems/animatrix/AnimationCullingManager"

/**
 * Configuration interface for VenusGame.
 * Override getConfig() in your game class to customize these settings.
 */
export interface VenusGameConfig {
  /** Background color as hex number (default: 0x000000) */
  backgroundColor?: number
  /** Enable antialiasing for smoother edges (default: true) */
  antialias?: boolean
  /** Enable shadow mapping (default: true) */
  shadowMapEnabled?: boolean
  /** Shadow map type: 'vsm' for smoother shadows, 'pcf_soft' for softer edges (default: 'vsm') */
  shadowMapType?: "vsm" | "pcf_soft"
  /** Tone mapping: 'aces' for filmic, 'linear' for basic, 'none' to disable (default: 'aces') */
  toneMapping?: "aces" | "linear" | "none"
  /** Tone mapping exposure (default: 1.0) */
  toneMappingExposure?: number
  /** Enable audio system and auto-create listener (default: true) */
  audioEnabled?: boolean
}

/** Default configuration values */
const DEFAULT_CONFIG: Required<VenusGameConfig> = {
  backgroundColor: 0x000000,
  antialias: true,
  shadowMapEnabled: true,
  shadowMapType: "vsm",
  toneMapping: "aces",
  toneMappingExposure: 1.0,
  audioEnabled: true,
}

/**
 * Three.js version of VenusGame
 * Clean implementation without Babylon.js dependencies
 */
export abstract class VenusGame {
  // Static references for global access
  private static _instance: VenusGame
  private static _scene: THREE.Scene
  private static _renderer: THREE.WebGLRenderer
  private static _camera: THREE.PerspectiveCamera

  // Instance properties
  protected canvas: HTMLCanvasElement
  protected renderer: THREE.WebGLRenderer
  protected scene: THREE.Scene
  protected camera: THREE.PerspectiveCamera
  private resizeListener: () => void
  private isDisposed: boolean = false
  private animationId: number | null = null
  private clock: THREE.Clock // Made private to prevent delta time issues
  private maxDeltaTime: number = 1 / 30 // Cap delta time at 33ms (30 FPS minimum)

  // Configuration
  protected config: Required<VenusGameConfig>

  // Audio listener (auto-created if audioEnabled)
  protected audioListener: THREE.AudioListener | null = null

  // Animation culling
  private animationCullingManager: AnimationCullingManager | null = null

  /**
   * Get the current elapsed time (not delta time)
   * NOTE: For delta time, use the parameter passed to preRender() method
   * This prevents accidental multiple getDelta() calls which cause frame rate dependent behavior
   */
  protected getElapsedTime(): number {
    return this.clock.getElapsedTime()
  }

  /**
   * Override this method to provide game-specific configuration.
   * The returned config is merged with DEFAULT_CONFIG.
   * @example
   * protected getConfig(): VenusGameConfig {
   *   return {
   *     backgroundColor: 0x0077b6,
   *     toneMapping: "aces",
   *   }
   * }
   */
  protected getConfig(): VenusGameConfig {
    return {}
  }

  /**
   * Get the active VenusGame instance
   */
  public static get instance(): VenusGame {
    return VenusGame._instance
  }

  /**
   * Get the active Three.js scene
   */
  public static get scene(): THREE.Scene {
    return VenusGame._scene
  }

  /**
   * Get the active Three.js renderer
   */
  public static get renderer(): THREE.WebGLRenderer {
    return VenusGame._renderer
  }

  /**
   * Get the active Three.js camera
   */
  public static get camera(): THREE.PerspectiveCamera {
    return VenusGame._camera
  }

  // ===== Animation Culling API =====

  /**
   * Set the camera used for animation frustum culling.
   * When set, animation updates are skipped for characters outside the camera's view.
   * @param camera The camera to use for culling (pass null to disable)
   * @param frustumExpansion How much to expand the frustum (1.2 = 20% larger, avoids pop-in). Default: 1.2
   */
  public static setAnimationCullingCamera(
    camera: THREE.Camera | null,
    frustumExpansion: number = 1.2
  ): void {
    const instance = VenusGame._instance
    if (!instance) return

    if (camera) {
      instance.animationCullingManager = AnimationCullingManager.getInstance()
      instance.animationCullingManager.addCamera(camera, true)
      instance.animationCullingManager.setFrustumCullingEnabled(true)
      instance.animationCullingManager.setDistanceCullingEnabled(false)
      instance.animationCullingManager.setFrustumExpansion(frustumExpansion)
    } else {
      // Disable culling
      if (instance.animationCullingManager) {
        instance.animationCullingManager.setFrustumCullingEnabled(false)
      }
    }
  }

  /**
   * Get the animation culling manager for advanced configuration.
   * Use this to enable distance culling, add multiple cameras, adjust LOD settings, etc.
   */
  public static getAnimationCulling(): AnimationCullingManager {
    return AnimationCullingManager.getInstance()
  }

  /**
   * Static factory method to create, initialize and start a VenusGame instance
   * @returns A fully initialized and running VenusGame instance
   */
  public static async create<T extends VenusGame>(
    this: new () => T,
  ): Promise<T> {
    // Create the instance
    const instance = new this()

    // Set static references
    VenusGame._instance = instance
    VenusGame._scene = instance.scene
    VenusGame._renderer = instance.renderer
    VenusGame._camera = instance.camera

    const context = await VenusAPI.initializeAsync({
      usePreloader: true
    })
    console.log("[Venus SDK] Venus API initialized: ", context)

    VenusAPI.analytics.trackFunnelStep(1, "Venus Initialized")

    // const insets = context?.
    // if (insets) {
    //   console.log(`[DEBUG] Hud Insets: `, insets)
    //   UISystem.setInsets(insets)
    // }

    VenusAPI.lifecycles.onResume(() => {
      console.log(`[DEBUG] OnResume()`)
      window.focus()
      instance.resume()
    })

    VenusAPI.lifecycles.onPause(() => {
      console.log(`[DEBUG] OnPause()`)
      instance.pause()
    })

    // Initialize physics system (will be Rapier)
    await PhysicsSystem.initialize()

    // Initialize input system
    InputManager.initialize()

    // Initialize lighting system
    LightingSystem.initialize(instance.scene)

    // Initialize component updater
    ComponentUpdater.initialize(instance.scene)

    // Initialize instanced mesh manager
    InstancedMeshManager.getInstance().initialize(instance.scene)

    // Set up audio listener (before game code runs so it can use audio)
    instance.setupAudioListener()

    // Call the custom implementation's onInitialize method
    await instance.onStart()

    // Start the render loop
    instance.startRenderLoop()

    await VenusAPI.preloader.hideLoadScreen()

    window.focus()

    return instance
  }

  resume() {
    this.clock.getDelta()
    this.isPaused = false
    AudioSystem.mainListener?.setMasterVolume(this.prevMasterVolume ?? 1)
  }

  pause() {
    this.isPaused = true
    this.prevMasterVolume = AudioSystem.mainListener?.getMasterVolume()
    AudioSystem.mainListener?.setMasterVolume(0)
  }

  /**
   * Create a new VenusGame
   */
  constructor() {
    // Merge game config with defaults
    this.config = { ...DEFAULT_CONFIG, ...this.getConfig() }

    // Look for an existing canvas
    const existingCanvas = document.getElementById("renderCanvas")

    if (existingCanvas instanceof HTMLCanvasElement) {
      // Use the existing canvas element
      this.canvas = existingCanvas
    } else {
      // Create a new canvas element
      const newCanvas = document.createElement("canvas")
      newCanvas.id = "renderCanvas"
      newCanvas.style.width = "100%"
      newCanvas.style.height = "100%"
      newCanvas.style.display = "block"
      document.body.appendChild(newCanvas)
      this.canvas = newCanvas
    }

    // Create the Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.config.antialias,
      powerPreference: "high-performance",
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)

    // Cap pixel ratio for performance, especially on high-DPI mobile devices like iPhone
    // iPhone can have pixel ratios of 3 or higher which severely impacts performance
    // Use very low pixel ratio (1.0) for iPhone to ensure smooth 60fps gameplay
    let maxPixelRatio: number
    if (this.isIPhone()) {
      maxPixelRatio = 1.0 // Lowest quality for maximum performance on iPhone
    } else if (this.isMobileDevice()) {
      maxPixelRatio = 2 // Other mobile devices can handle a bit more
    } else {
      maxPixelRatio = window.devicePixelRatio // Desktop gets full resolution
    }
    const cappedPixelRatio = Math.min(window.devicePixelRatio, maxPixelRatio)
    this.renderer.setPixelRatio(cappedPixelRatio)
    console.log(
      `[VenusGame] Device pixel ratio: ${window.devicePixelRatio}, Using: ${cappedPixelRatio} (iPhone: ${this.isIPhone()})`,
    )

    // Apply rendering configuration from config
    this.applyRenderingConfig()

    // Create the Three.js scene
    this.scene = new THREE.Scene()

    // Apply background color from config
    this.scene.background = new THREE.Color(this.config.backgroundColor)

    // Create the Three.js camera
    this.camera = new THREE.PerspectiveCamera(
      75, // fov
      window.innerWidth / window.innerHeight, // aspect
      0.1, // near
      1000, // far
    )

    // Create clock for delta time
    this.clock = new THREE.Clock()

    // Set up window resize handling
    this.resizeListener = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)

      // Re-apply capped pixel ratio on resize
      let maxPixelRatio: number
      if (this.isIPhone()) {
        maxPixelRatio = 1.25 // Very conservative for iPhone
      } else if (this.isMobileDevice()) {
        maxPixelRatio = 2
      } else {
        maxPixelRatio = window.devicePixelRatio
      }
      const cappedPixelRatio = Math.min(window.devicePixelRatio, maxPixelRatio)
      this.renderer.setPixelRatio(cappedPixelRatio)
    }
    window.addEventListener("resize", this.resizeListener)
  }

  /**
   * Apply rendering configuration from config
   */
  private applyRenderingConfig(): void {
    // Shadow map configuration
    this.renderer.shadowMap.enabled = this.config.shadowMapEnabled
    this.renderer.shadowMap.type =
      this.config.shadowMapType === "pcf_soft"
        ? THREE.PCFSoftShadowMap
        : THREE.VSMShadowMap
    this.renderer.shadowMap.autoUpdate = true

    // Color space
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // Tone mapping
    if (this.config.toneMapping === "none") {
      this.renderer.toneMapping = THREE.NoToneMapping
    } else if (this.config.toneMapping === "linear") {
      this.renderer.toneMapping = THREE.LinearToneMapping
      this.renderer.toneMappingExposure = this.config.toneMappingExposure
    } else {
      // Default: ACES filmic
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping
      this.renderer.toneMappingExposure = this.config.toneMappingExposure
    }
  }

  /**
   * Set up audio listener if enabled in config.
   * Attaches listener to camera and sets AudioSystem.mainListener.
   */
  private setupAudioListener(): void {
    if (!this.config.audioEnabled) return

    this.audioListener = new THREE.AudioListener()
    this.camera.add(this.audioListener)
    AudioSystem.mainListener = this.audioListener

    console.log("[VenusGame] Audio listener initialized and attached to camera")
  }

  /**
   * Check if running on an iPhone/iPad specifically
   */
  private isIPhone(): boolean {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent)
  }

  /**
   * Check if running on a mobile device
   */
  private isMobileDevice(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    )
  }

  private isPaused: boolean = false
  private prevMasterVolume: number | undefined = undefined

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    // Set up visibility handling to pause delta time when tab is hidden
    this.setupVisibilityHandling()

    const animate = () => {
      // IMPORTANT: Only call getDelta() once per frame here
      // This ensures consistent delta time throughout the entire frame
      let deltaTime = this.clock.getDelta()

      // Cap delta time to prevent physics explosions when returning from tab switch
      if (deltaTime > this.maxDeltaTime) {
        deltaTime = this.maxDeltaTime
      }

      if (!this.isPaused) {
        // Step physics simulation
        PhysicsSystem.step(deltaTime)

        // Update tween system (before component updates so tweens apply first)
        TweenSystem.update(deltaTime)

        // Update animation culling frustum BEFORE component updates
        // This allows AnimationGraphComponents to check visibility during their update()
        this.animationCullingManager?.beginFrame()

        // Update components
        ComponentUpdater.update(deltaTime)

        // Late update components
        ComponentUpdater.lateUpdate(deltaTime)

        // Update instanced mesh matrices
        InstancedMeshManager.getInstance().updateAllBatches()
      }

      // Pre-render hook
      this.preRender(deltaTime)

      // Render the scene (can be overridden for post-processing)
      this.animationId = requestAnimationFrame(animate)

      this.render()
    }
    animate()
  }

  /**
   * Setup visibility change handling to pause/resume delta time
   */
  private setupVisibilityHandling(): void {
    console.log("[DEBUG] setting up visibility handlers...")

    // Handle tab visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        console.log("🌙 Tab hidden - pausing game time")
        // Clock will continue but we'll clear the delta when we return
      } else {
        console.log("☀️ Tab visible - resuming with fresh delta time")
        // Clear any accumulated delta time to prevent huge jumps
        this.clock.getDelta()
      }
    })

    // Handle window focus changes
    window.addEventListener("focus", () => {
      console.log("🔄 Window focused - clearing delta time")
      // Clear delta time to prevent any accumulated time from causing issues
      this.clock.getDelta()
    })

    window.addEventListener("blur", () => {
      console.log("🔄 Window blurred")
      // Just log for now - the delta will be cleared when focus returns
    })
  }

  /**
   * Render method. Can be overridden for custom rendering pipelines.
   */
  protected render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Abstract method that derived classes must implement for game-specific initialization
   */
  protected abstract onStart(): Promise<void>

  /**
   * Abstract method called every frame before rendering
   * @param deltaTime Time in seconds since last frame - use this for all time-based calculations
   * IMPORTANT: Do NOT access this.clock.getDelta() directly - use the deltaTime parameter!
   */
  protected abstract preRender(deltaTime: number): void

  /**
   * Abstract method that derived classes must implement for game cleanup
   */
  protected abstract onDispose(): Promise<void>

  /**
   * Dispose of the game, cleaning up all resources
   * This will stop the render loop and clean up any created resources
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) {
      return // Already disposed
    }

    this.isDisposed = true

    // Stop the render loop
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // Call the custom implementation's cleanup
    await this.onDispose()

    // Clean up systems
    PhysicsSystem.dispose()
    LightingSystem.dispose()
    ComponentUpdater.dispose()
    InstancedMeshManager.getInstance().dispose()

    // Remove event listeners
    window.removeEventListener("resize", this.resizeListener)

    // Dispose of Three.js resources
    this.scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (object.material instanceof THREE.Material) {
          object.material.dispose()
        } else if (Array.isArray(object.material)) {
          object.material.forEach((material: THREE.Material) =>
            material.dispose(),
          )
        }
      }
    })

    this.renderer.dispose()

    // If we created the canvas, remove it from the DOM
    if (this.canvas.id === "renderCanvas" && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
  }
}

// Placeholder classes for the Three.js systems (to be implemented)

class LightingSystem {
  static initialize(scene: THREE.Scene): void {
    // Three.js lighting is just adding lights to the scene - no complex system needed!
  }

  static dispose(): void {
    // Lights are disposed with the scene - no cleanup needed
  }
}
