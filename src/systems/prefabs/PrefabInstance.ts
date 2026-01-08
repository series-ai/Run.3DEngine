import { GameObject, Component } from "../../engine/core/GameObject"
import { PrefabNode } from "./PrefabNode"
import { ComponentRegistry, type ComponentJSON } from "./ComponentRegistry"

export class PrefabInstance {
    public static instantiate(
        prefabNode: PrefabNode,
        parent: GameObject | null = null
    ): PrefabInstance {
        const gameObject = new GameObject(prefabNode.name)
        prefabNode.applyTransformTo(gameObject)

        if (parent) {
            parent.add(gameObject)
        }

        const components: Component[] = []

        for (const componentJSON of prefabNode.components) {
            const component = PrefabInstance.createComponent(componentJSON, prefabNode)
            if (component) {
                gameObject.addComponent(component)
                components.push(component)
            }
        }

        const children: PrefabInstance[] = []
        for (const childNode of prefabNode.children) {
            const childInstance = PrefabInstance.instantiate(childNode, gameObject)
            children.push(childInstance)
        }

        return new PrefabInstance(prefabNode, gameObject, components, children)
    }

    private static createComponent(
        componentJSON: ComponentJSON,
        node: PrefabNode
    ): Component | null {
        const factory = ComponentRegistry.get(componentJSON.type)
        if (!factory) {
            console.warn(`Unknown component type: "${componentJSON.type}" - skipping`)
            return null
        }

        try {
            return factory.fromPrefabJSON(componentJSON, node)
        } catch (error) {
            console.error(`Failed to create component "${componentJSON.type}":`, error)
            return null
        }
    }

    private readonly _prefabNode: PrefabNode
    private readonly _gameObject: GameObject
    private readonly _components: Component[]
    private readonly _childrenByName: Map<string, PrefabInstance> = new Map()
    private readonly _descendantsByPath: Map<string, PrefabInstance> = new Map()

    constructor(
        prefabNode: PrefabNode,
        gameObject: GameObject,
        components: Component[],
        children: PrefabInstance[]
    ) {
        this._prefabNode = prefabNode
        this._gameObject = gameObject
        this._components = components

        for (const child of children) {
            this._childrenByName.set(child.name, child)
            this._descendantsByPath.set(`/${child.name}`, child)
            for (const [path, descendant] of child.descendants) {
                this._descendantsByPath.set(`/${child.name}${path}`, descendant)
            }
        }
    }

    public get name(): string {
        return this._prefabNode.name
    }

    public get gameObject(): GameObject {
        return this._gameObject
    }

    public get prefabNode(): PrefabNode {
        return this._prefabNode
    }

    public get components(): ReadonlyArray<Component> {
        return this._components
    }

    public get children(): ReadonlyArray<PrefabInstance> {
        return Array.from(this._childrenByName.values())
    }

    public get descendants(): MapIterator<[string, PrefabInstance]> {
        return this._descendantsByPath.entries()
    }

    public getComponent<T extends Component>(
        componentType: new (...args: unknown[]) => T
    ): T | undefined {
        return this._gameObject.getComponent(componentType)
    }

    public getChildByName(name: string): PrefabInstance | undefined {
        return this._childrenByName.get(name)
    }

    public getDescendantByPath(path: string): PrefabInstance | undefined {
        if (!path.startsWith("/")) path = `/${path}`
        return this._descendantsByPath.get(path)
    }

    public getDescendantByPathOrThrow(path: string): PrefabInstance {
        const instance = this.getDescendantByPath(path)
        if (!instance) throw new Error(`Prefab descendant not found at path: ${path}`)
        return instance
    }

    public dispose(): void {
        this._gameObject.dispose()
    }
}

