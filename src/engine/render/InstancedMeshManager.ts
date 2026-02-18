import * as THREE from "three"
import { GameObject } from "@engine/core"

/**
 * Per-instance data stored in a batch
 */
interface InstanceData {
  id: string
  gameObject: GameObject
  matrix: THREE.Matrix4
  isActive: boolean
  isDynamic: boolean // Dynamic instances update every frame, static only when dirty
  isDirty: boolean // For static instances - needs matrix update
}

/**
 * A batch of instances sharing the same geometry and material
 */
interface InstanceBatch {
  batchKey: string
  instancedMesh: THREE.InstancedMesh
  dynamicInstances: InstanceData[] // Updated every frame
  staticInstances: InstanceData[] // Only updated when dirty
  instanceMap: Map<string, InstanceData> // O(1) lookup by ID
  maxInstances: number
  geometry: THREE.BufferGeometry
  material: THREE.Material
  needsRebuild: boolean // True when instances added/removed/visibility changed
  hasStaticDirty: boolean // True when any static instance needs update
}

/**
 * Statistics for debugging
 */
interface InstanceStats {
  batchKeys: string[]
  totalInstances: number
  batchCount: number
  instancesPerBatch: Map<string, number>
}

/**
 * Singleton manager for GPU-instanced meshes.
 *
 * This is a generic instancing system that works with any geometry + material combination.
 * Games provide the geometry and material when creating a batch, and the manager handles
 * the THREE.InstancedMesh creation and per-frame matrix updates.
 *
 * Performance optimizations:
 * - Reuses temporary Vector3/Quaternion/Matrix4 objects (no per-frame allocations)
 * - Uses Map for O(1) instance lookups
 * - Only updates GPU when batch is marked dirty
 * - Uses instancedMesh.count instead of writing zero-matrices
 *
 * Usage pattern:
 * ```typescript
 * // 1. Initialize (once, during game setup)
 * InstancedMeshManager.getInstance().initialize(scene)
 *
 * // 2. Register a batch (once per unique mesh type)
 * manager.getOrCreateBatch("burger", burgerGeometry, burgerMaterial)
 *
 * // 3. Add instances (via InstancedRenderer component or directly)
 * const instanceId = manager.addInstance("burger", gameObject)
 *
 * // 4. Update every frame
 * manager.updateAllBatches()
 * ```
 */
export class InstancedMeshManager {
  private static _instance: InstancedMeshManager | null = null

  private scene: THREE.Scene | null = null
  private batches: Map<string, InstanceBatch> = new Map()
  private isInitialized: boolean = false

  private static readonly INITIAL_CAPACITY = 16 // Start small, grow as needed
  private static readonly GROWTH_FACTOR = 2 // Double capacity when full

