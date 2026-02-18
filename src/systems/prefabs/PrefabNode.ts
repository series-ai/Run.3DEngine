import * as THREE from "three"
import type { PrefabNodeJSON, PrefabComponentJSON, TransformComponentJSON } from "./types"
import { isTransformComponent } from "./types"

export class PrefabNode {
  public static createFromJSON(json: PrefabNodeJSON): PrefabNode {
    const name = json.name

    let transform: TransformComponentJSON | null = null
    const components: PrefabComponentJSON[] = []

    if (json.components) {
      for (const component of json.components) {
        if (isTransformComponent(component)) {
          transform = component
        } else {
          components.push(component)
        }
      }
    }

    if (!transform) {
      throw new Error(`PrefabNode "${name}" is missing a transform component`)
    }

    const children: PrefabNode[] = []
    if (json.children) {
      for (const childJSON of json.children) {
        children.push(PrefabNode.createFromJSON(childJSON))
      }
    }

    return new PrefabNode(name, transform, components, children)
  }

  private readonly _name: string
  private readonly _transform: TransformComponentJSON
  private readonly _components: PrefabComponentJSON[]
  private readonly _children: PrefabNode[]
  private readonly _childByNameLookup: Map<string, PrefabNode> = new Map()
  private readonly _nodeByPathLookup: Map<string, PrefabNode> = new Map()

  constructor(
    name: string,
    transform: TransformComponentJSON,
    components: PrefabComponentJSON[],
    children: PrefabNode[]
  ) {
    this._name = name
    this._transform = transform
    this._components = components
    this._children = children

    for (const child of children) {
      this._childByNameLookup.set(child.name, child)
      this.mapDescendant(child, `/${child.name}`)
    }
  }

  public get name(): string {
    return this._name
  }

  public get id(): string {
    return this._name
  }

  public get transform(): TransformComponentJSON {
    return this._transform
  }

  public get components(): ReadonlyArray<PrefabComponentJSON> {
    return this._components
  }

  public get children(): ReadonlyArray<PrefabNode> {
    return this._children
  }

  public get position(): THREE.Vector3 {
    return new THREE.Vector3(
      this._transform.position[0],
      this._transform.position[1],
      this._transform.position[2]
    )
  }

  public get rotation(): THREE.Euler {
    return new THREE.Euler(
      (this._transform.rotation[0] * Math.PI) / 180,
      (this._transform.rotation[1] * Math.PI) / 180,
      (this._transform.rotation[2] * Math.PI) / 180
    )
  }

  public get scale(): THREE.Vector3 {
    return new THREE.Vector3(
      this._transform.scale[0],
      this._transform.scale[1],
      this._transform.scale[2]
    )
  }

  public getChildByName(name: string): PrefabNode | undefined {
    return this._childByNameLookup.get(name)
  }

  public getNodeByPath(path: string): PrefabNode | undefined {
    if (!path.startsWith("/")) path = `/${path}`
    return this._nodeByPathLookup.get(path)
  }

  public get descendants(): MapIterator<[string, PrefabNode]> {
    return this._nodeByPathLookup.entries()
  }

  public depthFirstSearchForNode(nodeName: string): PrefabNode | undefined {
    for (const child of this._children) {
      if (child.name === nodeName) return child
      const found = child.depthFirstSearchForNode(nodeName)
      if (found) return found
    }
    return undefined
  }

  public getComponentData<T extends PrefabComponentJSON>(type: string): T | undefined {
    return this._components.find((c) => c.type === type) as T | undefined
  }

  public applyTransformTo(object: THREE.Object3D): void {
    object.position.copy(this.position)
    object.rotation.copy(this.rotation)
    object.scale.copy(this.scale)
  }

  private mapDescendant(node: PrefabNode, path: string): void {
    this._nodeByPathLookup.set(path, node)
    for (const child of node.children) {
      this.mapDescendant(child, `${path}/${child.name}`)
    }
  }
}
