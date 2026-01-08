import { ComponentRegistry, type PrefabComponentConstructor } from "./ComponentRegistry"

export function PrefabComponent(typeName: string) {
    return function <T extends PrefabComponentConstructor>(target: T): T {
        ComponentRegistry.register(typeName, target)
        return target
    }
}

