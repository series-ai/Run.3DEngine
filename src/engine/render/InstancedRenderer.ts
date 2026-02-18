import { Component } from "@engine/core"
import { InstancedMeshManager } from "./InstancedMeshManager"

/**
 * Options for InstancedRenderer
 */
export interface InstancedRendererOptions {
  /** If true (default), matrix updates every frame. If false, only updates when markDirty() is called. */
  isDynamic?: boolean
  /** Whether instances cast shadows (default: false). Only used if batch is auto-created. */
  castShadow?: boolean
  /** Whether instances receive shadows (default: false). Only used if batch is auto-created. */
  receiveShadow?: boolean
  /** Initial batch capacity (default: 16, grows automatically). Only used if batch is auto-created. */
  initialCapacity?: number
}

/**
 * Component for rendering objects using GPU instancing.
 *
 * Transform is controlled by the GameObject - the manager syncs matrices every frame.
 * If no batch exists for the key, one is created automatically from the GameObject's mesh.
 *
 * Performance modes:
 * - Dynamic (default): Matrix updates every frame. Use for moving objects.
 * - Static: Matrix only updates when markDirty() is called. Use for stationary objects.
 *
 * Usage:
 * ```typescript
 * // Simple - batch auto-creates from GameObject's mesh
 * gameObject.addComponent(new InstancedRenderer("burger"))
 *
 * // With options
 * gameObject.addComponent(new InstancedRenderer("burger", {
 *   isDynamic: false,
 *   castShadow: true
 * }))
 *
 * // For stationary objects, switch to static mode
 * renderer.setDynamic(false)
 *
 * // When a static object moves, mark it dirty
 * renderer.markDirty()
 * ```
 *
 * Key differences from mesh-based renderers (ObjRenderer, etc.):
 * - No getMesh() - instances don't have their own THREE.Object3D
 * - No getBounds() - can query the batch geometry if needed
 * - All instances share the same geometry and material
 */
export class InstancedRenderer extends Component {
  private readonly batchKey: string
  private readonly options: InstancedRendererOptions
  private instanceId: string | null = null

  /**
   * Create an InstancedRenderer
   * @param batchKey The batch key to register with. If no batch exists, one is auto-created.
   * @param options Configuration options (or just pass `true`/`false` for isDynamic)
   */
  constructor(batchKey: string, options: InstancedRendererOptions | boolean = {}) {
    super()
    this.batchKey = batchKey
    // Support legacy boolean parameter for isDynamic
    this.options = typeof options === "boolean" ? { isDynamic: options } : options
  }

  /**
   * Register with the batch when the component is created.
   * If no batch exists, one will be created automatically from this GameObject's mesh.
   */
  protected onCreate(): void {
    const manager = InstancedMeshManager.getInstance()

    if (!manager.isReady()) {
      console.error(
        `InstancedRenderer: Manager not initialized. Call InstancedMeshManager.getInstance().initialize(scene) first.`
      )
      return
    }

    // addInstance now auto-creates batch from GameObject if needed
    this.instanceId = manager.addInstance(this.batchKey, this.gameObject, {
      isDynamic: this.options.isDynamic ?? true,
      castShadow: this.options.castShadow ?? false,
      receiveShadow: this.options.receiveShadow ?? false,
      initialCapacity: this.options.initialCapacity,
    })

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
   * Mark this instance as needing a matrix update.
   * Only relevant for static instances - dynamic instances update every frame anyway.
   * Call this when the transform of a static instance changes.
   */
  public markDirty(): void {
    if (this.instanceId) {
      InstancedMeshManager.getInstance().markInstanceDirty(this.batchKey, this.instanceId)
    }
  }

  /**
   * Set whether this instance is dynamic (updates every frame) or static (only when marked dirty).
   * Use this to optimize performance when items transition between moving and stationary states.
   * @param isDynamic If true, updates every frame. If false, only updates when markDirty() is called.
   */
  public setDynamic(isDynamic: boolean): void {
    if (this.instanceId) {
      InstancedMeshManager.getInstance().setInstanceDynamic(
        this.batchKey,
        this.instanceId,
        isDynamic
      )
    }
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
