import type { StowKitPack } from "@stowkit/three-loader"
import { StowKitLoader } from "@stowkit/three-loader"
import { PerfLogger } from "@stowkit/reader"
import * as THREE from "three"
import { AudioSystem } from "@systems/audio"
import { InstancedMeshManager } from "@engine/render/InstancedMeshManager"
import { PrefabCollection, PrefabNode } from "@systems/prefabs"

/**
 * Configuration for loading from build.json.
 */
export interface StowKitLoadConfig {
  /**
   * Material converter function - called when cloning meshes.
   * Game provides this to apply custom materials (e.g., toon shaders).
   * If not provided, materials are used as-is.
   */
  materialConverter?: (material: THREE.Material) => THREE.Material

  /**
   * Function to fetch blob data from CDN.
   * Required for loading packs from mount paths.
   */
  fetchBlob: (path: string) => Promise<Blob>

  /**
   * Decoder paths for StowKit loaders.
   */
  decoderPaths?: {
    basis?: string   // default: "basis/"
    draco?: string   // default: "stowkit/draco/"
    wasm?: string    // default: "stowkit_reader.wasm"
  }
}

const DEFAULT_DECODER_PATHS = {
  basis: "basis/",
  draco: "stowkit/draco/",
  wasm: "stowkit_reader.wasm",
}

/**
 * StowKitSystem - Simple asset loading from build.json.
 *
 * Usage:
 * ```typescript
 * // Load everything from build.json - that's it!
 * const prefabs = await StowKitSystem.getInstance().loadFromBuildJson(buildJson, {
 *   materialConverter: (mat) => MaterialUtils.convertToToon(mat),
 *   fetchBlob: (path) => VenusAPI.cdn.fetchBlob(path)
 * })
 *
 * // Register instancing batches (optional, for frequently spawned items)
 * await StowKitSystem.getInstance().registerMeshForInstancing("burger", "restaurant_display_Burger", 100)
 *
 * // Use prefabs - meshes load automatically
 * const burgerStation = PrefabLoader.instantiate(prefabs.getPrefabByName("burger_station"))
 * ```
 */
export class StowKitSystem {
  private static _instance: StowKitSystem | null = null

  // Configuration
  private materialConverter?: (material: THREE.Material) => THREE.Material
  private decoderPaths = { ...DEFAULT_DECODER_PATHS }
  private fetchBlob?: (path: string) => Promise<Blob>

  // Loaded packs by alias
  private packs: Map<string, StowKitPack> = new Map()

  // Asset caches
  private meshes: Map<string, THREE.Group> = new Map()
  private textures: Map<string, THREE.Texture> = new Map()
  private animations: Map<string, THREE.AnimationClip> = new Map()
  private audioFiles: Map<string, THREE.Audio> = new Map()

  // Prefab collection
  private _prefabCollection: PrefabCollection | null = null

  // Loading state
  private loadMeshPromises: Map<string, Promise<THREE.Group>> = new Map()
  private loadTexturePromises: Map<string, Promise<THREE.Texture>> = new Map()
  private loadAudioPromises: Map<string, Promise<THREE.Audio>> = new Map()
  private loadAnimationPromises: Map<string, Promise<THREE.AnimationClip>> = new Map()

  private constructor() {}

  public static getInstance(): StowKitSystem {
    if (!StowKitSystem._instance) {
      StowKitSystem._instance = new StowKitSystem()
    }
    return StowKitSystem._instance
  }

  /**
   * Get the material converter function (if configured).
   */
  public getMaterialConverter(): ((material: THREE.Material) => THREE.Material) | undefined {
    return this.materialConverter
  }

  // ============================================
  // Main Loading API
  // ============================================

