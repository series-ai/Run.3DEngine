# PrefabSystem

Prefab system for instantiating pre-configured GameObjects with components from JSON definitions.

## Quick Start

```typescript
import { PrefabLoader, PrefabInstance } from "@series-inc/rundot-3d-engine/systems"
import { StowKitSystem } from "@series-inc/rundot-3d-engine/systems"

// Load prefabs via StowKitSystem
const stowkit = StowKitSystem.getInstance()
const collection = await stowkit.loadFromBuildJson(buildJson, {
  fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path),
})

// Instantiate a prefab
const node = stowkit.getPrefab("burger_station")
const instance = PrefabLoader.instantiate(node)

// Instance wraps a fully configured GameObject
instance.gameObject.position.set(5, 0, 5)
```

## PrefabLoader

Static factory for loading and instantiating prefabs.

```typescript
import { PrefabLoader } from "@series-inc/rundot-3d-engine/systems"

// Load a collection from JSON
const collection = PrefabLoader.loadCollection(collectionJson)

// Instantiate from a PrefabNode
const instance = PrefabLoader.instantiate(prefabNode, parentGameObject, {
  castShadow: true,
  receiveShadow: true,
})

// Instantiate from a Prefab object
const instance = PrefabLoader.instantiatePrefab(prefab, parentGameObject, options)

// Validation
const errors = PrefabLoader.validateCollection(collection)
const types = PrefabLoader.getRegisteredComponentTypes()
```

## PrefabNode

Represents a node in the prefab hierarchy tree. Created from JSON definitions.

```typescript
// Create from JSON
const node = PrefabNode.createFromJSON(nodeJson)

// Properties
node.name         // Node name
node.id           // Unique ID
node.transform    // Transform data
node.components   // Component data array (readonly)
node.children     // Child nodes (readonly)
node.position     // THREE.Vector3
node.rotation     // THREE.Euler
node.scale        // THREE.Vector3

// Tree traversal
node.getChildByName("door")
node.getNodeByPath("room/door/handle")
node.depthFirstSearchForNode("handle")
node.descendants  // Iterator over all descendants

// Component access
const meshData = node.getComponentData<StowMeshJSON>("stow_mesh")

// Apply transform to a Three.js object
node.applyTransformTo(myObject3D)
```

## PrefabInstance

Runtime instantiation result wrapping a GameObject with its full hierarchy.

```typescript
const instance = PrefabInstance.instantiate(prefabNode, parent, options)

// Properties
instance.name         // Instance name
instance.gameObject   // The root GameObject
instance.prefabNode   // Original PrefabNode reference
instance.components   // All components (readonly)
instance.children     // Child PrefabInstances (readonly)
instance.descendants  // Iterator over all descendants

// Access
instance.getComponent(MeshRenderer)
instance.getChildByName("door")
instance.getDescendantByPath("room/door")
instance.getDescendantByPathOrThrow("room/door")  // throws if not found

// Configuration
instance.setShadows(true, true)  // castShadow, receiveShadow

// Cleanup
instance.dispose()
```

## @PrefabComponent Decorator

Register custom component classes for prefab instantiation.

```typescript
import { PrefabComponent, Component, PrefabNode } from "@series-inc/rundot-3d-engine/systems"

@PrefabComponent("my_custom_type")
class MyCustomComponent extends Component {
  static fromPrefabJSON(json: any, node: PrefabNode): MyCustomComponent | null {
    // Create component from prefab JSON data
    return new MyCustomComponent(json.someProperty)
  }

  constructor(private someProperty: string) {
    super()
  }

  protected onCreate(): void {
    // Component lifecycle as usual
  }
}
```

## ComponentRegistry

Singleton that manages component type registration for prefab instantiation.

```typescript
import { ComponentRegistry } from "@series-inc/rundot-3d-engine/systems"

const registry = ComponentRegistry.getInstance()

// Register a component type
registry.register("my_type", MyComponent)

// Check registration
registry.has("my_type")
registry.get("my_type")
registry.getRegisteredTypes()
```

## Prefab Class

Represents a complete prefab definition with a root node and mount points.

```typescript
const prefab = Prefab.createFromJSON(prefabJson)

prefab.name       // Prefab name
prefab.root       // Root PrefabNode
prefab.mounts     // Mount point definitions: { alias, path }[]

// Navigate the node tree
prefab.getNodeByPath("room/door")
```

## Instantiation Options

```typescript
interface PrefabInstantiateOptions {
  castShadow?: boolean     // Default: true
  receiveShadow?: boolean  // Default: true
}
```

## API Reference

### PrefabLoader (Static)
- `loadCollection(json): PrefabCollection` — load prefab collection from JSON
- `instantiate(node, parent?, options?): PrefabInstance` — instantiate from PrefabNode
- `instantiatePrefab(prefab, parent?, options?): PrefabInstance` — instantiate from Prefab
- `validateCollection(collection): string[]` — validate collection, return errors
- `getRegisteredComponentTypes(): string[]` — list registered component types

### PrefabNode
- `static createFromJSON(json): PrefabNode`
- `getChildByName(name): PrefabNode | undefined`
- `getNodeByPath(path): PrefabNode | undefined`
- `depthFirstSearchForNode(name): PrefabNode | undefined`
- `getComponentData<T>(type): T | undefined`
- `applyTransformTo(object): void`

### PrefabInstance
- `static instantiate(node, parent?, options?): PrefabInstance`
- `getComponent<T>(type): T | undefined`
- `getChildByName(name): PrefabInstance | undefined`
- `getDescendantByPath(path): PrefabInstance | undefined`
- `getDescendantByPathOrThrow(path): PrefabInstance`
- `setShadows(cast, receive?): void`
- `dispose(): void`

## Related Systems

- [StowKitSystem](StowKitSystem.md) - Loads prefab definitions from .stow packs
- [GameObject](../core/GameObject.md) - Prefabs create GameObjects
- [Component](../core/Component.md) - Prefab components extend Component
- [MeshRenderer](../rendering/MeshRenderer.md) - `fromPrefabJSON` factory
