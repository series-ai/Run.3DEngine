import * as THREE from "three"
import { Component } from "@engine/core"
import { PrefabComponent } from "../prefabs/PrefabComponent"
import type { ComponentJSON, PrefabNode } from "../prefabs"
import { ColliderShape, RigidBodyComponentThree, RigidBodyType } from "./RigidBodyComponentThree"

interface SphereComponentJSON extends ComponentJSON {
  type: "sphere"
  isCollider?: boolean
  radius: number
  offset: number[]
  bodyType?: "static" | "kinematic" | "dynamic"
  isSensor?: boolean
  enableCollisionEvents?: boolean
}

@PrefabComponent("sphere")
export class SphereColliderComponent extends Component {
  static fromPrefabJSON(json: SphereComponentJSON, _node: PrefabNode): SphereColliderComponent | null {
    if (!json.isCollider) {
      return null
    }

    const radius = json.radius ?? 0.5
    const offset = new THREE.Vector3(json.offset[0], json.offset[1], json.offset[2])
    const bodyType = (json.bodyType as RigidBodyType) ?? RigidBodyType.STATIC
    return new SphereColliderComponent(radius, offset, bodyType, json.isSensor, json.enableCollisionEvents)
  }

  private rigidBody: RigidBodyComponentThree | null = null
  private readonly radius: number
  private readonly offset: THREE.Vector3
  private readonly bodyType: RigidBodyType
  private readonly isSensor?: boolean
  private readonly enableCollisionEvents?: boolean

  constructor(
    radius: number,
    offset: THREE.Vector3,
    bodyType: RigidBodyType = RigidBodyType.STATIC,
    isSensor?: boolean,
    enableCollisionEvents?: boolean
  ) {
    super()
    this.radius = radius
    this.offset = offset
    this.bodyType = bodyType
    this.isSensor = isSensor
    this.enableCollisionEvents = enableCollisionEvents
  }

  protected onCreate(): void {
    this.rigidBody = new RigidBodyComponentThree({
      type: this.bodyType,
      shape: ColliderShape.SPHERE,
      radius: this.radius,
      centerOffset: this.offset,
      isSensor: this.isSensor,
      enableCollisionEvents: this.enableCollisionEvents,
    })
    this.gameObject.addComponent(this.rigidBody)
  }

  public getRigidBody(): RigidBodyComponentThree | null {
    return this.rigidBody
  }
}
