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
   * Collect all vertex positions from a mesh group, including the root's own transform.
   * Matches the editor's getAllVerticesFromStowMesh which uses parentWorldMatrixInverse
   * (for a detached group, that's identity — so we just use child.matrixWorld directly).
   * Returns a flat Float32Array of [x,y,z, x,y,z, ...].
   */
  private static collectVertices(meshGroup: THREE.Group, scale: THREE.Vector3): Float32Array {
    meshGroup.updateMatrixWorld(true)

    const allVertices: number[] = []
    const vertex = new THREE.Vector3()

    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const posAttr = child.geometry.getAttribute("position")
        if (!posAttr) return

        for (let i = 0; i < posAttr.count; i++) {
          vertex.fromBufferAttribute(posAttr, i)
          vertex.applyMatrix4(child.matrixWorld)
          allVertices.push(
            vertex.x * scale.x,
            vertex.y * scale.y,
            vertex.z * scale.z
          )
        }
      }
    })
    return new Float32Array(allVertices)
  }

  /**
   * Compute bounding box size and center from a mesh group, matching the editor's approach.
   * The editor uses parentWorldMatrixInverse (the scene node's inverse), which for a
   * detached cached mesh group is equivalent to identity. So we use child.matrixWorld
   * directly, which includes the mesh group root's own transform — exactly as the editor does.
   */
  private static computeBounds(meshGroup: THREE.Group, scale: THREE.Vector3): { size: THREE.Vector3; center: THREE.Vector3 } | null {
    // Ensure all matrices in the hierarchy are up to date
    meshGroup.updateMatrixWorld(true)

    const box = new THREE.Box3()
    let foundMesh = false

    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        foundMesh = true
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox()
        }
        if (child.geometry.boundingBox) {
          const tempBox = child.geometry.boundingBox.clone()

          // Use child.matrixWorld directly — includes the mesh group root's transform,
          // matching editor's generateBoundingBoxGeometry which uses parentWorldMatrixInverse
          // (identity for a detached group)
          tempBox.applyMatrix4(child.matrixWorld)

          box.union(tempBox)
        }
      }
    })

    if (!foundMesh || box.isEmpty()) return null

    const size = new THREE.Vector3()
    box.getSize(size)
    size.multiply(scale)

    const center = new THREE.Vector3()
    box.getCenter(center)
    center.multiply(scale)

    return { size, center }
  }

  protected onCreate(): void {
    const stowkit = StowKitSystem.getInstance()

    stowkit.getMesh(this.meshName).then((meshGroup) => {
      // Guard against GameObject being destroyed while mesh was loading
      if (!this.isAttached()) return

      // Read scale at resolve time, not onCreate time — the game may set scale after instantiation
      const scale = this.gameObject.scale.clone()

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
          centerOffset: new THREE.Vector3(0, 0, 0),
          isSensor: this.isSensor,
          enableCollisionEvents: this.enableCollisionEvents,
        })
        this.gameObject.addComponent(this.rigidBody)
      } else {
        const bounds = MeshColliderComponent.computeBounds(meshGroup, scale)
        if (bounds) {
          this.rigidBody = new RigidBodyComponentThree({
            type: this.bodyType,
            shape: ColliderShape.BOX,
            size: bounds.size,
            centerOffset: bounds.center,
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
