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

