import * as THREE from "three"
import { GameObject } from "@engine/core"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { OBJLoader } from "three/addons/loaders/OBJLoader.js"
import { MTLLoader } from "three/addons/loaders/MTLLoader.js"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { SkeletonCache } from "./SkeletonCache"

/**
 * Asset info for a loaded asset in Three.js
 */
interface AssetInfo {
  path: string // Full path to the asset
  group?: THREE.Group // The asset group when loaded
  gltf?: any // GLTF data for .glb files
  isLoaded: boolean // Whether the asset is loaded
  isLoading: boolean // Whether the asset is currently loading
  meshes: THREE.Mesh[] // All meshes from the asset
  materials: THREE.Material[] // All materials from the asset
  animations: THREE.AnimationClip[] // All animations from the asset
}

/**
 * GPU Instance batch for managing InstancedMesh objects
 */
interface GPUInstanceBatch {
  instancedMesh: THREE.InstancedMesh
  assetPath: string
  material: THREE.Material
  instances: GPUInstanceData[]
  maxInstances: number
  needsUpdate: boolean
  cullingRadius: number // Broad radius that encompasses the entire geometry
  hasDynamicObjects: boolean // Whether this batch contains any non-static objects
}

/**
 * Individual instance data within a GPU batch
 */
interface GPUInstanceData {
  id: string
  gameObject: GameObject // Reference to the original GameObject
  matrix: THREE.Matrix4
  isActive: boolean
  isStatic: boolean // Whether this instance is static (won't move after creation)
}

/**
 * Instance tracking for debugging and performance monitoring
 */
interface InstanceStats {
  totalInstances: number // Total instances created from this asset
  sharedInstances: number // Instances using shared geometry/materials (object-level)
  clonedInstances: number // Instances that were cloned
  brokenInstances: number // Instances that were converted from shared to cloned
  gpuInstances: number // Instances using GPU instancing (InstancedMesh)
  gpuBatches: number // Number of GPU batches for this asset
}

/**
 * Global instancing statistics for debug display
 */
interface GlobalInstanceStats {
  totalAssets: number
  loadedAssets: number
  totalInstances: number
  sharedInstances: number
  clonedInstances: number
  brokenInstances: number
  gpuInstances: number // NEW: GPU instanced objects
  gpuBatches: number // NEW: Total GPU batches
  geometryReuse: number // Average times each geometry is reused
  materialReuse: number // Average times each material is reused
}

/**
 * A Three.js asset manager optimized for preloading workflows
 * Compatible API with the original Babylon.js AssetManager
 *
 * RECOMMENDED USAGE PATTERN:
 * 1. Initialize: AssetManager.init(scene)
 * 2. Preload all assets: await AssetManager.preloadAssets([...paths])
 * 3. Use synchronously: AssetManager.getMesh() / getAssetGroup()
 * 4. Create renderers: new ObjRendererThree() (now fully synchronous)
 *
 * SUPPORTED FORMATS:
 * - .glb/.gltf (using GLTFLoader)
 * - .obj (using OBJLoader)
 * - .mtl (material files for OBJ)
 * - .fbx (using FBXLoader)
 * - .stow (using StowKitLoader)
 */
export class AssetManager {
  private static _scene: THREE.Scene
  private static _assets: Map<string, AssetInfo> = new Map()
  private static _instanceStats: Map<string, InstanceStats> = new Map()
  private static _gpuBatches: Map<string, GPUInstanceBatch[]> = new Map() // NEW: GPU batching
  private static _baseUrl: string = "./" // Default to relative path
  private static _gltfLoader: GLTFLoader
  private static _objLoader: OBJLoader
  private static _mtlLoader: MTLLoader
  private static _fbxLoader: FBXLoader
  private static _isPreloadingComplete: boolean = false
  private static _skeletonCache: SkeletonCache = new SkeletonCache()

  // Frustum culling settings
  private static _frustumCullingPadding: number = 1.5 // 50% padding by default to prevent over-culling
  private static _frustumCullingEnabled: boolean = false // Global frustum culling toggle - DISABLED by default for debugging

  /**
   * Initialize the AssetManager with a scene
   * @param scene The Three.js scene to use
   * @param renderer Optional WebGL renderer for StowKit texture support
   */
  public static init(scene: THREE.Scene, renderer?: THREE.WebGLRenderer): void {
    AssetManager._scene = scene

    // Initialize loaders
    AssetManager._gltfLoader = new GLTFLoader()
    AssetManager._objLoader = new OBJLoader()
    AssetManager._mtlLoader = new MTLLoader()
    AssetManager._fbxLoader = new FBXLoader()

    // AssetManager initialized
  }

  /**
   * Set base URL for resolving relative paths (optional - defaults to relative paths)
   * @param baseUrl The base URL to use
   */
  public static setBaseUrl(baseUrl: string): void {
    // Ensure baseUrl ends with a slash for proper path joining
    AssetManager._baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"
  }

  /**
   * Get the full path for an asset - automatically handles relative paths
   */
  public static getFullPath(path: string): string {
    // If it's already an absolute URL, return as-is
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path
    }

    // If it starts with a slash, it's an absolute path from root
    if (path.startsWith("/")) {
      return path
    }

