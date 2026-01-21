import type { StowKitPack } from "@stowkit/three-loader"
import { StowKitLoader } from "@stowkit/three-loader"
import { PerfLogger } from "@stowkit/reader"
import * as THREE from "three"
import { AudioSystem } from "@systems/audio"
import { InstancedMeshManager } from "@engine/render/InstancedMeshManager"
import type { PrefabCollection, PrefabNode } from "@systems/prefabs"

/**
 * Configuration for StowKitSystem.
 * Game provides this to customize material handling and decoder paths.
 */
export interface StowKitConfig {
  /**
   * Material converter function - called when cloning meshes.
   * Game provides this to apply custom materials (e.g., toon shaders).
   * If not provided, materials are used as-is from the StowKit pack.
   */
  materialConverter?: (material: THREE.Material) => THREE.Material

  /**
   * Decoder paths for StowKit loaders.
   */
  decoderPaths?: {
    basis?: string   // default: "basis/"
    draco?: string   // default: "stowkit/draco/"
    wasm?: string    // default: "stowkit_reader.wasm"
  }
}

/**
 * Mount point definition from prefab collection.
 */
export interface PackMount {
  alias: string
  path: string
}

const DEFAULT_DECODER_PATHS = {
  basis: "basis/",
  draco: "stowkit/draco/",
  wasm: "stowkit_reader.wasm",
}

/**
 * StowKitSystem - Engine-level singleton for loading and managing StowKit assets.
 *
 * Games configure this system with a material converter and then load packs.
 * The system provides a clean API for accessing meshes, textures, animations, and audio.
 *
 * Usage:
 * ```typescript
 * // 1. Configure with material converter (optional)
 * StowKitSystem.getInstance().configure({
 *   materialConverter: (mat) => MaterialUtils.convertToToon(mat, "path/to/gradient.jpg")
 * })
 *
 * // 2. Load packs
 * await StowKitSystem.getInstance().loadPack("Core", coreArrayBuffer)
 *
 * // 3. Preload specific assets
 * await StowKitSystem.getInstance().preloadTextures("Core", ["texture1", "texture2"])
 *
 * // 4. Use assets
 * const texture = StowKitSystem.getInstance().getTexture("texture1")
 * const mesh = StowKitSystem.getInstance().cloneMesh("meshName")
 * ```
 */
export class StowKitSystem {
  private static _instance: StowKitSystem | null = null

  // Configuration
  private config: StowKitConfig = {}
  private decoderPaths = { ...DEFAULT_DECODER_PATHS }

  // Loaded packs by alias
  private packs: Map<string, StowKitPack> = new Map()

  // Asset caches
  private meshes: Map<string, THREE.Group> = new Map()
  private textures: Map<string, THREE.Texture> = new Map()
  private animations: Map<string, THREE.AnimationClip> = new Map()
  private audioFiles: Map<string, THREE.Audio> = new Map()

  // Prefab collection (set by game when loading prefabs)
  private _prefabCollection: PrefabCollection | null = null

  // Loading state
  private loadMeshPromises: Map<string, Promise<void>> = new Map()
  private loadTexturePromises: Map<string, Promise<THREE.Texture | null>> = new Map()

  private constructor() {}

  public static getInstance(): StowKitSystem {
    if (!StowKitSystem._instance) {
      StowKitSystem._instance = new StowKitSystem()
    }
    return StowKitSystem._instance
  }

  /**
   * Configure the StowKit system.
   * Call this before loading any packs.
   */
  public configure(config: StowKitConfig): void {
    this.config = config
    if (config.decoderPaths) {
      this.decoderPaths = { ...DEFAULT_DECODER_PATHS, ...config.decoderPaths }
    }
  }

  /**
   * Get the material converter function (if configured).
   */
  public getMaterialConverter(): ((material: THREE.Material) => THREE.Material) | undefined {
    return this.config.materialConverter
  }

  /**
   * Set the prefab collection (called by game after loading prefabs).
   */
  public setPrefabCollection(collection: PrefabCollection): void {
    this._prefabCollection = collection
  }

