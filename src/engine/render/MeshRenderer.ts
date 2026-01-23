import * as THREE from "three"
import { Component } from "@engine/core"
import { PrefabComponent, type ComponentJSON, type PrefabNode } from "@systems/prefabs"
import { StowKitSystem } from "@systems/stowkit"

interface StowMeshJSON extends ComponentJSON {
    type: "stow_mesh"
    pack: string
    asset_id: string
}

/**
 * MeshRenderer - Component for rendering a mesh from StowKitSystem.
 *
 * This is a non-instanced renderer - each instance is a separate draw call.
 * Use InstancedRenderer for many instances of the same mesh (better performance).
 *
 * Usage:
 * ```typescript
 * const env = new GameObject("Environment")
 * env.addComponent(new MeshRenderer("restaurant_display_common"))
 * ```
 */
@PrefabComponent("stow_mesh")
export class MeshRenderer extends Component {
    static fromPrefabJSON(json: StowMeshJSON, _node: PrefabNode): MeshRenderer {
        return new MeshRenderer(json.asset_id)
    }

    private mesh: THREE.Group | null = null
    private readonly meshName: string
    private readonly castShadow: boolean
    private readonly receiveShadow: boolean
    private _isStatic: boolean
    private isMeshLoaded: boolean = false
    private loadFailed: boolean = false

    /**
     * @param meshName The name of the mesh in the StowKit pack
     * @param castShadow Whether meshes should cast shadows (default: true)
     * @param receiveShadow Whether meshes should receive shadows (default: true)
     * @param isStatic Whether this mesh is static (default: false). Static meshes have matrixAutoUpdate disabled for better performance.
     */
    constructor(
        meshName: string,
        castShadow: boolean = true,
        receiveShadow: boolean = true,
        isStatic: boolean = false
    ) {
        super()
        this.meshName = meshName
        this.castShadow = castShadow
        this.receiveShadow = receiveShadow
        this._isStatic = isStatic
    }

    protected onCreate(): void {
        const stowkit = StowKitSystem.getInstance()

        // Check if mesh is already cached
        const cachedMesh = stowkit.getMeshSync(this.meshName)
        if (cachedMesh) {
            this.addMesh(cachedMesh)
        } else {
            // Start async load - will add mesh in update when ready
            // Catch errors to prevent crashing the game
            stowkit.getMesh(this.meshName).catch((error) => {
                console.warn(`[MeshRenderer] Failed to load mesh "${this.meshName}":`, error.message)
                this.loadFailed = true
            })
        }
    }

    public update(_deltaTime: number): void {
        if (this.isMeshLoaded || this.loadFailed) return

        const stowkit = StowKitSystem.getInstance()
        const cachedMesh = stowkit.getMeshSync(this.meshName)
        if (cachedMesh) {
            this.addMesh(cachedMesh)
        }
    }

    private addMesh(original: THREE.Group): void {
        this.isMeshLoaded = true

        // Clone mesh with material conversion
        this.mesh = StowKitSystem.getInstance().cloneMeshSync(
            original,
            this.castShadow,
            this.receiveShadow
        )
        this.gameObject.add(this.mesh)

        // For static meshes, disable matrix auto-update to save CPU
        if (this._isStatic) {
            this.setStatic(true)
        }
    }

    /**
     * Check if this mesh is currently static (no automatic matrix updates)
     */
    public get isStatic(): boolean {
        return this._isStatic
    }

    /**
     * Set whether this mesh is static (no automatic matrix updates).
     * Static meshes save CPU by not recalculating transforms every frame.
     * Call forceMatrixUpdate() after moving a static mesh.
     */
    public setStatic(isStatic: boolean): void {
        this._isStatic = isStatic
        if (!this.mesh) return

        if (isStatic) {
            // Update matrices one final time before freezing
            this.forceMatrixUpdate()

            // Disable auto-update on mesh and all descendants
            this.mesh.matrixAutoUpdate = false
            this.mesh.traverse((child) => {
                child.matrixAutoUpdate = false
            })
            this.gameObject.matrixAutoUpdate = false
        } else {
            // Enable auto-update
            this.mesh.matrixAutoUpdate = true
            this.mesh.traverse((child) => {
                child.matrixAutoUpdate = true
            })
            this.gameObject.matrixAutoUpdate = true
        }
    }

    /**
     * Force a one-time matrix update. Call this after moving a static mesh.
     * Does not change the static/dynamic state.
     */
    public forceMatrixUpdate(): void {
        if (this.mesh) {
            this.mesh.updateMatrix()
            this.mesh.updateMatrixWorld(true)
        }
        this.gameObject.updateMatrix()
        this.gameObject.updateMatrixWorld(true)
    }

    /**
     * Get the mesh group (null if not yet loaded)
     */
    public getMesh(): THREE.Group | null {
        return this.mesh
    }

    /**
     * Get the name of the mesh this component is managing
     */
    public getMeshName(): string {
        return this.meshName
    }

    /**
     * Check if the mesh was successfully loaded
     */
    public isLoaded(): boolean {
        return this.mesh !== null
    }

    /**
     * Set the visibility of the mesh
     */
    public setVisible(visible: boolean): void {
        if (this.mesh) {
            this.mesh.visible = visible
        }
    }

    /**
     * Get bounds of the mesh (useful for physics)
     */
    public getBounds(): THREE.Vector3 | null {
        if (!this.mesh) {
            return null
        }
        return StowKitSystem.getInstance().getBounds(this.mesh)
    }

    /**
     * Cleanup - remove mesh from scene and dispose of resources
     */
    protected onCleanup(): void {
        if (this.mesh) {
            // Remove from GameObject/scene
            this.gameObject.remove(this.mesh)

            // Traverse and dispose of geometries and materials
            this.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) {
                        child.geometry.dispose()
                    }

                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m) => {
                                if (m.map) m.map.dispose()
                                m.dispose()
                            })
                        } else {
                            if (child.material.map) child.material.map.dispose()
                            child.material.dispose()
                        }
                    }
                }
            })

            this.mesh = null
        }
    }
}
