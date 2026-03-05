import * as THREE from "three"
import { Component } from "@engine/core"
import { PrefabComponent } from "../prefabs/PrefabComponent"
import type { ComponentJSON, PrefabNode } from "../prefabs"
import { ColliderShape, RigidBodyComponentThree, RigidBodyType } from "./RigidBodyComponentThree"

interface BoxComponentJSON extends ComponentJSON {
  type: "box"
  isCollider?: boolean
  size: number[]
  offset: number[]
  bodyType?: "static" | "kinematic" | "dynamic"
  isSensor?: boolean
  enableCollisionEvents?: boolean
}

@PrefabComponent("box")
export class BoxColliderComponent extends Component {
  static fromPrefabJSON(json: BoxComponentJSON, _node: PrefabNode): BoxColliderComponent | null {
    if (!json.isCollider) {
      return null
    }

    const size = new THREE.Vector3(json.size[0], json.size[1], json.size[2])
    const offset = new THREE.Vector3(json.offset[0], json.offset[1], json.offset[2])
    const bodyType = (json.bodyType as RigidBodyType) ?? RigidBodyType.STATIC
    return new BoxColliderComponent(size, offset, bodyType, json.isSensor, json.enableCollisionEvents)
  }

  private rigidBody: RigidBodyComponentThree | null = null
  private readonly size: THREE.Vector3
  private readonly offset: THREE.Vector3
  private readonly bodyType: RigidBodyType
  private readonly isSensor?: boolean
  private readonly enableCollisionEvents?: boolean

  constructor(
    size: THREE.Vector3,
    offset: THREE.Vector3,
    bodyType: RigidBodyType = RigidBodyType.STATIC,
    isSensor?: boolean,
    enableCollisionEvents?: boolean
  ) {
    super()
    this.size = size
    this.offset = offset
    this.bodyType = bodyType
    this.isSensor = isSensor
    this.enableCollisionEvents = enableCollisionEvents
  }

  protected onCreate(): void {
    this.rigidBody = new RigidBodyComponentThree({
      type: this.bodyType,
      shape: ColliderShape.BOX,
      size: this.size,
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