  /**
   * Get the prefab collection.
   * @throws Error if prefab collection not set
   */
  public getPrefabCollection(): PrefabCollection {
    if (!this._prefabCollection) {
      throw new Error("StowKitSystem: PrefabCollection not set. Call setPrefabCollection() first.")
    }
    return this._prefabCollection
  }

  /**
   * Get a prefab node by path from the "restaurant" prefab.
   * This is a convenience method for game code that uses the restaurant prefab hierarchy.
   * @param path Path to the prefab node (e.g., "/burger_station_0")
   * @throws Error if prefab not found
   */
  public getPrefab(path: string): PrefabNode {
    const collection = this.getPrefabCollection()
    const restaurantPrefab = collection.getPrefabByName("restaurant")
    if (!restaurantPrefab) {
      throw new Error("StowKitSystem: Restaurant prefab not found")
    }

    const prefab = restaurantPrefab.getNodeByPath(path)
    if (prefab == null) {
      throw new Error(`StowKitSystem: Prefab not found: ${path}`)
    }
    return prefab
  }

  // ============================================
  // Pack Loading
  // ============================================

  /**
   * Load a StowKit pack from an ArrayBuffer.
   * @param alias Unique alias for this pack (e.g., "Core", "Character", "VFX")
   * @param arrayBuffer The .stow file contents
   */
  public async loadPack(alias: string, arrayBuffer: ArrayBuffer): Promise<void> {
    if (this.packs.has(alias)) {
      console.warn(`StowKitSystem: Pack "${alias}" already loaded, skipping`)
      return
    }

    PerfLogger.disable()

    const pack = await StowKitLoader.loadFromMemory(arrayBuffer, {
      basisPath: this.decoderPaths.basis,
      dracoPath: this.decoderPaths.draco,
      wasmPath: this.decoderPaths.wasm,
    })

    this.packs.set(alias, pack)
    console.log(`[StowKitSystem] Pack "${alias}" loaded successfully`)
  }

  /**
   * Get a loaded pack by alias.
   */
  public getPack(alias: string): StowKitPack | null {
    return this.packs.get(alias) ?? null
  }

  /**
   * Check if a pack is loaded.
   */
  public isPackLoaded(alias: string): boolean {
    return this.packs.has(alias)
  }

  // ============================================
  // Texture Loading & Access
  // ============================================

  /**
   * Preload textures from a pack.
   * @param packAlias The pack to load from
   * @param textureNames Array of texture names to preload
   * @param configureTexture Optional function to configure each texture (e.g., set colorSpace)
   */
  public async preloadTextures(
    packAlias: string,
    textureNames: string[],
    configureTexture?: (tex: THREE.Texture) => THREE.Texture
  ): Promise<void> {
    const pack = this.packs.get(packAlias)
    if (!pack) {
      throw new Error(`StowKitSystem: Pack "${packAlias}" not loaded`)
    }

    const defaultConfigure = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      return tex
    }

    const configure = configureTexture ?? defaultConfigure

