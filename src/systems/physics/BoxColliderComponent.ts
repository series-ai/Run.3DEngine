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
}

@PrefabComponent("box")
export class BoxColliderComponent extends Component {
  static fromPrefabJSON(json: BoxComponentJSON, _node: PrefabNode): BoxColliderComponent | null {
    if (!json.isCollider) {
      return null
    }

    const size = new THREE.Vector3(json.size[0], json.size[1], json.size[2])
    const offset = new THREE.Vector3(json.offset[0], json.offset[1], json.offset[2])
    return new BoxColliderComponent(size, offset)
  }

  private rigidBody: RigidBodyComponentThree | null = null
  private readonly size: THREE.Vector3
  private readonly offset: THREE.Vector3

  constructor(size: THREE.Vector3, offset: THREE.Vector3) {
    super()
    this.size = size
    this.offset = offset
  }

  protected onCreate(): void {
    this.rigidBody = new RigidBodyComponentThree({
      type: RigidBodyType.STATIC,
      shape: ColliderShape.BOX,
      size: this.size,
      centerOffset: this.offset,
    })
    this.gameObject.addComponent(this.rigidBody)
  }

  public getRigidBody(): RigidBodyComponentThree | null {
    return this.rigidBody
  }
}
