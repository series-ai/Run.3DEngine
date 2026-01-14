import * as THREE from "three"

/**
 * Three.js UI utilities for creating consistent world-space UI components
 * Simplified to provide consistent text sizing based on world units
 */
export class UIUtils {

  /**
   * Create world-space UI plane with consistent text sizing
   * Text sizes in pixels directly translate to world units via pixelsPerUnit
   *
   * @param worldWidth Width of the plane in world units
   * @param worldHeight Height of the plane in world units
   * @param options Configuration options
   * @returns Object containing the plane mesh, canvas, context, and texture
   */
  public static createWorldUI(
    worldWidth: number,
    worldHeight: number,
    options: {
      /** Resolution (pixels per world unit) - use same value across all UI for consistent text size */
      pixelsPerUnit?: number
      /** Height above ground (default: 0.05) */
      heightOffset?: number
      /** Rotate 180 degrees for correct text orientation (default: true) */
      flipOrientation?: boolean
    } = {},
  ): {
    plane: THREE.Mesh
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    texture: THREE.CanvasTexture
    worldSize: { width: number; height: number }
    pixelsPerUnit: number
  } {
    const {
      pixelsPerUnit = 128,
      heightOffset = 0.05,
      flipOrientation = true,
    } = options

    // Canvas size = world units * pixels per unit
    // This ensures consistent pixel density across all world UI
    const canvasWidth = Math.round(worldWidth * pixelsPerUnit)
    const canvasHeight = Math.round(worldHeight * pixelsPerUnit)

    // Create canvas
    const canvas = document.createElement("canvas")
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Failed to get 2D context from canvas")
    }

    // Set default text rendering settings
    ctx.textBaseline = "middle"
    ctx.textAlign = "center"
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // Create texture
    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.flipY = true
    texture.generateMipmaps = false

    // Create ground plane geometry and unlit shader material
    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight)

    // Unlit shader material for consistent appearance
    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      fog: false,
      depthWrite: false,
      uniforms: {
        map: { value: texture },
        opacity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          vec4 texColor = texture2D(map, vUv);
          gl_FragColor = vec4(texColor.rgb, texColor.a * opacity);
        }
      `,
    })

    const plane = new THREE.Mesh(geometry, material)
    plane.rotation.x = -Math.PI / 2 // Lay flat on ground
    if (flipOrientation) {
      plane.rotation.z = Math.PI // Rotate 180 degrees for correct orientation
    }
    plane.position.y = heightOffset

    return {
      plane,
      canvas,
      ctx,
      texture,
      worldSize: { width: worldWidth, height: worldHeight },
      pixelsPerUnit,
    }
  }

  /**
   * Helper function to draw rounded rectangles on canvas
   */
  public static drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  // Common UI colors
  public static readonly COLORS = {
    SUCCESS: "#008200",
    PRIMARY: "#3b82f6",
    WARNING: "#f59e0b",
    DANGER: "#ef4444",
    WHITE: "#ffffff",
    BLACK: "#000000",
    GRAY: "#6b7280",
    BACKGROUND: "rgba(0, 0, 0, 0.4)",
    BORDER: "#ffffff",
  }

  // Default font family for game UI - single source of truth
  public static readonly FONT_FAMILY = "'Palanquin Dark', sans-serif"

  /**
   * Initialize CSS variables for UI styling
   * Call this once at app startup (UISystem.initialize() calls this automatically)
   */
  public static initializeCSSVariables(): void {
    document.documentElement.style.setProperty("--game-font", UIUtils.FONT_FAMILY)
  }
}