    for (const name of textureNames) {
      const tex = await pack.loadTexture(name)
      this.textures.set(name, configure(tex))
    }
  }

  /**
   * Get a preloaded texture by name.
   * @throws Error if texture not preloaded
   */
  public getTexture(name: string): THREE.Texture {
    const texture = this.textures.get(name)
    if (!texture) {
      throw new Error(`StowKitSystem: Texture "${name}" not preloaded`)
    }
    return texture
  }

  /**
   * Try to get a texture (returns null if not found).
   */
  public tryGetTexture(name: string): THREE.Texture | null {
    return this.textures.get(name) ?? null
  }

  /**
   * Load a texture on-demand from a pack.
   * Caches the texture for future use.
   * @param packAlias The pack to load from
   * @param assetId The texture asset ID
   * @param configure Optional function to configure the texture
   */
  public async loadTexture(
    packAlias: string,
    assetId: string,
    configure?: (tex: THREE.Texture) => THREE.Texture
  ): Promise<THREE.Texture | null> {
    // Return cached texture if available
    const cached = this.textures.get(assetId)
    if (cached) {
      return cached
    }

    // Check for in-flight request
    const cacheKey = `${packAlias}:${assetId}`
    const existing = this.loadTexturePromises.get(cacheKey)
    if (existing) {
      return existing
    }

    const pack = this.packs.get(packAlias)
    if (!pack) {
      console.warn(`StowKitSystem: Pack "${packAlias}" not loaded`)
      return null
    }

    const promise = (async () => {
      try {
        const tex = await pack.loadTexture(assetId)
        if (configure) {
          configure(tex)
        }
        this.textures.set(assetId, tex)
        return tex
      } catch (error) {
        console.warn(`StowKitSystem: Failed to load texture "${assetId}":`, error)
        return null
      } finally {
        this.loadTexturePromises.delete(cacheKey)
      }
    })()

    this.loadTexturePromises.set(cacheKey, promise)
    return promise
  }

  // ============================================
  // Mesh Loading & Access
  // ============================================

  /**
   * Preload meshes from a pack.
   * @param packAlias The pack to load from
   * @param meshNames Array of mesh names to preload
   */
  public async preloadMeshes(packAlias: string, meshNames: string[]): Promise<void> {
    const pack = this.packs.get(packAlias)
    if (!pack) {
      throw new Error(`StowKitSystem: Pack "${packAlias}" not loaded`)
    }

    for (const name of meshNames) {
      const mesh = await pack.loadMesh(name)
      this.meshes.set(name, mesh)
    }
  }

  /**
   * Preload skinned meshes (characters) from a pack.
   * @param packAlias The pack to load from
   * @param meshNames Array of mesh names to preload
   * @param scale Optional scale to apply (default: 1)
   */
  public async preloadSkinnedMeshes(
    packAlias: string,
    meshNames: string[],
    scale: number = 1
  ): Promise<void> {
    const pack = this.packs.get(packAlias)
    if (!pack) {
      throw new Error(`StowKitSystem: Pack "${packAlias}" not loaded`)
    }

    for (const name of meshNames) {
      const mesh = await pack.loadSkinnedMesh(name)
      if (scale !== 1) {
        mesh.scale.setScalar(scale)
        mesh.updateMatrixWorld(true)
      }
      this.meshes.set(name, mesh)
    }
  }

  /**
   * Get a preloaded mesh by name (original, not cloned).
   * @throws Error if mesh not preloaded
   */
  public getMesh(name: string): THREE.Group {
    const mesh = this.meshes.get(name)
    if (!mesh) {
      throw new Error(`StowKitSystem: Mesh "${name}" not preloaded`)
    }
    return mesh
  }

  /**
   * Check if a mesh is loaded.
   */
  public isMeshLoaded(name: string): boolean {
    return this.meshes.has(name)
  }

  /**
   * Load a mesh on-demand.
   * @param packAlias The pack to load from (searches all packs if not specified)
   * @param meshName The mesh name
   */
  public async loadMesh(meshName: string, packAlias?: string): Promise<void> {
    if (this.meshes.has(meshName)) {
      return
    }

    // Check for in-flight request
    const existing = this.loadMeshPromises.get(meshName)
    if (existing) {
      return existing
    }

    const promise = (async () => {
      // If pack alias specified, use that pack
      if (packAlias) {
        const pack = this.packs.get(packAlias)
        if (!pack) {
          throw new Error(`StowKitSystem: Pack "${packAlias}" not loaded`)
        }
        const mesh = await pack.loadMesh(meshName)
        this.meshes.set(meshName, mesh)
        return
      }

      // Otherwise, try each pack until we find the mesh
      for (const [alias, pack] of this.packs) {
        try {
          const mesh = await pack.loadMesh(meshName)
          this.meshes.set(meshName, mesh)
          return
        } catch {
          // Try next pack
        }
      }

      throw new Error(`StowKitSystem: Mesh "${meshName}" not found in any pack`)
    })()

    this.loadMeshPromises.set(meshName, promise)
    try {
      await promise
    } finally {
      this.loadMeshPromises.delete(meshName)
    }
  }

  /**
   * Clone a mesh with material conversion and shadow settings applied.
   * This is the main method for getting a renderable mesh instance.
   *
   * @param meshName The mesh to clone
   * @param castShadow Whether the mesh should cast shadows (default: true)
   * @param receiveShadow Whether the mesh should receive shadows (default: true)
   */
  public cloneMesh(
    meshName: string,
    castShadow: boolean = true,
    receiveShadow: boolean = true
  ): THREE.Group {
    const original = this.getMesh(meshName)
    const cloned = original.clone()

    const materialConverter = this.config.materialConverter

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh

        // Apply material conversion if configured
        if (materialConverter) {
          const originalMaterial = mesh.material as THREE.Material
          if (originalMaterial) {
            mesh.material = materialConverter(originalMaterial)
          }
        }

        // Apply shadow settings
        mesh.castShadow = castShadow
        mesh.receiveShadow = receiveShadow
      }
    })

    return cloned
  }

  // ============================================
  // Animation Loading & Access
  // ============================================

  /**
   * Preload animations from a pack.
   * @param packAlias The pack to load from
   * @param meshName The mesh to use for loading animations
   * @param animationNames Array of animation names to preload
   */
  public async preloadAnimations(
    packAlias: string,
    meshName: string,
    animationNames: string[]
  ): Promise<void> {
    const pack = this.packs.get(packAlias)
    if (!pack) {
      throw new Error(`StowKitSystem: Pack "${packAlias}" not loaded`)
    }

    const mesh = this.meshes.get(meshName)
    if (!mesh) {
      throw new Error(`StowKitSystem: Mesh "${meshName}" must be loaded before animations`)
    }

    for (const name of animationNames) {
      const { clip } = await pack.loadAnimation(mesh, name)
      this.animations.set(name, clip)
    }
  }

  /**
   * Get a preloaded animation by name.
   * @throws Error if animation not preloaded
   */
  public getAnimation(name: string): THREE.AnimationClip {
    const animation = this.animations.get(name)
    if (!animation) {
      throw new Error(`StowKitSystem: Animation "${name}" not preloaded`)
    }
    return animation
  }

  /**
   * Get all preloaded animations.
   */
  public getAllAnimations(): Map<string, THREE.AnimationClip> {
    return this.animations
  }

  // ============================================
  // Audio Loading & Access
  // ============================================

  /**
   * Preload audio from a pack.
   * Requires AudioSystem.mainListener to be set (VenusGame does this automatically).
   *
   * @param packAlias The pack to load from
   * @param audioNames Array of audio names to preload
   */
  public async preloadAudio(packAlias: string, audioNames: string[]): Promise<void> {
    const pack = this.packs.get(packAlias)
    if (!pack) {
      throw new Error(`StowKitSystem: Pack "${packAlias}" not loaded`)
    }

    const audioListener = AudioSystem.mainListener
    if (!audioListener) {
      throw new Error("StowKitSystem: AudioSystem.mainListener not set")
    }

    for (const name of audioNames) {
      const audio = await pack.loadAudio(name, audioListener)
      this.audioFiles.set(name, audio)
    }
  }

  /**
   * Get a preloaded audio by name.
   * @throws Error if audio not preloaded
   */
  public getAudio(name: string): THREE.Audio {
    const audio = this.audioFiles.get(name)
    if (!audio) {
      throw new Error(`StowKitSystem: Audio "${name}" not preloaded`)
    }
    return audio
  }

  /**
   * Get all preloaded audio files.
   */
  public getAllAudio(): Map<string, THREE.Audio> {
    return this.audioFiles
  }

  // ============================================
  // GPU Instancing Integration
  // ============================================

  /**
   * Register a mesh for GPU instancing.
   * Extracts geometry from the mesh and creates a batch with the material converter applied.
   *
   * @param batchKey Unique key for this batch (used with InstancedRenderer)
   * @param meshName Name of the mesh to use
   * @param maxInstances Maximum number of instances (default: 500)
   * @param castShadow Whether instances cast shadows (default: true)
   * @param receiveShadow Whether instances receive shadows (default: true)
   */
  public async registerMeshForInstancing(
    batchKey: string,
    meshName: string,
    maxInstances: number = 500,
    castShadow: boolean = true,
    receiveShadow: boolean = true
  ): Promise<boolean> {
    // Ensure mesh is loaded
    if (!this.isMeshLoaded(meshName)) {
      try {
        await this.loadMesh(meshName)
      } catch (error) {
        console.error(`StowKitSystem: Failed to load mesh "${meshName}" for instancing`, error)
        return false
      }
    }

    const meshGroup = this.getMesh(meshName)

    // Extract geometry
    const geometry = this.extractGeometry(meshGroup)
    if (!geometry) {
      console.error(`StowKitSystem: Could not extract geometry from "${meshName}"`)
      return false
    }

    // Create material with converter applied
    const material = this.createMaterial(meshGroup)
    if (!material) {
      console.error(`StowKitSystem: Could not create material for "${meshName}"`)
      return false
    }

    // Register batch with InstancedMeshManager
    const manager = InstancedMeshManager.getInstance()
    const batch = manager.getOrCreateBatch(
      batchKey,
      geometry,
      material,
      maxInstances,
      castShadow,
      receiveShadow
    )

    if (!batch) {
      console.error(`StowKitSystem: Failed to create batch "${batchKey}"`)
      return false
    }

    console.log(`[StowKitSystem] Registered batch "${batchKey}" for mesh "${meshName}"`)
    return true
  }

  /**
   * Extract the first BufferGeometry from a mesh group.
   */
  private extractGeometry(meshGroup: THREE.Group): THREE.BufferGeometry | null {
    let geometry: THREE.BufferGeometry | null = null

    meshGroup.traverse((child) => {
      if (!geometry && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.geometry) {
          geometry = mesh.geometry
        }
      }
    })

    return geometry
  }

  /**
   * Create a material from a mesh group, applying the material converter if configured.
   */
  private createMaterial(meshGroup: THREE.Group): THREE.Material | null {
    let material: THREE.Material | null = null

    meshGroup.traverse((child) => {
      if (!material && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const originalMaterial = mesh.material as THREE.Material

        if (originalMaterial) {
          // Apply material converter if configured
          if (this.config.materialConverter) {
            material = this.config.materialConverter(originalMaterial)
          } else {
            // Clone material without conversion
            material = originalMaterial.clone()
          }
        }
      }
    })

    return material
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get bounds of a mesh group.
   */
  public getBounds(meshGroup: THREE.Group): THREE.Vector3 {
    const boundingBox = new THREE.Box3()
    let foundMesh = false

    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        foundMesh = true

        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox()
        }

        if (child.geometry.boundingBox) {
          const localBox = child.geometry.boundingBox.clone()
          if (child.position.length() > 0 || child.scale.length() !== Math.sqrt(3)) {
            localBox.applyMatrix4(child.matrix)
          }
          boundingBox.union(localBox)
        }
      }
    })

    if (!foundMesh || boundingBox.isEmpty()) {
      console.warn("StowKitSystem: No mesh geometry found for bounds calculation")
      return new THREE.Vector3(1, 1, 1)
    }

    const size = new THREE.Vector3()
    boundingBox.getSize(size)
    return size
  }

  /**
   * Dispose of all loaded assets and reset the system.
   */
  public dispose(): void {
    // Dispose textures
    for (const texture of this.textures.values()) {
      texture.dispose()
    }
    this.textures.clear()

    // Dispose meshes
    for (const mesh of this.meshes.values()) {
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose())
            } else {
              child.material.dispose()
            }
          }
        }
      })
    }
    this.meshes.clear()

    // Clear other caches
    this.animations.clear()
    this.audioFiles.clear()
    this.packs.clear()

    this.config = {}
    this.decoderPaths = { ...DEFAULT_DECODER_PATHS }
  }
}
