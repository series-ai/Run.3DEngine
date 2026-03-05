import * as THREE from "three"
import { Component } from "@engine/core"
import { PrefabComponent } from "../prefabs/PrefabComponent"
import type { ComponentJSON, PrefabNode } from "../prefabs"
import { StowKitSystem } from "../stowkit/StowKitSystem"
import { ColliderShape, RigidBodyComponentThree, RigidBodyType } from "./RigidBodyComponentThree"

type MeshColliderType = "bounding_box" | "convex_hull"

interface MeshColliderJSON extends ComponentJSON {
  type: "mesh_collider"
  colliderType: MeshColliderType
  bodyType?: "static" | "kinematic" | "dynamic"
  isSensor?: boolean
  enableCollisionEvents?: boolean
}

interface StowMeshJSON extends ComponentJSON {
  type: "stow_mesh"
  mesh: {
    pack: string
    assetId: string
  }
}

@PrefabComponent("mesh_collider")
export class MeshColliderComponent extends Component {
  static fromPrefabJSON(json: MeshColliderJSON, node: PrefabNode): MeshColliderComponent | null {
    const colliderType: MeshColliderType = json.colliderType ?? "bounding_box"
    if (colliderType !== "bounding_box" && colliderType !== "convex_hull") {
      console.warn(`Unknown mesh collider type: ${json.colliderType}`)
      return null
    }

    const stowMeshComponent = node.components.find((c) => c.type === "stow_mesh") as
      | StowMeshJSON
      | undefined
    if (!stowMeshComponent) {
      console.warn("MeshColliderComponent requires a stow_mesh component on the same node")
      return null
    }

    const bodyType = (json.bodyType as RigidBodyType) ?? RigidBodyType.STATIC
    return new MeshColliderComponent(stowMeshComponent.mesh.assetId, colliderType, bodyType, json.isSensor, json.enableCollisionEvents)
  }

  private rigidBody: RigidBodyComponentThree | null = null
  private readonly meshName: string
  private readonly colliderType: MeshColliderType
  private readonly bodyType: RigidBodyType
  private readonly isSensor?: boolean
  private readonly enableCollisionEvents?: boolean

  constructor(
    meshName: string,
    colliderType: MeshColliderType = "bounding_box",
    bodyType: RigidBodyType = RigidBodyType.STATIC,
    isSensor?: boolean,
    enableCollisionEvents?: boolean
  ) {
    super()
    this.meshName = meshName
    this.colliderType = colliderType
    this.bodyType = bodyType
    this.isSensor = isSensor
    this.enableCollisionEvents = enableCollisionEvents
  }

  /**
   * Collect all vertex positions from a mesh group, scaled by the given vector.
   * Returns a flat Float32Array of [x,y,z, x,y,z, ...] in local space.
   */
  private static collectVertices(meshGroup: THREE.Group, scale: THREE.Vector3): Float32Array {
    const allVertices: number[] = []
    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const posAttr = child.geometry.getAttribute("position")
        if (!posAttr) return
        for (let i = 0; i < posAttr.count; i++) {
          allVertices.push(
            posAttr.getX(i) * scale.x,
            posAttr.getY(i) * scale.y,
            posAttr.getZ(i) * scale.z
          )
        }
      }
    })
    return new Float32Array(allVertices)
  }

  protected onCreate(): void {
    const stowkit = StowKitSystem.getInstance()
    const scale = this.gameObject.scale.clone()

    stowkit.getMesh(this.meshName).then((meshGroup) => {
      if (this.colliderType === "convex_hull") {
        const vertices = MeshColliderComponent.collectVertices(meshGroup, scale)
        if (vertices.length < 9) {
          console.warn("MeshColliderComponent: Not enough vertices for convex hull")
          return
        }
        this.rigidBody = new RigidBodyComponentThree({
          type: this.bodyType,
          shape: ColliderShape.CONVEX_HULL,
          vertices,
          isSensor: this.isSensor,
          enableCollisionEvents: this.enableCollisionEvents,
        })
        this.gameObject.addComponent(this.rigidBody)
      } else {
        const bounds = stowkit.getBounds(meshGroup)
        if (bounds) {
          const scaledBounds = bounds.clone().multiply(scale)
          this.rigidBody = RigidBodyComponentThree.fromBounds(scaledBounds, {
            type: this.bodyType,
            shape: ColliderShape.BOX,
            isSensor: this.isSensor,
            enableCollisionEvents: this.enableCollisionEvents,
          })
          this.gameObject.addComponent(this.rigidBody)
        }
      }
    })
  }

  public getRigidBody(): RigidBodyComponentThree | null {
    return this.rigidBody
  }
}