  /**
   * Load everything from build.json.
   * This is the main entry point - loads prefab collection and all packs from mounts.
   *
   * @param buildJson The build.json content (import directly or fetch)
   * @param config Configuration including material converter and CDN fetch function
   * @returns The loaded PrefabCollection
   */
  public async loadFromBuildJson(
    buildJson: unknown,
    config: StowKitLoadConfig
  ): Promise<PrefabCollection> {
    // Store config
    this.materialConverter = config.materialConverter
    this.fetchBlob = config.fetchBlob
    if (config.decoderPaths) {
      this.decoderPaths = { ...DEFAULT_DECODER_PATHS, ...config.decoderPaths }
    }

    // Load prefab collection
    const prefabCollection = PrefabCollection.createFromJSON(buildJson as Parameters<typeof PrefabCollection.createFromJSON>[0])
    this._prefabCollection = prefabCollection

    // Load all packs from mounts
    const mounts = prefabCollection.getMounts()
    console.log(`[StowKitSystem] Loading ${mounts.length} packs from mounts...`)

    PerfLogger.disable()

    for (const mount of mounts) {
      if (this.packs.has(mount.alias)) {
        continue // Already loaded
      }

      console.log(`[StowKitSystem] Loading pack "${mount.alias}" from ${mount.path}`)
      const blob = await config.fetchBlob(mount.path)
      const arrayBuffer = await blob.arrayBuffer()

      const pack = await StowKitLoader.loadFromMemory(arrayBuffer, {
        basisPath: this.decoderPaths.basis,
        dracoPath: this.decoderPaths.draco,
        wasmPath: this.decoderPaths.wasm,
      })

      this.packs.set(mount.alias, pack)
    }

    console.log(`[StowKitSystem] All packs loaded`)
    return prefabCollection
  }

  /**
   * Load an additional pack by path.
   * Use this for packs not referenced in prefab mounts (e.g., character packs).
   *
   * @param alias Unique alias for this pack
   * @param path CDN path to the .stow file
   */
  public async loadPack(alias: string, path: string): Promise<void> {
    if (this.packs.has(alias)) {
      console.log(`[StowKitSystem] Pack "${alias}" already loaded, skipping`)
      return
    }

    if (!this.fetchBlob) {
      throw new Error("StowKitSystem: fetchBlob not configured. Call loadFromBuildJson first.")
    }

    console.log(`[StowKitSystem] Loading pack "${alias}" from ${path}`)
    const blob = await this.fetchBlob(path)
    const arrayBuffer = await blob.arrayBuffer()

    const pack = await StowKitLoader.loadFromMemory(arrayBuffer, {
      basisPath: this.decoderPaths.basis,
      dracoPath: this.decoderPaths.draco,
      wasmPath: this.decoderPaths.wasm,
    })

    this.packs.set(alias, pack)
    console.log(`[StowKitSystem] Pack "${alias}" loaded`)
  }

  /**
   * Get the prefab collection.
   */
  public getPrefabCollection(): PrefabCollection {
    if (!this._prefabCollection) {
      throw new Error("StowKitSystem: Not loaded. Call loadFromBuildJson() first.")
    }
    return this._prefabCollection
  }

  /**
   * Get a prefab node by path from the "restaurant" prefab.
   * Convenience method for game code.
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
  // Pack Access
  // ============================================

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
  // Mesh Access (On-Demand Loading)
  // ============================================

  /**
   * Get a mesh by name. Loads on-demand if not cached.
   * For synchronous access, use getMeshSync() after ensuring it's loaded.
   */
  public async getMesh(name: string): Promise<THREE.Group> {
    // Return cached
    const cached = this.meshes.get(name)
    if (cached) return cached

    // Check in-flight
    const existing = this.loadMeshPromises.get(name)
    if (existing) return existing

    // Load from packs
    const promise = this.loadMeshFromPacks(name)
    this.loadMeshPromises.set(name, promise)

    try {
      const mesh = await promise
      this.meshes.set(name, mesh)
      return mesh
    } finally {
      this.loadMeshPromises.delete(name)
    }
  }

  /**
   * Get a mesh synchronously. Returns null if not loaded yet.
   */
  public getMeshSync(name: string): THREE.Group | null {
    return this.meshes.get(name) ?? null
  }

