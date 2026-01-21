import { Component } from "@engine/core"
import { InstancedMeshManager } from "./InstancedMeshManager"

/**
 * Component for rendering objects using GPU instancing.
 *
 * This component registers the GameObject with an InstancedMeshManager batch.
 * The batch must be pre-created via `InstancedMeshManager.getOrCreateBatch()` before
 * adding this component.
 *
 * Transform is controlled by the GameObject - the manager syncs matrices every frame.
 *
 * Usage:
 * ```typescript
 * // 1. Create batch (once, during game setup)
 * InstancedMeshManager.getInstance().getOrCreateBatch("burger", geometry, material)
 *
 * // 2. Add component to instances
 * gameObject.addComponent(new InstancedRenderer("burger"))
 * ```
 *
 * Key differences from mesh-based renderers (ObjRenderer, etc.):
 * - No getMesh() - instances don't have their own THREE.Object3D
 * - No getBounds() - can query the batch geometry if needed
 * - All instances share the same geometry and material
 */
export class InstancedRenderer extends Component {
  private readonly batchKey: string
  private instanceId: string | null = null

  /**
   * Create an InstancedRenderer
   * @param batchKey The batch key to register with (must match a batch created via getOrCreateBatch)
   */
  constructor(batchKey: string) {
    super()
    this.batchKey = batchKey
  }

  /**
   * Register with the batch when the component is created
   */
  protected onCreate(): void {
    const manager = InstancedMeshManager.getInstance()

    if (!manager.isReady()) {
      console.error(
        `InstancedRenderer: Manager not initialized. Call InstancedMeshManager.getInstance().initialize(scene) first.`
      )
      return
    }

    if (!manager.hasBatch(this.batchKey)) {
      console.error(
        `InstancedRenderer: Batch '${this.batchKey}' not found. Call getOrCreateBatch() first.`
      )
      return
    }

    this.instanceId = manager.addInstance(this.batchKey, this.gameObject)

    if (!this.instanceId) {
      console.error(`InstancedRenderer: Failed to add instance to batch '${this.batchKey}'`)
    }
  }

  /**
   * Set the visibility of this instance
   */
  public setVisible(visible: boolean): void {
    if (this.instanceId) {
      InstancedMeshManager.getInstance().setInstanceVisible(this.batchKey, this.instanceId, visible)
    }
  }

  /**
   * Get the visibility of this instance
   */
  public getVisible(): boolean {
    if (this.instanceId) {
      return InstancedMeshManager.getInstance().getInstanceVisible(this.batchKey, this.instanceId)
    }
    return false
  }

  /**
   * Show the instance (convenience method)
   */
  public show(): void {
    this.setVisible(true)
  }

  /**
   * Hide the instance (convenience method)
   */
  public hide(): void {
    this.setVisible(false)
  }

  /**
   * Get the batch key this renderer is registered with
   */
  public getBatchKey(): string {
    return this.batchKey
  }

  /**
   * Check if this renderer is successfully registered with a batch
   */
  public isRegistered(): boolean {
    return this.instanceId !== null
  }

  /**
   * Get the instance ID (for debugging)
   */
  public getInstanceId(): string | null {
    return this.instanceId
  }

  /**
   * Called when the GameObject becomes enabled
   */
  public onEnabled(): void {
    this.setVisible(true)
  }

  /**
   * Called when the GameObject becomes disabled
   */
  public onDisabled(): void {
    this.setVisible(false)
  }

  /**
   * Unregister from the batch when the component is cleaned up
   */
  protected onCleanup(): void {
    if (this.instanceId) {
      InstancedMeshManager.getInstance().removeInstance(this.batchKey, this.instanceId)
      this.instanceId = null
    }
  }
}