    // For relative paths, use the base URL (which defaults to "./")
    return AssetManager._baseUrl + path
  }

  /**
   * Preload multiple assets in bulk - RECOMMENDED WORKFLOW
   * Call this once at app startup, then use synchronous methods for the rest of the app
   * @param assetPaths Array of asset paths to preload
   * @param progressCallback Optional callback for overall progress (0-1)
   * @returns Promise that resolves when all assets are loaded (or failed)
   */
  public static async preloadAssets(
    assetPaths: string[],
    progressCallback?: (progress: number, loadedCount: number, totalCount: number) => void
  ): Promise<{ loaded: string[]; failed: string[] }> {
    // Starting asset preload
    AssetManager._isPreloadingComplete = false

    const results = { loaded: [] as string[], failed: [] as string[] }
    let completedCount = 0

    // Load all assets in parallel for maximum speed
    const loadPromises = assetPaths.map(async (assetPath) => {
      const success = await AssetManager.loadAsset(assetPath)

      completedCount++

      if (success) {
        results.loaded.push(assetPath)
        // Asset loaded
      } else {
        results.failed.push(assetPath)
        console.error(`❌ Failed: ${assetPath} (${completedCount}/${assetPaths.length})`)
      }

      // Update overall progress
      if (progressCallback) {
        const overallProgress = completedCount / assetPaths.length
        progressCallback(overallProgress, completedCount, assetPaths.length)
      }
    })

    // Wait for all assets to complete (loaded or failed)
    await Promise.all(loadPromises)

    AssetManager._isPreloadingComplete = true
    // Preloading complete

    if (results.failed.length > 0) {
      console.warn(
        `⚠️ ${results.failed.length} assets failed to load. ObjRendererThree will throw errors for these.`
      )
    }

    return results
  }

  /**
   * Check if preloading workflow has been completed
   * This doesn't guarantee all assets loaded successfully, just that preloading finished
   */
  public static isPreloadingComplete(): boolean {
    return AssetManager._isPreloadingComplete
  }

  /**
   * Load an asset by path (used internally by preloadAssets)
   * @param path Path to the asset
   * @param progressCallback Optional callback for loading progress
   */
  public static async loadAsset(
    path: string,
    progressCallback?: (progress: number) => void
  ): Promise<boolean> {
    if (!AssetManager._scene) {
      throw new Error("AssetManager is not initialized. Call AssetManager.init(scene) first.")
    }

    // Skip if already loaded
    if (AssetManager._assets.has(path) && AssetManager._assets.get(path)!.isLoaded) {
      if (progressCallback) progressCallback(1)
      return true
    }

    // Skip if currently loading
    if (AssetManager._assets.has(path) && AssetManager._assets.get(path)!.isLoading) {
      return false
    }

    // Register the asset if not already registered
    if (!AssetManager._assets.has(path)) {
      AssetManager._assets.set(path, {
        path,
        isLoaded: false,
        isLoading: false,
        meshes: [],
        materials: [],
        animations: [],
      })
    }

    const asset = AssetManager._assets.get(path)!
    asset.isLoading = true

    try {
      const fullPath = AssetManager.getFullPath(path)
      const fileExtension = path.split(".").pop()?.toLowerCase() || ""

      let success = false

      switch (fileExtension) {
        case "glb":
        case "gltf":
          success = await AssetManager.loadGLTFAsset(asset, fullPath, progressCallback)
          break
        case "obj":
          success = await AssetManager.loadOBJAsset(asset, fullPath, progressCallback)
          break
        case "fbx":
          success = await AssetManager.loadFBXAsset(asset, fullPath, progressCallback)
          break
        case "stow":
          // .stow files are now loaded directly using StowKitLoader in game code
          console.error(
            ".stow files should be loaded using StowKitLoader.load() directly, not via AssetManager"
          )
          success = false
          break
        default:
          console.error(`Unsupported file type: ${fileExtension}`)
          success = false
      }

      return success
    } catch (error) {
      console.error(`Failed to load asset '${path}':`, error)
      asset.isLoading = false

      if (progressCallback) progressCallback(0)

      return false
    }
  }

  /**
   * Check if an asset is loaded and throw an error if not
   * Use this for strict preloading workflows - RECOMMENDED for ObjRendererThree
   * @param path Path to the asset
   * @throws Error if asset is not preloaded
   */
  public static requireAsset(path: string): AssetInfo {
    const asset = AssetManager._assets.get(path)
    if (!asset || !asset.isLoaded) {
      throw new Error(
        `Asset '${path}' is not preloaded. ` +
          `Make sure to call AssetManager.preloadAssets([...]) with this path before creating renderers.`
      )
    }
    return asset
  }

  /**
   * Get a list of all preloaded asset paths
   */
  public static getPreloadedAssets(): string[] {
    return Array.from(AssetManager._assets.keys()).filter(
      (path) => AssetManager._assets.get(path)?.isLoaded
    )
  }

  /**
   * Get a list of all failed asset paths
   */
  public static getFailedAssets(): string[] {
    return Array.from(AssetManager._assets.keys()).filter((path) => {
      const asset = AssetManager._assets.get(path)
      return asset && !asset.isLoaded && !asset.isLoading
    })
  }

  /**
   * Get preloading statistics
   */
  public static getPreloadingStats(): {
    total: number
    loaded: number
    failed: number
    loading: number
    completionPercentage: number
  } {
    let loaded = 0
    let failed = 0
    let loading = 0
    const total = AssetManager._assets.size

    for (const asset of AssetManager._assets.values()) {
      if (asset.isLoaded) {
        loaded++
      } else if (asset.isLoading) {
        loading++
      } else {
        failed++
      }
    }

    const completionPercentage = total > 0 ? Math.round((loaded / total) * 100) : 100

    return { total, loaded, failed, loading, completionPercentage }
  }

  /**
   * Get GLTF data for a loaded GLTF/GLB asset - SYNCHRONOUS (use after preloading)
   * @param path Path to the asset
   * @returns GLTF data or null if not a GLTF asset
   */
  public static getGLTF(path: string): any | null {
    const asset = AssetManager._assets.get(path)

    if (!asset || !asset.isLoaded) {
      console.error(`Asset '${path}' not loaded. Use AssetManager.preloadAssets() first.`)
      return null
    }

    return asset.gltf || null
  }

  /**
   * Load GLTF/GLB asset
   * @private
   */
  private static loadGLTFAsset(
    asset: AssetInfo,
    fullPath: string,
    progressCallback?: (progress: number) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      AssetManager._gltfLoader.load(
        fullPath,
        (gltf) => {
          // Store the GLTF data
          asset.gltf = gltf

          // Create a group to hold all the loaded content
          const group = new THREE.Group()
          group.name = `${asset.path}_group`

          // Add the scene to our group
          group.add(gltf.scene)

          // Extract meshes and materials
          asset.meshes = []
          asset.materials = []

          gltf.scene.traverse((object: THREE.Object3D) => {
            if (object instanceof THREE.Mesh) {
              asset.meshes.push(object)

              // Collect materials
              if (object.material) {
                if (Array.isArray(object.material)) {
                  asset.materials.push(...object.material)
                } else {
                  asset.materials.push(object.material)
                }
              }
            }
          })

          // Store animations
          asset.animations = gltf.animations || []

          // Store the group
          asset.group = group

          // Mark as loaded
          asset.isLoaded = true
          asset.isLoading = false

          if (progressCallback) progressCallback(1)

          // GLTF asset loaded
          resolve(true)
        },
        (progressEvent) => {
          if (progressCallback && progressEvent.lengthComputable) {
            const progress = progressEvent.loaded / progressEvent.total
            progressCallback(progress)
          }
        },
        (error) => {
          console.error(`Failed to load GLTF asset '${asset.path}':`, error)
          asset.isLoading = false

          if (progressCallback) progressCallback(0)
          resolve(false)
        }
      )
    })
  }

  /**
   * Load OBJ asset
   * @private
   */
  private static loadOBJAsset(
    asset: AssetInfo,
    fullPath: string,
    progressCallback?: (progress: number) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // First, try to load MTL file if it exists
      const mtlPath = fullPath.replace(".obj", ".mtl")

      // Check if MTL file exists by trying to load it
      AssetManager._mtlLoader.load(
        mtlPath,
        (materials) => {
          // MTL file exists, apply materials
          materials.preload()
          AssetManager._objLoader.setMaterials(materials)
          AssetManager.loadOBJWithMaterials(asset, fullPath, resolve, progressCallback)
        },
        undefined,
        () => {
          // MTL file doesn't exist, load OBJ without materials
          AssetManager.loadOBJWithMaterials(asset, fullPath, resolve, progressCallback)
        }
      )
    })
  }

  /**
   * Load OBJ with or without materials
   * @private
   */
  private static loadOBJWithMaterials(
    asset: AssetInfo,
    fullPath: string,
    resolve: (value: boolean) => void,
    progressCallback?: (progress: number) => void
  ): void {
    AssetManager._objLoader.load(
      fullPath,
      (object) => {
        // Store the object as a group
        asset.group = object

        // Extract meshes and materials
        asset.meshes = []
        asset.materials = []

        object.traverse((child: THREE.Object3D) => {
          // Handle different types of objects that OBJ loader might create
          if (child instanceof THREE.Mesh) {
            asset.meshes.push(child)

            // Collect materials
            if (child.material) {
              if (Array.isArray(child.material)) {
                asset.materials.push(...child.material)
              } else {
                asset.materials.push(child.material)
              }
            }
          } else if (child.type === "Mesh") {
            // Sometimes OBJ loader creates objects with type 'Mesh' but not instanceof THREE.Mesh
            asset.meshes.push(child as THREE.Mesh)

            // Collect materials
            const mesh = child as any
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                asset.materials.push(...mesh.material)
              } else {
                asset.materials.push(mesh.material)
              }
            }
          } else if ((child as any).geometry && (child as any).material) {
            // Fallback: if it has geometry and material, treat it as a mesh
            asset.meshes.push(child as THREE.Mesh)

            const mesh = child as any
            if (Array.isArray(mesh.material)) {
              asset.materials.push(...mesh.material)
            } else {
              asset.materials.push(mesh.material)
            }
          }
        })

        // OBJ files don't have animations
        asset.animations = []

        // Mark as loaded
        asset.isLoaded = true
        asset.isLoading = false

        if (progressCallback) progressCallback(1)

        // OBJ asset loaded
        resolve(true)
      },
      (progressEvent) => {
        if (progressCallback && progressEvent.lengthComputable) {
          const progress = progressEvent.loaded / progressEvent.total
          progressCallback(progress)
        }
      },
      (error) => {
        console.error(`Failed to load OBJ asset '${asset.path}':`, error)
        asset.isLoading = false

        if (progressCallback) progressCallback(0)
        resolve(false)
      }
    )
  }

  /**
   * Load FBX asset
   * @private
   */
  private static loadFBXAsset(
    asset: AssetInfo,
    fullPath: string,
    progressCallback?: (progress: number) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      AssetManager._fbxLoader.load(
        fullPath,
        (object) => {
          // FBX loader returns a Group
          asset.group = object

          // Extract meshes and materials
          asset.meshes = []
          asset.materials = []

          object.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              asset.meshes.push(child)

              // Collect materials
              if (child.material) {
                if (Array.isArray(child.material)) {
                  asset.materials.push(...child.material)
                } else {
                  asset.materials.push(child.material)
                }
              }
            }
          })

          // FBX files can have animations
          asset.animations = object.animations || []

          // Mark as loaded
          asset.isLoaded = true
          asset.isLoading = false

          if (progressCallback) progressCallback(1)

          // FBX asset loaded
          resolve(true)
        },
        (progressEvent) => {
          if (progressCallback && progressEvent.lengthComputable) {
            const progress = progressEvent.loaded / progressEvent.total
            progressCallback(progress)
          }
        },
        (error) => {
          console.error(`Failed to load FBX asset '${asset.path}':`, error)
          asset.isLoading = false

          if (progressCallback) progressCallback(0)
          resolve(false)
        }
      )
    })
  }

  /**
   * Get the asset group for a loaded asset - SYNCHRONOUS (use after preloading)
   * @param path Path to the asset
   * @returns The Group for the asset or null if not loaded
   */
  public static getAssetGroup(path: string): THREE.Group | null {
    if (!AssetManager._scene) {
      throw new Error("AssetManager is not initialized. Call AssetManager.init(scene) first.")
    }

    const asset = AssetManager._assets.get(path)

    if (!asset) {
      console.error(`Asset '${path}' not found. Use AssetManager.preloadAssets() first.`)
      return null
    }

    if (!asset.isLoaded || !asset.group) {
      console.error(`Asset '${path}' not loaded. Use AssetManager.preloadAssets() first.`)
      return null
    }

    return asset.group
  }

  /**
   * Get the primary mesh from a loaded asset - SYNCHRONOUS (use after preloading)
   * @param path Path to the asset
   * @returns The primary Mesh from the asset or null if not found
   */
  public static getMesh(path: string): THREE.Mesh | null {
    const asset = AssetManager._assets.get(path)

    if (!asset || !asset.isLoaded) {
      console.error(`Asset '${path}' not loaded. Use AssetManager.preloadAssets() first.`)
      return null
    }

    if (asset.meshes.length === 0) {
      console.error(`No meshes found in asset '${path}'`)
      return null
    }

    return asset.meshes[0]
  }

  /**
   * Get all meshes from a loaded asset - SYNCHRONOUS (use after preloading)
   * @param path Path to the asset
   * @returns Array of meshes from the asset
   */
  public static getMeshes(path: string): THREE.Mesh[] {
    const asset = AssetManager._assets.get(path)

    if (!asset || !asset.isLoaded) {
      console.error(`Asset '${path}' not loaded. Use AssetManager.preloadAssets() first.`)
      return []
    }

    return asset.meshes
  }

  /**
   * Get all materials from a loaded asset - SYNCHRONOUS (use after preloading)
   * @param path Path to the asset
   * @returns Array of materials from the asset
   */
  public static getMaterials(path: string): THREE.Material[] {
    const asset = AssetManager._assets.get(path)

    if (!asset || !asset.isLoaded) {
      console.error(`Asset '${path}' not loaded. Use AssetManager.preloadAssets() first.`)
      return []
    }

    return asset.materials
  }

  /**
   * Get all animations from a loaded asset - SYNCHRONOUS (use after preloading)
   * @param path Path to the asset
   * @returns Array of animation clips from the asset
   */
  public static getAnimations(path: string): THREE.AnimationClip[] {
    const asset = AssetManager._assets.get(path)

    if (!asset || !asset.isLoaded) {
      console.error(`Asset '${path}' not loaded. Use AssetManager.preloadAssets() first.`)
      return []
    }

    return asset.animations
  }

  /**
   * Register a StowKit-loaded asset for compatibility with existing code
   * Allows StowKit assets to be accessed via the same AssetManager.getAssetGroup() API
   * @param path Virtual path to register the asset under (e.g. 'v2/restaurant_display_default.fbx')
   * @param group The THREE.Group loaded from StowKit
   */
  public static registerStowKitAsset(path: string, group: THREE.Group): void {
    // Extract meshes and materials from the group
    const meshes: THREE.Mesh[] = []
    const materials: THREE.Material[] = []

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        meshes.push(obj)
        if (Array.isArray(obj.material)) {
          materials.push(...obj.material)
        } else {
          materials.push(obj.material)
        }
      }
    })

    // Register as a loaded asset
    AssetManager._assets.set(path, {
      path: path,
      group: group,
      isLoaded: true,
      isLoading: false,
      meshes: meshes,
      materials: materials,
      animations: [], // StowKit assets don't have animations in this context
    })
  }

  // Store for StowKit textures
  private static _stowkitTextures: Map<string, THREE.Texture> = new Map()

  /**
   * Register a StowKit-loaded texture for use by materials
   * @param name Texture name/ID
   * @param texture The THREE.Texture loaded from StowKit
   */
  public static registerStowKitTexture(name: string, texture: THREE.Texture): void {
    AssetManager._stowkitTextures.set(name, texture)
  }

  /**
   * Get a StowKit-loaded texture by name
   * @param name Texture name/ID
   * @returns The texture or null if not found
   */
  public static getStowKitTexture(name: string): THREE.Texture | null {
    return AssetManager._stowkitTextures.get(name) || null
  }

  /**
   * Unload an asset to free memory
   * @param path Path to the asset
   */
  public static unloadAsset(path: string): void {
    const asset = AssetManager._assets.get(path)
    if (!asset) {
      return
    }

    // Dispose of materials
    for (const material of asset.materials) {
      material.dispose()
    }

    // Dispose of geometries
    for (const mesh of asset.meshes) {
      mesh.geometry.dispose()
    }

    // Remove from scene if added
    if (asset.group && asset.group.parent) {
      asset.group.parent.remove(asset.group)
    }

    AssetManager._assets.delete(path)
    console.log(`🗑️ Asset '${path}' unloaded`)
  }

  /**
   * Check if an asset is loaded
   * @param path Path to the asset
   */
  public static isLoaded(path: string): boolean {
    const asset = AssetManager._assets.get(path)
    return asset?.isLoaded || false
  }

  /**
   * Get the current base URL being used
   */
  public static getBaseUrl(): string {
    return AssetManager._baseUrl
  }

  /**
   * Reset to default relative path behavior
   */
  public static useRelativePaths(): void {
    AssetManager._baseUrl = "./"
  }

  /**
   * Get loading progress for all assets
   * @returns Object with loading statistics
   * @deprecated Use getPreloadingStats() instead for better information
   */
  public static getLoadingStats(): {
    loaded: number
    loading: number
    total: number
  } {
    let loaded = 0
    let loading = 0
    const total = AssetManager._assets.size

    for (const asset of AssetManager._assets.values()) {
      if (asset.isLoaded) {
        loaded++
      } else if (asset.isLoading) {
        loading++
      }
    }

    return { loaded, loading, total }
  }

  // === INSTANCE TRACKING METHODS ===

  /**
   * Track when a shared instance is converted to cloned (broken instancing)
   * @param assetPath Path to the asset
   */
  public static trackInstanceBroken(assetPath: string): void {
    if (!AssetManager._instanceStats.has(assetPath)) {
      return // Shouldn't happen, but be safe
    }

    const stats = AssetManager._instanceStats.get(assetPath)!
    stats.sharedInstances--
    stats.clonedInstances++
    stats.brokenInstances++
  }

  /**
   * Get instance statistics for a specific asset
   * @param assetPath Path to the asset
   */
  public static getAssetInstanceStats(assetPath: string): InstanceStats {
    return (
      AssetManager._instanceStats.get(assetPath) || {
        totalInstances: 0,
        sharedInstances: 0,
        clonedInstances: 0,
        brokenInstances: 0,
        gpuInstances: 0,
        gpuBatches: 0,
      }
    )
  }

  /**
   * Get global instancing statistics for debug display
   */
  public static getGlobalInstanceStats(): GlobalInstanceStats {
    const totalAssets = AssetManager._assets.size
    const loadedAssets = Array.from(AssetManager._assets.values()).filter(
      (asset) => asset.isLoaded
    ).length

    let totalInstances = 0
    let sharedInstances = 0
    let clonedInstances = 0
    let brokenInstances = 0
    let gpuInstances = 0
    let gpuBatches = 0

    for (const stats of AssetManager._instanceStats.values()) {
      totalInstances += stats.totalInstances
      sharedInstances += stats.sharedInstances
      clonedInstances += stats.clonedInstances
      brokenInstances += stats.brokenInstances
      gpuInstances += stats.gpuInstances
      gpuBatches += stats.gpuBatches
    }

    // Calculate geometry and material reuse
    let totalGeometries = 0
    let totalMaterials = 0
    let geometryInstances = 0
    let materialInstances = 0

    for (const [assetPath, asset] of AssetManager._assets.entries()) {
      if (!asset.isLoaded) continue

      const instanceStats = AssetManager._instanceStats.get(assetPath)
      const instances = instanceStats ? instanceStats.sharedInstances : 0

      totalGeometries += asset.meshes.length
      totalMaterials += asset.materials.length
      geometryInstances += asset.meshes.length * instances
      materialInstances += asset.materials.length * instances
    }

    const geometryReuse =
      totalGeometries > 0 ? Math.round((geometryInstances / totalGeometries) * 100) / 100 : 0
    const materialReuse =
      totalMaterials > 0 ? Math.round((materialInstances / totalMaterials) * 100) / 100 : 0

    return {
      totalAssets,
      loadedAssets,
      totalInstances,
      sharedInstances,
      clonedInstances,
      brokenInstances,
      gpuInstances,
      gpuBatches,
      geometryReuse,
      materialReuse,
    }
  }

  /**
   * Get detailed instancing report for debugging
   */
  public static getInstanceReport(): string {
    const globalStats = AssetManager.getGlobalInstanceStats()
    const lines = [
      `=== INSTANCING REPORT ===`,
      `Assets: ${globalStats.loadedAssets}/${globalStats.totalAssets} loaded`,
      `Instances: ${globalStats.totalInstances} total`,
      `  - GPU: ${globalStats.gpuInstances} in ${globalStats.gpuBatches} batches (${Math.round((globalStats.gpuInstances / Math.max(globalStats.totalInstances, 1)) * 100)}%)`,
      `  - Shared: ${globalStats.sharedInstances} (${Math.round((globalStats.sharedInstances / Math.max(globalStats.totalInstances, 1)) * 100)}%)`,
      `  - Cloned: ${globalStats.clonedInstances} (${Math.round((globalStats.clonedInstances / Math.max(globalStats.totalInstances, 1)) * 100)}%)`,
      `  - Broken: ${globalStats.brokenInstances} (${Math.round((globalStats.brokenInstances / Math.max(globalStats.totalInstances, 1)) * 100)}%)`,
      `Reuse: Geometry ${globalStats.geometryReuse}x, Material ${globalStats.materialReuse}x`,
      ``,
      `=== PER-ASSET BREAKDOWN ===`,
    ]

    for (const [assetPath, stats] of AssetManager._instanceStats.entries()) {
      if (stats.totalInstances > 0) {
        lines.push(
          `${assetPath}: ${stats.totalInstances} total (${stats.gpuInstances} GPU in ${stats.gpuBatches} batches, ${stats.sharedInstances} shared, ${stats.clonedInstances} cloned, ${stats.brokenInstances} broken)`
        )
      }
    }

    return lines.join("\n")
  }

  // === GPU INSTANCING METHODS ===

  /**
   * Create or get a GPU instance batch for an asset
   * @param assetPath Path to the asset
   * @param material Material to use for the batch
   * @param maxInstances Maximum instances in this batch (default: 1000)
   */
  public static getOrCreateGPUBatch(
    assetPath: string,
    material: THREE.Material,
    maxInstances: number = 1000
  ): GPUInstanceBatch | null {
    const asset = AssetManager.requireAsset(assetPath)
    const primaryMesh = AssetManager.getMesh(assetPath)

    if (!primaryMesh) {
      console.error(`❌ No mesh found for GPU instancing: ${assetPath}`)
      return null
    }

    // Get or create batch array for this asset
    if (!AssetManager._gpuBatches.has(assetPath)) {
      AssetManager._gpuBatches.set(assetPath, [])
    }

    const batches = AssetManager._gpuBatches.get(assetPath)!

    // Find an existing batch with space and matching material
    for (const batch of batches) {
      if (batch.material === material && batch.instances.length < batch.maxInstances) {
        return batch
      }
    }

    // Create new batch if none found with space
    const instancedMesh = new THREE.InstancedMesh(primaryMesh.geometry, material, maxInstances)
    instancedMesh.name = `${assetPath}_gpu_batch_${batches.length}`
    instancedMesh.castShadow = true
    instancedMesh.receiveShadow = true
    instancedMesh.frustumCulled = false // Disable Three.js built-in frustum culling since we handle it manually

    // Add to scene
    AssetManager._scene.add(instancedMesh)

    // Calculate proper bounding sphere and box from geometry
    const geometry = primaryMesh.geometry

    // Compute bounding sphere and box if not already computed
    if (!geometry.boundingSphere) {
      geometry.computeBoundingSphere()
    }

    if (!geometry.boundingBox) {
      geometry.computeBoundingBox()
    }

    // Calculate broad culling radius that encompasses the entire geometry
    // Use the diagonal of the bounding box for maximum coverage
    // This is faster than bounding box intersection tests while being slightly less accurate
    let cullingRadius = 1.0 // Default fallback

    if (geometry.boundingBox) {
      const size = geometry.boundingBox.getSize(new THREE.Vector3())
      // Use full diagonal length instead of half for more conservative culling
      cullingRadius = size.length()
    } else if (geometry.boundingSphere) {
      // Double the bounding sphere radius for more conservative culling
      cullingRadius = geometry.boundingSphere.radius * 2
    }

    const newBatch: GPUInstanceBatch = {
      instancedMesh,
      assetPath,
      material,
      instances: [],
      maxInstances,
      needsUpdate: false,
      cullingRadius,
      hasDynamicObjects: false, // Initialize as false
    }

    batches.push(newBatch)

    return newBatch
  }

  /**
   * Add a GPU instance to a batch
   * @param assetPath Path to the asset
   * @param gameObject GameObject to instance
   * @param material Material to use
   * @param isStatic Whether this instance is static (won't move after creation)
   * @returns Instance ID or null if failed
   */
  public static addGPUInstance(
    assetPath: string,
    gameObject: GameObject,
    material: THREE.Material,
    isStatic: boolean = false
  ): string | null {
    const batch = AssetManager.getOrCreateGPUBatch(assetPath, material)
    if (!batch) {
      return null
    }

    if (batch.instances.length >= batch.maxInstances) {
      console.warn(`GPU batch full for '${assetPath}', consider increasing maxInstances`)
      return null
    }

    const instanceId = `${assetPath}_gpu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const instanceData: GPUInstanceData = {
      id: instanceId,
      gameObject,
      matrix: new THREE.Matrix4(),
      isActive: true,
      isStatic: isStatic,
    }

    // Set initial transform from GameObject (use world transform for correct positioning)
    const worldPosition = new THREE.Vector3()
    const worldQuaternion = new THREE.Quaternion()
    const worldScale = new THREE.Vector3()

    gameObject.getWorldPosition(worldPosition)
    gameObject.getWorldQuaternion(worldQuaternion)
    gameObject.getWorldScale(worldScale)

    instanceData.matrix.compose(worldPosition, worldQuaternion, worldScale)

    batch.instances.push(instanceData)
    batch.needsUpdate = true

    // Track if this batch has dynamic objects
    if (!isStatic) {
      batch.hasDynamicObjects = true
    }

    // Update instance matrix
    AssetManager.updateGPUBatch(batch)

    // Track instance creation (create stats if needed)
    AssetManager.trackInstanceCreated(assetPath, false, true) // GPU instance

    // Update batch statistics AFTER instance stats exist
    AssetManager.updateGPUBatchStats(assetPath)

    return instanceId
  }

  /**
   * Remove a GPU instance from its batch
   * @param assetPath Path to the asset
   * @param instanceId Instance ID to remove
   */
  public static removeGPUInstance(assetPath: string, instanceId: string): void {
    const batches = AssetManager._gpuBatches.get(assetPath)
    if (!batches) return

    for (const batch of batches) {
      const instanceIndex = batch.instances.findIndex((inst) => inst.id === instanceId)
      if (instanceIndex !== -1) {
        batch.instances.splice(instanceIndex, 1)
        batch.needsUpdate = true
        AssetManager.updateGPUBatch(batch)

        // Track instance destruction
        AssetManager.trackInstanceDestroyed(assetPath, false, true) // GPU instance
        return
      }
    }
  }

  /**
   * Set the visibility of a specific GPU instance
   * @param assetPath Path to the asset
   * @param instanceId Instance ID to show/hide
   * @param visible Whether the instance should be visible
   */
  public static setGPUInstanceVisible(
    assetPath: string,
    instanceId: string,
    visible: boolean
  ): void {
    const batches = AssetManager._gpuBatches.get(assetPath)
    if (!batches) return

    for (const batch of batches) {
      const instance = batch.instances.find((inst) => inst.id === instanceId)
      if (instance) {
        instance.isActive = visible
        batch.needsUpdate = true

        // Force immediate batch update to ensure visibility changes are applied
        AssetManager.updateGPUBatch(batch)
        return
      }
    }
  }

  /**
   * Get the visibility of a specific GPU instance
   * @param assetPath Path to the asset
   * @param instanceId Instance ID to check
   * @returns Whether the instance is visible
   */
  public static getGPUInstanceVisible(assetPath: string, instanceId: string): boolean {
    const batches = AssetManager._gpuBatches.get(assetPath)
    if (!batches) return false

    for (const batch of batches) {
      const instance = batch.instances.find((inst) => inst.id === instanceId)
      if (instance) {
        return instance.isActive
      }
    }
    return false
  }

  /**
   * Convert a GPU instance to object-level instance (for scaling, etc.)
   * @param assetPath Path to the asset
   * @param instanceId Instance ID to convert
   * @returns New GameObject with ObjRenderer or null if failed
   */
  public static convertGPUToObjectLevel(assetPath: string, instanceId: string): any | null {
    const batches = AssetManager._gpuBatches.get(assetPath)
    if (!batches) return null

    for (const batch of batches) {
      const instanceIndex = batch.instances.findIndex((inst) => inst.id === instanceId)
      if (instanceIndex !== -1) {
        const instanceData = batch.instances[instanceIndex]

        // Remove from GPU batch
        batch.instances.splice(instanceIndex, 1)
        batch.needsUpdate = true
        AssetManager.updateGPUBatch(batch)

        // Create new object-level instance
        // Note: This would need to be integrated with the actual GameObject/Component system
        console.log(`🔄 Converting GPU instance '${instanceId}' to object-level for scaling`)

        // Track the conversion
        AssetManager.trackInstanceDestroyed(assetPath, false, true) // Remove GPU
        AssetManager.trackInstanceCreated(assetPath, false, false) // Add object-level
        AssetManager.trackInstanceBroken(assetPath) // Mark as broken

        return instanceData.gameObject
      }
    }

    return null
  }

  /**
   * Update GPU batch matrices and upload to GPU
   * @param batch GPU batch to update
   * @param camera Optional camera for frustum culling
   */
  public static updateGPUBatch(batch: GPUInstanceBatch, camera?: THREE.Camera): void {
    if (!batch.needsUpdate) return

    const activeInstances = batch.instances.filter((inst) => inst.isActive)

    // Update matrices only for dynamic objects (static optimization preserved)
    activeInstances.forEach((instance) => {
      // Only update matrix for dynamic (non-static) objects
      if (!instance.isStatic) {
        // Update matrix from GameObject transform (use world transform for correct positioning)
        const worldPosition = new THREE.Vector3()
        const worldQuaternion = new THREE.Quaternion()
        const worldScale = new THREE.Vector3()

        instance.gameObject.getWorldPosition(worldPosition)
        instance.gameObject.getWorldQuaternion(worldQuaternion)
        instance.gameObject.getWorldScale(worldScale)

        instance.matrix.compose(worldPosition, worldQuaternion, worldScale)
      }
      // For static objects, matrix was set once during creation and doesn't change
    })

    let visibleInstances = activeInstances

    // Optional frustum culling to reduce triangle count (can be globally disabled)
    if (AssetManager._frustumCullingEnabled && camera && batch.cullingRadius > 0) {
      const frustum = new THREE.Frustum()
      const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
      frustum.setFromProjectionMatrix(cameraMatrix)

      visibleInstances = activeInstances.filter((instance) => {
        // Use updated matrix for accurate culling
        const worldMatrix = instance.matrix
        const position = new THREE.Vector3().setFromMatrixPosition(worldMatrix)
        const scale = new THREE.Vector3().setFromMatrixScale(worldMatrix)

        // Calculate proper radius based on geometry bounding sphere and instance scale
        const maxScale = Math.max(scale.x, scale.y, scale.z)
        const actualRadius = batch.cullingRadius * maxScale

        // Add generous padding to prevent aggressive culling of visible objects
        const paddedRadius = actualRadius * AssetManager._frustumCullingPadding

        // Test sphere intersection with frustum
        const sphere = new THREE.Sphere(position, paddedRadius)
        const isVisible = frustum.intersectsSphere(sphere)

        return isVisible
      })
    }

    // Set matrices for visible instances (matrices already updated above)
    visibleInstances.forEach((instance, index) => {
      batch.instancedMesh.setMatrixAt(index, instance.matrix)
    })

    // Hide unused instances by setting them to zero scale
    for (let i = visibleInstances.length; i < batch.maxInstances; i++) {
      const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
      batch.instancedMesh.setMatrixAt(i, zeroMatrix)
    }

    // Mark for GPU upload
    batch.instancedMesh.instanceMatrix.needsUpdate = true
    batch.instancedMesh.count = visibleInstances.length // Only render visible instances!
    batch.needsUpdate = false
  }

  /**
   * Update GPU batch statistics
   * @param assetPath Path to the asset
   */
  private static updateGPUBatchStats(assetPath: string): void {
    const batches = AssetManager._gpuBatches.get(assetPath)
    const hasInstanceStats = AssetManager._instanceStats.has(assetPath)

    if (!batches || !hasInstanceStats) return

    const stats = AssetManager._instanceStats.get(assetPath)!
    stats.gpuBatches = batches.length

    let totalGPUInstances = 0
    for (const batch of batches) {
      totalGPUInstances += batch.instances.filter((inst) => inst.isActive).length
    }
    stats.gpuInstances = totalGPUInstances
  }

  /**
   * Track when an instance is created from an asset
   * @param assetPath Path to the asset
   * @param isShared Whether this is a shared instance (true) or cloned (false)
   * @param isGPU Whether this is a GPU instance (true) or object-level (false)
   */
  public static trackInstanceCreated(
    assetPath: string,
    isShared: boolean,
    isGPU: boolean = false
  ): void {
    if (!AssetManager._instanceStats.has(assetPath)) {
      AssetManager._instanceStats.set(assetPath, {
        totalInstances: 0,
        sharedInstances: 0,
        clonedInstances: 0,
        brokenInstances: 0,
        gpuInstances: 0,
        gpuBatches: 0,
      })
    }

    const stats = AssetManager._instanceStats.get(assetPath)!
    stats.totalInstances++

    if (isGPU) {
      stats.gpuInstances++
    } else if (isShared) {
      stats.sharedInstances++
    } else {
      stats.clonedInstances++
    }
  }

  /**
   * Track when an instance is destroyed
   * @param assetPath Path to the asset
   * @param wasShared Whether this was a shared instance
   * @param wasGPU Whether this was a GPU instance
   */
  public static trackInstanceDestroyed(
    assetPath: string,
    wasShared: boolean,
    wasGPU: boolean = false
  ): void {
    if (!AssetManager._instanceStats.has(assetPath)) {
      return // Shouldn't happen, but be safe
    }

    const stats = AssetManager._instanceStats.get(assetPath)!
    stats.totalInstances--

    if (wasGPU) {
      stats.gpuInstances--
    } else if (wasShared) {
      stats.sharedInstances--
    } else {
      stats.clonedInstances--
    }
  }

  /**
   * Update all GPU batches with optional frustum culling
   * Now uses separated static/dynamic logic for optimal performance
   * @param camera Optional camera for frustum culling
   * @param debug Whether to log frustum culling statistics (default: false)
   */
  public static updateAllGPUBatches(camera?: THREE.Camera, debug: boolean = false): void {
    // Update both static and dynamic batches (for compatibility/testing)
    AssetManager.updateDynamicGPUBatches(camera, debug)
  }

  /**
   * DEBUG: Force update all GPU batches
   * Call this from console to manually trigger batch updates
   */
  public static debugUpdateAllGPUBatches(): void {
    console.log("🔧 DEBUG: Force updating all GPU batches...")
    let totalBatches = 0
    let totalInstances = 0

    for (const [assetPath, batches] of AssetManager._gpuBatches.entries()) {
      console.log(`🔧 Updating batches for '${assetPath}': ${batches.length} batches`)

      batches.forEach((batch, batchIndex) => {
        batch.needsUpdate = true
        AssetManager.updateGPUBatch(batch)
        totalBatches++
        totalInstances += batch.instances.length

        console.log(
          `🔧 Batch ${batchIndex} for '${assetPath}': ${batch.instances.length} instances, InstancedMesh count: ${batch.instancedMesh.count}`
        )
      })
    }

    console.log(`🔧 DEBUG: Updated ${totalBatches} batches with ${totalInstances} total instances`)
  }

  /**
   * Update only dynamic GPU batches (called every frame for immediate updates)
   * @param camera Optional camera for frustum culling
   * @param debug Whether to log statistics (default: false)
   */
  public static updateDynamicGPUBatches(camera?: THREE.Camera, debug: boolean = false): void {
    let totalInstancesBefore = 0
    let totalInstancesAfter = 0
    let batchesUpdated = 0

    for (const [assetPath, batches] of AssetManager._gpuBatches.entries()) {
      batches.forEach((batch) => {
        // Only update batches that contain dynamic objects
        if (batch.hasDynamicObjects) {
          totalInstancesBefore += batch.instancedMesh.count
          batch.needsUpdate = true
          AssetManager.updateGPUBatch(batch, camera)
          batchesUpdated++
          totalInstancesAfter += batch.instancedMesh.count
        }
      })
    }

    if (debug && batchesUpdated > 0) {
      console.log(`🔄 Dynamic GPU Batch Update: ${batchesUpdated} dynamic batches updated`)
      if (camera && totalInstancesBefore !== totalInstancesAfter) {
        const reduction = totalInstancesBefore - totalInstancesAfter
        const percentReduction =
          totalInstancesBefore > 0 ? Math.round((reduction / totalInstancesBefore) * 100) : 0
        console.log(
          `🎯 Dynamic frustum culling: ${totalInstancesAfter}/${totalInstancesBefore} instances visible (${percentReduction}% culled)`
        )
      }
    }
  }

  /**
   * DEBUG: Show static vs dynamic batch breakdown
   */
  public static debugBatchTypes(): void {
    console.log("🔍 === GPU BATCH TYPE BREAKDOWN ===")

    let totalStaticBatches = 0
    let totalDynamicBatches = 0
    let totalStaticInstances = 0
    let totalDynamicInstances = 0

    for (const [assetPath, batches] of AssetManager._gpuBatches.entries()) {
      batches.forEach((batch) => {
        const instanceCount = batch.instances.length

        if (batch.hasDynamicObjects) {
          totalDynamicBatches++
          totalDynamicInstances += instanceCount
          console.log(`🔄 DYNAMIC: ${assetPath} - ${instanceCount} instances`)
        } else {
          totalStaticBatches++
          totalStaticInstances += instanceCount
          console.log(`🏛️ STATIC: ${assetPath} - ${instanceCount} instances`)
        }
      })
    }

    console.log(
      `📊 Summary: ${totalDynamicBatches} dynamic batches (${totalDynamicInstances} instances), ${totalStaticBatches} static batches (${totalStaticInstances} instances)`
    )
    console.log(`💡 Dynamic batches update every frame, static batches only on camera movement`)
  }

  /**
   * Set frustum culling padding multiplier
   * Higher values = less aggressive culling (fewer false positives)
   * Lower values = more aggressive culling (more performance, more false positives)
   * @param padding Padding multiplier (default: 1.2 = 20% padding)
   */
  public static setFrustumCullingPadding(padding: number): void {
    AssetManager._frustumCullingPadding = Math.max(1.0, padding) // Minimum 1.0 (no shrinking)
    console.log(
      `🎯 Frustum culling padding set to ${AssetManager._frustumCullingPadding.toFixed(2)}x`
    )
  }

  /**
   * Get current frustum culling padding multiplier
   */
  public static getFrustumCullingPadding(): number {
    return AssetManager._frustumCullingPadding
  }

  /**
   * Enable or disable frustum culling globally
   * @param enabled Whether frustum culling should be enabled
   */
  public static setFrustumCullingEnabled(enabled: boolean): void {
    AssetManager._frustumCullingEnabled = enabled

    if (enabled) {
      console.log("✅ Frustum culling ENABLED")
    } else {
      console.log("🚫 Frustum culling DISABLED")
    }

    // Force update all batches
    for (const [assetPath, batches] of AssetManager._gpuBatches.entries()) {
      batches.forEach((batch) => {
        batch.needsUpdate = true
      })
    }
  }

  /**
   * Get current frustum culling enabled state
   */
  public static isFrustumCullingEnabled(): boolean {
    return AssetManager._frustumCullingEnabled
  }

  /**
   * DEBUG: Test frustum culling by temporarily disabling it
   * @param disabled Whether to disable frustum culling entirely (for testing)
   */
  public static debugFrustumCulling(disabled: boolean = false): void {
    AssetManager.setFrustumCullingEnabled(!disabled)
    console.log(
      `🎯 Current frustum culling state: ${AssetManager._frustumCullingEnabled ? "ENABLED" : "DISABLED"}`
    )
  }

  // ========== Skeletal Model Management ==========

  /**
   * Preload a skeletal FBX model using SkeletonCache
   * Use this for character models that need proper bone cloning
   */
  public static async preloadSkeletalModel(path: string): Promise<THREE.Object3D> {
    return AssetManager._skeletonCache.preload(path)
  }

  /**
   * Register a skeletal model directly (for StowKit or other loaders)
   * Use this for character models loaded from StowKit
   */
  public static registerSkeletalModel(path: string, object: THREE.Object3D): void {
    AssetManager._skeletonCache.register(path, object)
  }

  /**
   * Get a properly cloned skeletal model
   * Uses SkeletonUtils.clone() to preserve bone relationships for animation
   */
  public static getSkeletalClone(path: string): THREE.Object3D | null {
    return AssetManager._skeletonCache.getClone(path)
  }

  /**
   * Check if a skeletal model is loaded
   */
  public static isSkeletalModelLoaded(path: string): boolean {
    return AssetManager._skeletonCache.isLoaded(path)
  }

  /**
   * Get the original skeletal model (for reference, not for use)
   */
  public static getSkeletalOriginal(path: string): THREE.Object3D | null {
    return AssetManager._skeletonCache.getOriginal(path)
  }

  /**
   * Clear all global state (for testing) - now includes skeleton cache
   */
  public static reset(): void {
    AssetManager._assets.clear()
    AssetManager._instanceStats.clear()
    AssetManager._gpuBatches.clear()
    AssetManager._isPreloadingComplete = false
    AssetManager._frustumCullingEnabled = false
    AssetManager._frustumCullingPadding = 1.5
    AssetManager._skeletonCache.clear()
  }
}