  /**
   * Check if a mesh is loaded.
   */
  public isMeshLoaded(name: string): boolean {
    return this.meshes.has(name)
  }

  private async loadMeshFromPacks(name: string): Promise<THREE.Group> {
    for (const [, pack] of this.packs) {
      try {
        return await pack.loadMesh(name)
      } catch {
        // Try next pack
      }
    }
    throw new Error(`StowKitSystem: Mesh "${name}" not found in any pack`)
  }

  /**
   * Load a skinned mesh (for characters).
   */
  public async getSkinnedMesh(name: string, scale: number = 1): Promise<THREE.Group> {
    // Return cached
    const cached = this.meshes.get(name)
    if (cached) return cached

    // Check in-flight
    const existing = this.loadMeshPromises.get(name)
    if (existing) return existing

    // Load from packs
    const promise = this.loadSkinnedMeshFromPacks(name, scale)
    this.loadMeshPromises.set(name, promise)

    try {
      const mesh = await promise
      this.meshes.set(name, mesh)
      return mesh
    } finally {
      this.loadMeshPromises.delete(name)
    }
  }

  private async loadSkinnedMeshFromPacks(name: string, scale: number): Promise<THREE.Group> {
    for (const [, pack] of this.packs) {
      try {
        const mesh = await pack.loadSkinnedMesh(name)
        if (scale !== 1) {
          mesh.scale.setScalar(scale)
          mesh.updateMatrixWorld(true)
        }
        return mesh
      } catch {
        // Try next pack
      }
    }
    throw new Error(`StowKitSystem: Skinned mesh "${name}" not found in any pack`)
  }

  /**
   * Clone a mesh with material conversion and shadow settings.
   */
  public async cloneMesh(
    meshName: string,
    castShadow: boolean = true,
    receiveShadow: boolean = true
  ): Promise<THREE.Group> {
    const original = await this.getMesh(meshName)
    return this.cloneMeshSync(original, castShadow, receiveShadow)
  }

