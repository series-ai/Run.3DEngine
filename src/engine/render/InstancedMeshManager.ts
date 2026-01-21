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
}

/**
 * A batch of instances sharing the same geometry and material
 */
interface InstanceBatch {
  batchKey: string
  instancedMesh: THREE.InstancedMesh
  instances: InstanceData[]
  maxInstances: number
  geometry: THREE.BufferGeometry
  material: THREE.Material
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

  private static readonly DEFAULT_MAX_INSTANCES = 500

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
   * @param maxInstances Maximum number of instances in this batch (default: 500)
   * @param castShadow Whether instances cast shadows (default: true)
   * @param receiveShadow Whether instances receive shadows (default: true)
   * @returns The batch, or null if manager not initialized
   */
  public getOrCreateBatch(
    batchKey: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    maxInstances: number = InstancedMeshManager.DEFAULT_MAX_INSTANCES,
    castShadow: boolean = true,
    receiveShadow: boolean = true
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

    // Create new InstancedMesh
    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances)
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
      instances: [],
      maxInstances,
      geometry,
      material,
    }

    this.batches.set(batchKey, batch)
    return batch
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
   * Add an instance to a batch.
   * The batch must already exist (call getOrCreateBatch first).
   *
   * @param batchKey The batch to add to
   * @param gameObject The GameObject whose transform will be used
   * @returns Instance ID, or null if failed
   */
  public addInstance(batchKey: string, gameObject: GameObject): string | null {
    const batch = this.batches.get(batchKey)
    if (!batch) {
      console.error(`InstancedMeshManager: Batch '${batchKey}' not found. Call getOrCreateBatch first.`)
      return null
    }

    if (batch.instances.length >= batch.maxInstances) {
      console.warn(`InstancedMeshManager: Batch '${batchKey}' is full (${batch.maxInstances} instances)`)
      return null
    }

    const instanceId = `${batchKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const instanceData: InstanceData = {
      id: instanceId,
      gameObject,
      matrix: new THREE.Matrix4(),
      isActive: true,
    }

    // Set initial matrix from GameObject world transform
    this.updateInstanceMatrix(instanceData)

    batch.instances.push(instanceData)

    // Update the batch immediately so the instance is visible
    this.updateBatch(batch)

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

    const index = batch.instances.findIndex((inst) => inst.id === instanceId)
    if (index === -1) return

    // Swap with last element and pop (O(1) removal)
    const lastIndex = batch.instances.length - 1
    if (index !== lastIndex) {
      batch.instances[index] = batch.instances[lastIndex]
    }
    batch.instances.pop()

    // Update batch to reflect removal
    this.updateBatch(batch)
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

    const instance = batch.instances.find((inst) => inst.id === instanceId)
    if (!instance) return

    instance.isActive = visible

    // Update batch immediately
    this.updateBatch(batch)
  }

  /**
   * Get the visibility of a specific instance
   */
  public getInstanceVisible(batchKey: string, instanceId: string): boolean {
    const batch = this.batches.get(batchKey)
    if (!batch) return false

    const instance = batch.instances.find((inst) => inst.id === instanceId)
    return instance?.isActive ?? false
  }

  /**
   * Update the matrix for a single instance from its GameObject
   */
  private updateInstanceMatrix(instance: InstanceData): void {
    const worldPosition = new THREE.Vector3()
    const worldQuaternion = new THREE.Quaternion()
    const worldScale = new THREE.Vector3()

    instance.gameObject.getWorldPosition(worldPosition)
    instance.gameObject.getWorldQuaternion(worldQuaternion)
    instance.gameObject.getWorldScale(worldScale)

    instance.matrix.compose(worldPosition, worldQuaternion, worldScale)
  }

  /**
   * Update a single batch - sync matrices and upload to GPU
   */
  private updateBatch(batch: InstanceBatch): void {
    let visibleIndex = 0

    for (const instance of batch.instances) {
      if (instance.isActive) {
        // Update matrix from GameObject transform
        this.updateInstanceMatrix(instance)
        batch.instancedMesh.setMatrixAt(visibleIndex, instance.matrix)
        visibleIndex++
      }
    }

    // Hide unused slots with zero-scale matrices
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = visibleIndex; i < batch.maxInstances; i++) {
      batch.instancedMesh.setMatrixAt(i, zeroMatrix)
    }

    // Update GPU
    batch.instancedMesh.instanceMatrix.needsUpdate = true
    batch.instancedMesh.count = visibleIndex
  }

  /**
   * Update all batches - call this every frame.
   * Syncs all instance matrices from their GameObjects and uploads to GPU.
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
      const activeCount = batch.instances.filter((i) => i.isActive).length
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
      console.log(`  ${key}: ${count}/${batch.maxInstances} instances`)
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
