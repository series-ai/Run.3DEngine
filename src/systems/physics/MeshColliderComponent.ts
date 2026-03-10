import * as THREE from "three"
import { Component } from "@engine/core"
import { PrefabComponent } from "../prefabs/PrefabComponent"
import type { ComponentJSON, PrefabNode } from "../prefabs"
import { StowKitSystem } from "../stowkit/StowKitSystem"
import { ColliderShape, RigidBodyComponentThree, RigidBodyType } from "./RigidBodyComponentThree"

type MeshColliderType = "bounding_box" | "convex_hull"

interface MeshColliderJSON extends ComponentJSON {
  type: "mesh_collider"
  colliderType?: MeshColliderType
  bodyType?: "static" | "kinematic" | "dynamic"
  isSensor?: boolean
  enableCollisionEvents?: boolean
  excludeChildren?: boolean
  /** nodeOverrides wraps properties inside a `data` object */
  data?: {
    colliderType?: MeshColliderType
    bodyType?: "static" | "kinematic" | "dynamic"
    isSensor?: boolean
    enableCollisionEvents?: boolean
    excludeChildren?: boolean
  }
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
  static fromPrefabJSON(json: MeshColliderJSON, node: PrefabNode | null): MeshColliderComponent | null {
    // nodeOverrides wraps properties in a `data` object — unwrap if present
    const props = json.data ?? json
    const colliderType: MeshColliderType = props.colliderType ?? "bounding_box"
    if (colliderType !== "bounding_box" && colliderType !== "convex_hull") {
      console.warn(`Unknown mesh collider type: ${props.colliderType}`)
      return null
    }

    const bodyType = (props.bodyType as RigidBodyType) ?? RigidBodyType.STATIC
    const isSensor = props.isSensor
    const enableCollisionEvents = props.enableCollisionEvents
    const excludeChildren = props.excludeChildren ?? false

    // Sub-mesh node case: no PrefabNode available, compute bounds from own children
    if (!node) {
      return new MeshColliderComponent(null, colliderType, bodyType, isSensor, enableCollisionEvents, excludeChildren)
    }

    const stowMeshComponent = node.components.find((c) => c.type === "stow_mesh") as
      | StowMeshJSON
      | undefined
    if (!stowMeshComponent) {
      console.warn("MeshColliderComponent requires a stow_mesh component on the same node")
      return null
    }

    return new MeshColliderComponent(stowMeshComponent.mesh.assetId, colliderType, bodyType, isSensor, enableCollisionEvents, excludeChildren)
  }

  private rigidBody: RigidBodyComponentThree | null = null
  private readonly meshName: string | null
  private readonly colliderType: MeshColliderType
  private readonly bodyType: RigidBodyType
  private readonly isSensor?: boolean
  private readonly enableCollisionEvents?: boolean
  private readonly excludeChildren: boolean

  constructor(
    meshName: string | null,
    colliderType: MeshColliderType = "bounding_box",
    bodyType: RigidBodyType = RigidBodyType.STATIC,
    isSensor?: boolean,
    enableCollisionEvents?: boolean,
    excludeChildren: boolean = false
  ) {
    super()
    this.meshName = meshName
    this.colliderType = colliderType
    this.bodyType = bodyType
    this.isSensor = isSensor
    this.enableCollisionEvents = enableCollisionEvents
    this.excludeChildren = excludeChildren
  }

  /** Iterate meshes, optionally only direct children */
  private static forEachMesh(root: THREE.Object3D, excludeChildren: boolean, fn: (mesh: THREE.Mesh) => void): void {
    if (excludeChildren) {
      for (const child of root.children) {
        if ((child as any).isMesh) fn(child as THREE.Mesh)
      }
    } else {
      root.traverse((child) => {
        if ((child as any).isMesh) fn(child as THREE.Mesh)
      })
    }
  }

  /**
   * Collect all vertex positions from a mesh group.
   * Returns a flat Float32Array of [x,y,z, x,y,z, ...].
   */
  private static collectVertices(meshGroup: THREE.Object3D, scale: THREE.Vector3, excludeChildren: boolean = false): Float32Array {
    meshGroup.updateMatrixWorld(true)

    const allVertices: number[] = []
    const vertex = new THREE.Vector3()

    MeshColliderComponent.forEachMesh(meshGroup, excludeChildren, (mesh) => {
      if (!mesh.geometry) return
      const posAttr = mesh.geometry.getAttribute("position")
      if (!posAttr) return

      for (let i = 0; i < posAttr.count; i++) {
        vertex.fromBufferAttribute(posAttr, i)
        vertex.applyMatrix4(mesh.matrixWorld)
        allVertices.push(
          vertex.x * scale.x,
          vertex.y * scale.y,
          vertex.z * scale.z
        )
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
  private static computeBounds(meshGroup: THREE.Object3D, scale: THREE.Vector3, excludeChildren: boolean = false): { size: THREE.Vector3; center: THREE.Vector3 } | null {
    meshGroup.updateMatrixWorld(true)

    const box = new THREE.Box3()
    let foundMesh = false

    MeshColliderComponent.forEachMesh(meshGroup, excludeChildren, (mesh) => {
      if (!mesh.geometry) return
      foundMesh = true
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox()
      }
      if (mesh.geometry.boundingBox) {
        const tempBox = mesh.geometry.boundingBox.clone()
        tempBox.applyMatrix4(mesh.matrixWorld)
        box.union(tempBox)
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
    if (this.meshName) {
      // Standard path: load mesh by name from StowKit
      const stowkit = StowKitSystem.getInstance()
      stowkit.getMesh(this.meshName).then((meshGroup) => {
        if (!this.isAttached()) return
        this.createCollider(meshGroup)
      })
    } else {
      // Sub-mesh node path: geometry is already on this gameObject
      this.createCollider(this.gameObject)
    }
  }

  private createCollider(meshRoot: THREE.Object3D): void {
    const scale = this.gameObject.scale.clone()

    if (this.colliderType === "convex_hull") {
      const vertices = MeshColliderComponent.collectVertices(meshRoot, scale, this.excludeChildren)
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
      const bounds = MeshColliderComponent.computeBounds(meshRoot, scale, this.excludeChildren)
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
  }

  public getRigidBody(): RigidBodyComponentThree | null {
    return this.rigidBody
  }
}