  /**
   * Clone an already-loaded mesh synchronously.
   */
  public cloneMeshSync(
    original: THREE.Group,
    castShadow: boolean = true,
    receiveShadow: boolean = true
  ): THREE.Group {
    const cloned = original.clone()

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh

        // Apply material conversion if configured
        if (this.materialConverter) {
          const originalMaterial = mesh.material as THREE.Material
          if (originalMaterial) {
            mesh.material = this.materialConverter(originalMaterial)
          }
        }

        mesh.castShadow = castShadow
        mesh.receiveShadow = receiveShadow
      }
    })

    return cloned
  }

  // ============================================
  // Texture Access (On-Demand Loading)
  // ============================================

  /**
   * Get a texture by name. Loads on-demand if not cached.
   */
  public async getTexture(name: string): Promise<THREE.Texture> {
    // Return cached
    const cached = this.textures.get(name)
    if (cached) return cached

    // Check in-flight
    const existing = this.loadTexturePromises.get(name)
    if (existing) return existing

    // Load from packs
    const promise = this.loadTextureFromPacks(name)
    this.loadTexturePromises.set(name, promise)

    try {
      const texture = await promise
      this.textures.set(name, texture)
      return texture
    } finally {
      this.loadTexturePromises.delete(name)
    }
  }

  /**
   * Get a texture synchronously. Returns null if not loaded yet.
   */
  public getTextureSync(name: string): THREE.Texture | null {
    return this.textures.get(name) ?? null
  }

  private async loadTextureFromPacks(name: string): Promise<THREE.Texture> {
    for (const [, pack] of this.packs) {
      try {
        const tex = await pack.loadTexture(name)
        // colorSpace is set by stowkit-three-loader (sRGB for color textures, linear for data)
        tex.anisotropy = 8
        return tex
      } catch {
        // Try next pack
      }
    }
    throw new Error(`StowKitSystem: Texture "${name}" not found in any pack`)
  }

  // ============================================
  // Animation Access (On-Demand Loading)
  // ============================================

  /**
   * Get an animation by name. Loads on-demand if not cached.
   * @param name Animation name
   * @param meshName Mesh to load animation with (required for first load)
   */
  public async getAnimation(name: string, meshName?: string): Promise<THREE.AnimationClip> {
    // Return cached
    const cached = this.animations.get(name)
    if (cached) return cached

    // Check in-flight
    const existing = this.loadAnimationPromises.get(name)
    if (existing) return existing

    if (!meshName) {
      throw new Error(`StowKitSystem: Animation "${name}" not loaded. Provide meshName to load it.`)
    }

    // Load
    const promise = this.loadAnimationFromPacks(name, meshName)
    this.loadAnimationPromises.set(name, promise)

    try {
      const clip = await promise
      this.animations.set(name, clip)
      return clip
    } finally {
      this.loadAnimationPromises.delete(name)
    }
  }

  /**
   * Get an animation synchronously. Returns null if not loaded yet.
   */
  public getAnimationSync(name: string): THREE.AnimationClip | null {
    return this.animations.get(name) ?? null
  }

  /**
   * Get all loaded animations.
   */
  public getAllAnimations(): Map<string, THREE.AnimationClip> {
    return this.animations
  }

  private async loadAnimationFromPacks(name: string, meshName: string): Promise<THREE.AnimationClip> {
    const mesh = await this.getMesh(meshName)

    for (const [, pack] of this.packs) {
      try {
        const { clip } = await pack.loadAnimation(mesh, name)
        return clip
      } catch {
        // Try next pack
      }
    }
    throw new Error(`StowKitSystem: Animation "${name}" not found in any pack`)
  }

  // ============================================
  // Audio Access (On-Demand Loading)
  // ============================================

  /**
   * Get audio by name. Loads on-demand if not cached.
   */
  public async getAudio(name: string): Promise<THREE.Audio> {
    // Return cached
    const cached = this.audioFiles.get(name)
    if (cached) return cached

    // Check in-flight
    const existing = this.loadAudioPromises.get(name)
    if (existing) return existing

    // Load from packs
    const promise = this.loadAudioFromPacks(name)
    this.loadAudioPromises.set(name, promise)

    try {
      const audio = await promise
      this.audioFiles.set(name, audio)
      return audio
    } finally {
      this.loadAudioPromises.delete(name)
    }
  }

  /**
   * Get audio synchronously. Returns null if not loaded yet.
   */
  public getAudioSync(name: string): THREE.Audio | null {
    return this.audioFiles.get(name) ?? null
  }

  /**
   * Get all loaded audio.
   */
  public getAllAudio(): Map<string, THREE.Audio> {
    return this.audioFiles
  }

  private async loadAudioFromPacks(name: string): Promise<THREE.Audio> {
    const audioListener = AudioSystem.mainListener
    if (!audioListener) {
      throw new Error("StowKitSystem: AudioSystem.mainListener not set")
    }

    for (const [, pack] of this.packs) {
      try {
        return await pack.loadAudio(name, audioListener)
      } catch {
        // Try next pack
      }
    }
    throw new Error(`StowKitSystem: Audio "${name}" not found in any pack`)
  }

  // ============================================
  // GPU Instancing
  // ============================================

  /**
   * Register a mesh for GPU instancing.
   */
  public async registerMeshForInstancing(
    batchKey: string,
    meshName: string,
    maxInstances: number = 500,
    castShadow: boolean = true,
    receiveShadow: boolean = true
  ): Promise<boolean> {
    const meshGroup = await this.getMesh(meshName)

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

    // Register batch
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

  private createMaterial(meshGroup: THREE.Group): THREE.Material | null {
    let material: THREE.Material | null = null

    meshGroup.traverse((child) => {
      if (!material && (child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const originalMaterial = mesh.material as THREE.Material

        if (originalMaterial) {
          if (this.materialConverter) {
            material = this.materialConverter(originalMaterial)
          } else {
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

    this.materialConverter = undefined
    this.decoderPaths = { ...DEFAULT_DECODER_PATHS }
    this._prefabCollection = null
  }
}
