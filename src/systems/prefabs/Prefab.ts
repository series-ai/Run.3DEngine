import type { PrefabJSON } from "./types"
import { PrefabNode } from "./PrefabNode"

export class Prefab {
  public static createFromJSON(json: PrefabJSON): Prefab {
    const name = json.meta.name
    const root = PrefabNode.createFromJSON(json.root)
    return new Prefab(name, root, json.mounts)
  }

  private readonly _name: string
  private readonly _root: PrefabNode
  private readonly _mounts: { alias: string; path: string }[]

  constructor(name: string, root: PrefabNode, mounts: { alias: string; path: string }[]) {
    this._name = name
    this._root = root
    this._mounts = mounts
  }

  public get name(): string {
    return this._name
  }

  public get root(): PrefabNode {
    return this._root
  }

  public get mounts(): ReadonlyArray<{ alias: string; path: string }> {
    return this._mounts
  }

  public getNodeByPath(path: string): PrefabNode | undefined {
    return this._root.getNodeByPath(path)
  }
}
