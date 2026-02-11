# StowKitSystem

StowKitSystem loads assets from .stow pack files with automatic caching, prefab support, and material conversion.

## Quick Start

```typescript
import { StowKitSystem } from "@series-ai/rundot-3d-engine/systems"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

// Load from build.json (includes all packs and prefabs)
const buildJson = await import("../prefabs/build.json")
const prefabs = await StowKitSystem.getInstance().loadFromBuildJson(buildJson.default, {
    fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path)
})

// Access meshes synchronously after loading
const mesh = StowKitSystem.getInstance().getMeshSync("restaurant_display_Money")
```

## Common Use Cases

### Loading Assets

```typescript
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        const stowkit = StowKitSystem.getInstance()
        const buildJson = (await import("../prefabs/build.json")).default
        
        // Load everything
        await stowkit.loadFromBuildJson(buildJson, {
            fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path)
        })
        
        // Now use meshes
        this.createGameObjects()
    }
}
```

### Getting Meshes

```typescript
const stowkit = StowKitSystem.getInstance()

// Async (loads if not cached)
const mesh = await stowkit.getMesh("asset_name")

// Sync (returns null if not loaded)
const mesh = stowkit.getMeshSync("asset_name")
```

### Using with MeshRenderer

```typescript
// MeshRenderer uses StowKitSystem automatically
const renderer = new MeshRenderer("restaurant_display_Money")
const obj = new GameObject("Mesh")
obj.addComponent(renderer)
// Mesh loads from StowKit automatically
```

## API Overview

- `getInstance(): StowKitSystem` - Get singleton instance
- `loadFromBuildJson(json, config)` - Load packs and prefabs
- `getMesh(name): Promise<THREE.Group>` - Load mesh async
- `getMeshSync(name): THREE.Group | null` - Get cached mesh
- `cloneMeshSync(mesh, castShadow, receiveShadow)` - Clone with shadows
- `getBounds(mesh): THREE.Vector3` - Get mesh bounds

## Related Systems

- [MeshRenderer](../rendering/MeshRenderer.md) - Uses StowKit for loading
- [PrefabSystem](PrefabSystem.md) - Prefabs from StowKit