  // Reusable temp objects to avoid per-frame allocations
  private readonly _tempPosition = new THREE.Vector3()
  private readonly _tempQuaternion = new THREE.Quaternion()
  private readonly _tempScale = new THREE.Vector3()

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): InstancedMeshManager {
    if (!InstancedMeshManager._instance) {
      InstancedMeshManager._instance = new InstancedMeshManager()
    }
    return InstancedMeshManager._instance
  }

  /**
   * Initialize the manager with a scene reference.
   * Must be called before creating batches.
   * @param scene The THREE.Scene to add InstancedMesh objects to
   */
  public initialize(scene: THREE.Scene): void {
    if (this.isInitialized) {
      console.warn("InstancedMeshManager: Already initialized")
      return
    }
    this.scene = scene
    this.isInitialized = true
  }

  /**
   * Check if the manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.scene !== null
  }

  /**
   * Get or create a batch for a given key.
   * If the batch already exists, returns it (geometry/material params are ignored).
   * If not, creates a new batch with the provided geometry and material.
   *
   * @param batchKey Unique identifier for this batch (e.g., "burger", "tree_pine")
   * @param geometry BufferGeometry to use for all instances
   * @param material Material to use for all instances
   * @param castShadow Whether instances cast shadows (default: false)
   * @param receiveShadow Whether instances receive shadows (default: false)
   * @param initialCapacity Starting capacity (will grow automatically). Default: 16
   * @returns The batch, or null if manager not initialized
   */
  public getOrCreateBatch(
    batchKey: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    castShadow: boolean = false,
    receiveShadow: boolean = false,
    initialCapacity: number = InstancedMeshManager.INITIAL_CAPACITY
  ): InstanceBatch | null {
    if (!this.isInitialized || !this.scene) {
      console.error("InstancedMeshManager: Not initialized. Call initialize(scene) first.")
      return null
    }

    // Return existing batch if it exists
    const existing = this.batches.get(batchKey)
    if (existing) {
      return existing
    }

    // Round up to next power of 2 for efficient growth
    const capacity = this.nextPowerOf2(initialCapacity)

    // Create new InstancedMesh
    const instancedMesh = new THREE.InstancedMesh(geometry, material, capacity)
    instancedMesh.name = `instanced_${batchKey}`
    instancedMesh.castShadow = castShadow
    instancedMesh.receiveShadow = receiveShadow
    instancedMesh.frustumCulled = false // We handle culling ourselves if needed
    instancedMesh.count = 0 // Start with 0 visible instances

    // Add to scene
    this.scene.add(instancedMesh)

    // Create batch
    const batch: InstanceBatch = {
      batchKey,
      instancedMesh,
      dynamicInstances: [],
      staticInstances: [],
      instanceMap: new Map(), // O(1) lookup
      maxInstances: capacity,
      geometry,
      material,
      needsRebuild: false,
      hasStaticDirty: false,
    }

    this.batches.set(batchKey, batch)
    return batch
  }

  /**
   * Create a batch automatically from a GameObject's mesh.
   * Extracts geometry and material from the first Mesh found in the GameObject.
   */
  public getOrCreateBatchFromGameObject(
    batchKey: string,
    gameObject: GameObject,
    castShadow: boolean = false,
    receiveShadow: boolean = false,
    initialCapacity: number = InstancedMeshManager.INITIAL_CAPACITY
  ): InstanceBatch | null {
    // Return existing batch if it exists
    const existing = this.batches.get(batchKey)
    if (existing) {
      return existing
    }

    // Find the first mesh in the GameObject hierarchy
    let geometry: THREE.BufferGeometry | null = null
    let material: THREE.Material | null = null

    gameObject.traverse((child) => {
      if (!geometry && child instanceof THREE.Mesh) {
        geometry = child.geometry
        material = Array.isArray(child.material) ? child.material[0] : child.material
      }
    })

    if (!geometry || !material) {
      console.error(`InstancedMeshManager: No mesh found in GameObject for batch '${batchKey}'`)
      return null
    }

    return this.getOrCreateBatch(
      batchKey,
      geometry,
      material,
      castShadow,
      receiveShadow,
      initialCapacity
    )
  }

  /**
   * Round up to the next power of 2
   */
  private nextPowerOf2(n: number): number {
    if (n <= 0) return 1
    n--
    n |= n >> 1
    n |= n >> 2
    n |= n >> 4
    n |= n >> 8
    n |= n >> 16
    return n + 1
  }

  /**
   * Resize a batch to a new capacity (must be larger than current)
   */
  private resizeBatch(batch: InstanceBatch, newCapacity: number): void {
    if (!this.scene) return

    const capacity = this.nextPowerOf2(newCapacity)
    if (capacity <= batch.maxInstances) return

    // Create new larger InstancedMesh
    const newInstancedMesh = new THREE.InstancedMesh(batch.geometry, batch.material, capacity)
    newInstancedMesh.name = batch.instancedMesh.name
    newInstancedMesh.castShadow = batch.instancedMesh.castShadow
    newInstancedMesh.receiveShadow = batch.instancedMesh.receiveShadow
    newInstancedMesh.frustumCulled = false
    newInstancedMesh.count = batch.instancedMesh.count

    // Copy existing matrices to new mesh
    for (let i = 0; i < batch.instancedMesh.count; i++) {
      const matrix = new THREE.Matrix4()
      batch.instancedMesh.getMatrixAt(i, matrix)
      newInstancedMesh.setMatrixAt(i, matrix)
    }
    newInstancedMesh.instanceMatrix.needsUpdate = true

    // Swap in scene
    this.scene.remove(batch.instancedMesh)
    batch.instancedMesh.dispose()
    this.scene.add(newInstancedMesh)

    // Update batch
    batch.instancedMesh = newInstancedMesh
    batch.maxInstances = capacity

    console.log(`InstancedMeshManager: Resized batch '${batch.batchKey}' to ${capacity} instances`)
  }

  /**
   * Check if a batch exists for the given key
   */
  public hasBatch(batchKey: string): boolean {
    return this.batches.has(batchKey)
  }

  /**
   * Get a batch by key (without creating it)
   */
  public getBatch(batchKey: string): InstanceBatch | null {
    return this.batches.get(batchKey) || null
  }

  /**
   * Get total instance count for a batch
   */
  private getTotalInstanceCount(batch: InstanceBatch): number {
    return batch.dynamicInstances.length + batch.staticInstances.length
  }

  /**
   * Options for adding an instance
   */
  public static readonly AddInstanceOptions = {
    isDynamic: true,
    castShadow: false,
    receiveShadow: false,
    initialCapacity: undefined as number | undefined,
  }

  /**
   * Add an instance to a batch.
   * If no batch exists, creates one automatically from the GameObject's mesh.
   * If batch is full, automatically resizes to accommodate more instances.
   *
   * @param batchKey The batch to add to
   * @param gameObject The GameObject whose transform will be used
   * @param options Configuration options (isDynamic, castShadow, receiveShadow, initialCapacity)
   * @returns Instance ID, or null if failed
   */
  public addInstance(
    batchKey: string,
    gameObject: GameObject,
    options: {
      isDynamic?: boolean
      castShadow?: boolean
      receiveShadow?: boolean
      initialCapacity?: number
    } = {}
  ): string | null {
    const isDynamic = options.isDynamic ?? true
    const castShadow = options.castShadow ?? false
    const receiveShadow = options.receiveShadow ?? false
    const initialCapacity = options.initialCapacity ?? InstancedMeshManager.INITIAL_CAPACITY

    // Auto-create batch if it doesn't exist
    let batch: InstanceBatch | null = this.batches.get(batchKey) ?? null
    if (!batch) {
      batch = this.getOrCreateBatchFromGameObject(
        batchKey,
        gameObject,
        castShadow,
        receiveShadow,
        initialCapacity
      )
      if (!batch) {
        return null
      }
    }

    // Auto-resize if full
    if (this.getTotalInstanceCount(batch) >= batch.maxInstances) {
      this.resizeBatch(batch, batch.maxInstances * InstancedMeshManager.GROWTH_FACTOR)
    }

    const instanceId = `${batchKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const instanceData: InstanceData = {
      id: instanceId,
      gameObject,
      matrix: new THREE.Matrix4(),
      isActive: true,
      isDynamic,
      isDirty: true, // Initial update needed
    }

    // Set initial matrix from GameObject world transform
    this.updateInstanceMatrix(instanceData)

    // Add to appropriate array
    if (isDynamic) {
      batch.dynamicInstances.push(instanceData)
    } else {
      batch.staticInstances.push(instanceData)
    }

    batch.instanceMap.set(instanceId, instanceData)
    batch.needsRebuild = true // New instance added

    return instanceId
  }

  /**
   * Remove an instance from a batch
   * @param batchKey The batch to remove from
   * @param instanceId The instance ID to remove
   */
  public removeInstance(batchKey: string, instanceId: string): void {
    const batch = this.batches.get(batchKey)
    if (!batch) return

    // O(1) lookup
    const instance = batch.instanceMap.get(instanceId)
    if (!instance) return

    // Remove from appropriate array using swap-remove
    const targetArray = instance.isDynamic ? batch.dynamicInstances : batch.staticInstances
    const index = targetArray.indexOf(instance)
    if (index !== -1) {
      const lastIndex = targetArray.length - 1
      if (index !== lastIndex) {
        targetArray[index] = targetArray[lastIndex]
      }
      targetArray.pop()
    }

    // Remove from map
    batch.instanceMap.delete(instanceId)
    batch.needsRebuild = true // Instance removed
  }

  /**
   * Set the visibility of a specific instance
   * @param batchKey The batch containing the instance
   * @param instanceId The instance ID
   * @param visible Whether the instance should be visible
   */
  public setInstanceVisible(batchKey: string, instanceId: string, visible: boolean): void {
    const batch = this.batches.get(batchKey)
    if (!batch) return

    // O(1) lookup
    const instance = batch.instanceMap.get(instanceId)
    if (!instance) return

    if (instance.isActive !== visible) {
      instance.isActive = visible
      batch.needsRebuild = true // Visibility change affects instance count
    }
  }

  /**
   * Get the visibility of a specific instance
   */
  public getInstanceVisible(batchKey: string, instanceId: string): boolean {
    const batch = this.batches.get(batchKey)
    if (!batch) return false

    // O(1) lookup
    const instance = batch.instanceMap.get(instanceId)
    return instance?.isActive ?? false
  }

  /**
   * Mark a static instance as dirty (needs matrix update next frame).
   * Call this when a static instance's transform changes.
   * No-op for dynamic instances (they update every frame anyway).
   */
  public markInstanceDirty(batchKey: string, instanceId: string): void {
    const batch = this.batches.get(batchKey)
    if (!batch) return

    const instance = batch.instanceMap.get(instanceId)
    if (!instance || instance.isDynamic) return

    instance.isDirty = true
    batch.hasStaticDirty = true
  }

  /**
   * Set whether an instance is dynamic (updates every frame) or static (only when dirty).
   * Use this when an item transitions between moving and stationary states.
   */
  public setInstanceDynamic(batchKey: string, instanceId: string, isDynamic: boolean): void {
    const batch = this.batches.get(batchKey)
    if (!batch) return

    const instance = batch.instanceMap.get(instanceId)
    if (!instance || instance.isDynamic === isDynamic) return

    // Remove from current array
    const sourceArray = instance.isDynamic ? batch.dynamicInstances : batch.staticInstances
    const index = sourceArray.indexOf(instance)
    if (index !== -1) {
      const lastIndex = sourceArray.length - 1
      if (index !== lastIndex) {
        sourceArray[index] = sourceArray[lastIndex]
      }
      sourceArray.pop()
    }

    // Add to new array
    instance.isDynamic = isDynamic
    if (isDynamic) {
      batch.dynamicInstances.push(instance)
    } else {
      instance.isDirty = true // Ensure it gets one update
      batch.staticInstances.push(instance)
      batch.hasStaticDirty = true
    }
  }

  /**
   * Update the matrix for a single instance from its GameObject.
   * Uses reusable temp objects to avoid per-frame allocations.
   */
  private updateInstanceMatrix(instance: InstanceData): void {
    instance.gameObject.getWorldPosition(this._tempPosition)
    instance.gameObject.getWorldQuaternion(this._tempQuaternion)
    instance.gameObject.getWorldScale(this._tempScale)

    instance.matrix.compose(this._tempPosition, this._tempQuaternion, this._tempScale)
  }

  /**
   * Update a single batch - sync matrices and upload to GPU.
   * Optimized to only update what's necessary:
   * - Dynamic instances: always update matrix
   * - Static instances: only update if marked dirty
   * - GPU upload: only if anything changed
   */
  private updateBatch(batch: InstanceBatch): void {
    const hasDynamicActive = batch.dynamicInstances.some((i) => i.isActive)
    const needsGpuUpdate = hasDynamicActive || batch.needsRebuild || batch.hasStaticDirty

    // Early exit if nothing needs updating
    if (!needsGpuUpdate) {
      return
    }

    let visibleIndex = 0

    // Process dynamic instances (always update matrix)
    for (const instance of batch.dynamicInstances) {
      if (instance.isActive) {
        this.updateInstanceMatrix(instance)
        batch.instancedMesh.setMatrixAt(visibleIndex, instance.matrix)
        visibleIndex++
      }
    }

    // Process static instances (only update matrix if dirty OR rebuild needed)
    for (const instance of batch.staticInstances) {
      if (instance.isActive) {
        // Only recalculate matrix if this instance is dirty
        if (instance.isDirty || batch.needsRebuild) {
          this.updateInstanceMatrix(instance)
          instance.isDirty = false
        }
        batch.instancedMesh.setMatrixAt(visibleIndex, instance.matrix)
        visibleIndex++
      }
    }

    // Update GPU
    batch.instancedMesh.instanceMatrix.needsUpdate = true
    batch.instancedMesh.count = visibleIndex

    // Clear flags
    batch.needsRebuild = false
    batch.hasStaticDirty = false
  }

  /**
   * Update all batches - call this every frame.
   * Optimized to skip batches with no changes.
   */
  public updateAllBatches(): void {
    for (const batch of this.batches.values()) {
      this.updateBatch(batch)
    }
  }

  /**
   * Get statistics for debugging
   */
  public getStats(): InstanceStats {
    const instancesPerBatch = new Map<string, number>()
    let totalInstances = 0

    for (const [key, batch] of this.batches) {
      const dynamicActive = batch.dynamicInstances.filter((i) => i.isActive).length
      const staticActive = batch.staticInstances.filter((i) => i.isActive).length
      const activeCount = dynamicActive + staticActive
      instancesPerBatch.set(key, activeCount)
      totalInstances += activeCount
    }

    return {
      batchKeys: Array.from(this.batches.keys()),
      totalInstances,
      batchCount: this.batches.size,
      instancesPerBatch,
    }
  }

  /**
   * Print a debug report to console
   */
  public debugReport(): void {
    const stats = this.getStats()
    console.log("=== InstancedMeshManager Report ===")
    console.log(`Batches: ${stats.batchCount}`)
    console.log(`Total instances: ${stats.totalInstances}`)
    for (const [key, count] of stats.instancesPerBatch) {
      const batch = this.batches.get(key)!
      const dynamicCount = batch.dynamicInstances.length
      const staticCount = batch.staticInstances.length
      console.log(
        `  ${key}: ${count}/${batch.maxInstances} active (${dynamicCount} dynamic, ${staticCount} static)`
      )
    }
  }

  /**
   * Remove a batch entirely
   */
  public removeBatch(batchKey: string): void {
    const batch = this.batches.get(batchKey)
    if (!batch) return

    // Remove from scene
    if (this.scene) {
      this.scene.remove(batch.instancedMesh)
    }

    // Dispose geometry and material if we created them
    // Note: We don't dispose here since the caller provided them
    // They're responsible for disposal if needed

    this.batches.delete(batchKey)
  }

  /**
   * Dispose of all batches and reset the manager
   */
  public dispose(): void {
    for (const [key] of this.batches) {
      this.removeBatch(key)
    }
    this.batches.clear()
    this.scene = null
    this.isInitialized = false
  }

  /**
   * Reset the singleton (for testing)
   */
  public static reset(): void {
    if (InstancedMeshManager._instance) {
      InstancedMeshManager._instance.dispose()
      InstancedMeshManager._instance = null
    }
  }
}
