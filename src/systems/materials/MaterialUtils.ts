import * as THREE from "three"

/**
 * Simple Three.js material utilities
 * Provides common material patterns without complex abstractions
 */
export class MaterialUtils {
  // Centralized default path for the toon gradient ramp used by toon materials
  public static readonly DEFAULT_TOON_GRADIENT_PATH = "assets/cozy_game_general/threeTone.jpg"
  private static textureLoader = new THREE.TextureLoader()
  private static cachedGradientMap: THREE.Texture | null = null

  /**
   * Create a standard PBR material with common settings
   */
  static createStandardMaterial(
    options: {
      color?: THREE.ColorRepresentation
      map?: THREE.Texture
      mapPath?: string // Path to diffuse texture
      roughness?: number
      metalness?: number
      normalMap?: THREE.Texture
      normalMapPath?: string // Path to normal map
      transparent?: boolean
      opacity?: number
    } = {}
  ): THREE.MeshStandardMaterial {
    // Only include defined properties to avoid warnings
    const materialOptions: any = {
      color: options.color || 0xffffff,
      roughness: options.roughness !== undefined ? options.roughness : 0.5,
      metalness: options.metalness !== undefined ? options.metalness : 0.0,
      transparent: options.transparent || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
    }

    // Load textures if paths are provided
    if (options.mapPath) {
      materialOptions.map = MaterialUtils.textureLoader.load(options.mapPath)
    } else if (options.map) {
      materialOptions.map = options.map
    }

    if (options.normalMapPath) {
      materialOptions.normalMap = MaterialUtils.textureLoader.load(options.normalMapPath)
    } else if (options.normalMap) {
      materialOptions.normalMap = options.normalMap
    }

    return new THREE.MeshStandardMaterial(materialOptions)
  }

  /**
   * Create a basic material with a color
   */
  static createBasicMaterial(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color })
  }

  /**
   * Create a Lambert material (good for low-poly/stylized looks)
   */
  static createLambertMaterial(
    options: {
      color?: THREE.ColorRepresentation
      map?: THREE.Texture
    } = {}
  ): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({
      color: options.color || 0xffffff,
      map: options.map,
    })
  }

  /**
   * Create a material with texture
   */
  static createTexturedMaterial(
    textureUrl: string,
    options: {
      color?: THREE.ColorRepresentation
      roughness?: number
      metalness?: number
    } = {}
  ): THREE.MeshStandardMaterial {
    const texture = new THREE.TextureLoader().load(textureUrl)

    return new THREE.MeshStandardMaterial({
      color: options.color || 0xffffff,
      map: texture,
      roughness: options.roughness || 0.5,
      metalness: options.metalness || 0.0,
    })
  }

  /**
   * Create a simple shared material for prototyping
   */
  static createSharedMaterial(
    color: THREE.ColorRepresentation = 0xffffff
  ): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
    })
  }

  /**
   * Get or load the toon gradient map (ramp) texture.
   * The texture is cached after first load. Uses nearest filtering and disables mipmaps
   * to preserve crisp banding of the ramp.
   */
  static getToonGradientMap(
    gradientPath: string = MaterialUtils.DEFAULT_TOON_GRADIENT_PATH
  ): THREE.Texture {
    if (MaterialUtils.cachedGradientMap) {
      return MaterialUtils.cachedGradientMap
    }

    const tex = MaterialUtils.textureLoader.load(gradientPath)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    ;(tex as any).colorSpace = THREE.SRGBColorSpace
    MaterialUtils.cachedGradientMap = tex
    return tex
  }

  /**
   * Create a MeshToonMaterial with optional albedo map and the shared gradient ramp.
   */
  static createToonMaterial(
    options: {
      color?: THREE.ColorRepresentation
      map?: THREE.Texture
      mapPath?: string
      transparent?: boolean
      opacity?: number
      gradientPath?: string
      emissive?: THREE.ColorRepresentation
    } = {}
  ): THREE.MeshToonMaterial {
    const params: any = {
      color: options.color ?? 0xffffff,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1.0,
      gradientMap: MaterialUtils.getToonGradientMap(options.gradientPath),
    }

    if (options.map) params.map = options.map
    if (options.mapPath) params.map = MaterialUtils.textureLoader.load(options.mapPath)
    if (options.emissive !== undefined) params.emissive = options.emissive

    return new THREE.MeshToonMaterial(params)
  }

  /**
   * Convert an arbitrary THREE.Material into a MeshToonMaterial while
   * preserving common properties like color, map and transparency.
   */
  static convertToToon(material: THREE.Material, gradientPath?: string): THREE.MeshToonMaterial {
    const baseMat = material as any

    const toon = new THREE.MeshToonMaterial({
      color: baseMat.color ? baseMat.color.clone() : new THREE.Color(0xffffff),
      map: baseMat.map ?? undefined,
      transparent: baseMat.transparent ?? false,
      opacity: baseMat.opacity ?? 1.0,
      alphaTest: baseMat.alphaTest ?? 0,
      gradientMap: MaterialUtils.getToonGradientMap(gradientPath),
      emissive: baseMat.emissive ? baseMat.emissive.clone() : undefined,
    })
    // Preserve material name so downstream logic (e.g., appearance randomizer) keeps working
    if (baseMat.name) {
      toon.name = baseMat.name
    }
    return toon
  }
}
