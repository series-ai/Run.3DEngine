# PrefabSystem

Prefab system for instantiating pre-configured GameObjects with components from JSON definitions.

## Quick Start

```typescript
import { PrefabLoader, PrefabCollection } from "@series-inc/rundot-3d-engine/systems"

// Load prefabs (done via StowKitSystem)
const prefabs = await StowKitSystem.getInstance().loadFromBuildJson(buildJson, config)

// Instantiate prefab
const prefab = prefabs.getPrefabByName("burger_station")
const instance = PrefabLoader.instantiatePrefab(prefab)

// Instance is a GameObject with all components attached
instance.position.set(5, 0, 5)
```

## Common Use Cases

### Creating from Prefab

```typescript
class Instantiation {
    private static prefabCollection?: PrefabCollection
    
    public static async initialize() {
        const stowkit = StowKitSystem.getInstance()
        const buildJson = (await import("../prefabs/build.json")).default
        this.prefabCollection = await stowkit.loadFromBuildJson(buildJson, {
            fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path)
        })
    }
    
    public static instantiate(prefabPath: string): PrefabInstance | null {
        const prefab = this.prefabCollection?.getPrefabByName(prefabPath)
        if (!prefab) {
            throw new Error(`Prefab not found: ${prefabPath}`)
        }
        return PrefabLoader.instantiatePrefab(prefab)
    }
}

// Use it
const enemy = Instantiation.instantiate("enemy_prefab")
```

## API Overview

- `PrefabLoader.instantiatePrefab(prefab, parent?, options?)` - Create instance
- `PrefabCollection.getPrefabByName(name)` - Get prefab by name
- `ComponentRegistry.register(type, class)` - Register custom components

## Related Systems

- [StowKitSystem](StowKitSystem.md) - Loads prefab definitions
- [GameObject](../core/GameObject.md) - Prefabs create GameObjects

