import { Component } from "@engine/core"
import { PrefabComponent } from "../prefabs/PrefabComponent"
import type { ComponentJSON, PrefabNode } from "../prefabs"
import { StowKitSystem } from "../stowkit/StowKitSystem"
import {
    ColliderShape,
    RigidBodyComponentThree,
    RigidBodyType,
} from "./RigidBodyComponentThree"

interface MeshColliderJSON extends ComponentJSON {
    type: "mesh_collider"
    colliderType: "bounding_box"
}

interface StowMeshJSON extends ComponentJSON {
    type: "stow_mesh"
    pack: string
    asset_id: string
}

@PrefabComponent("mesh_collider")
export class MeshColliderComponent extends Component {
    static fromPrefabJSON(json: MeshColliderJSON, node: PrefabNode): MeshColliderComponent | null {
        if (json.colliderType !== "bounding_box") {
            console.warn(`Unknown mesh collider type: ${json.colliderType}`)
            return null
        }

        const stowMeshComponent = node.components.find(c => c.type === "stow_mesh") as StowMeshJSON | undefined
        if (!stowMeshComponent) {
            console.warn("MeshColliderComponent requires a stow_mesh component on the same node")
            return null
        }

        return new MeshColliderComponent(stowMeshComponent.asset_id)
    }

    private rigidBody: RigidBodyComponentThree | null = null
    private readonly meshName: string

    constructor(meshName: string) {
        super()
        this.meshName = meshName
    }

    protected onCreate(): void {
        const stowkit = StowKitSystem.getInstance()
        const scale = this.gameObject.scale.clone()

        stowkit.getMesh(this.meshName).then((meshGroup) => {
            const bounds = stowkit.getBounds(meshGroup)

            if (bounds) {
                const scaledBounds = bounds.clone().multiply(scale)
                this.rigidBody = RigidBodyComponentThree.fromBounds(scaledBounds, {
                    type: RigidBodyType.STATIC,
                    shape: ColliderShape.BOX,
                })
                this.gameObject.addComponent(this.rigidBody)
            }
        })
    }

    public getRigidBody(): RigidBodyComponentThree | null {
        return this.rigidBody
    }
}
