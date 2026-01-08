import type { PrefabCollectionJSON } from "./types"
import { PrefabCollection } from "./PrefabCollection"
import { Prefab } from "./Prefab"
import { PrefabNode } from "./PrefabNode"
import { PrefabInstance } from "./PrefabInstance"
import { ComponentRegistry } from "./ComponentRegistry"
import type { GameObject } from "../../engine/core/GameObject"

export class PrefabLoader {
    public static loadCollection(json: PrefabCollectionJSON): PrefabCollection {
        return PrefabCollection.createFromJSON(json)
    }

    public static instantiate(
        prefabNode: PrefabNode,
        parent: GameObject | null = null
    ): PrefabInstance {
        return PrefabInstance.instantiate(prefabNode, parent)
    }

    public static instantiatePrefab(
        prefab: Prefab,
        parent: GameObject | null = null
    ): PrefabInstance {
        return PrefabInstance.instantiate(prefab.root, parent)
    }

    public static validateCollection(collection: PrefabCollection): string[] {
        const missingTypes: string[] = []
        const allTypes = collection.getAllComponentTypes()

        for (const type of allTypes) {
            if (type !== "transform" && !ComponentRegistry.has(type)) {
                missingTypes.push(type)
            }
        }

        return missingTypes
    }

    public static getRegisteredComponentTypes(): string[] {
        return ComponentRegistry.getRegisteredTypes()
    }
}

