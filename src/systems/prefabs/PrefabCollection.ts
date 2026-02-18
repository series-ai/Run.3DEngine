import type { PrefabCollectionJSON } from "./types"
import { Prefab } from "./Prefab"
import { PrefabNode } from "./PrefabNode"

export class PrefabCollection {
  public static createFromJSON(json: PrefabCollectionJSON): PrefabCollection {
    const prefabs = json.prefabs.map((p) => Prefab.createFromJSON(p))
    return new PrefabCollection(prefabs)
  }

  private readonly _prefabsByName = new Map<string, Prefab>()

  constructor(prefabs: Iterable<Prefab>) {
    for (const prefab of prefabs) {
      this._prefabsByName.set(prefab.name, prefab)
    }
  }

  public get prefabs(): IterableIterator<Prefab> {
    return this._prefabsByName.values()
  }

  public getPrefabByName(name: string): Prefab | undefined {
    return this._prefabsByName.get(name)
  }

  public getAllComponentTypes(): Set<string> {
    const types = new Set<string>()
    this.traverseNodes((node) => {
      for (const component of node.components) {
        types.add(component.type)
      }
    })
    return types
  }

  /**
   * Get all unique mounts from all prefabs in the collection.
   * Mounts define StowKit pack aliases and CDN paths.
   * @returns Array of mount points with alias and path
   */
  public getMounts(): Array<{ alias: string; path: string }> {
    const mountsByAlias = new Map<string, { alias: string; path: string }>()

    for (const prefab of this.prefabs) {
      for (const mount of prefab.mounts) {
        // Use alias as key to deduplicate
        if (!mountsByAlias.has(mount.alias)) {
          mountsByAlias.set(mount.alias, { alias: mount.alias, path: mount.path })
        }
      }
    }

    return Array.from(mountsByAlias.values())
  }

  private traverseNodes(callback: (node: PrefabNode) => void): void {
    for (const prefab of this.prefabs) {
      const root = prefab.root
      callback(root)
      for (const [, descendant] of root.descendants) {
        callback(descendant)
      }
    }
  }
}
