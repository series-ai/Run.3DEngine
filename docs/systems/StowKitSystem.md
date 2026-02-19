# StowKitSystem

StowKitSystem loads assets from .stow pack files with automatic caching, prefab support, material conversion, and GPU instancing registration.

## Quick Start

```typescript
import { StowKitSystem } from "@series-inc/rundot-3d-engine/systems"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

// Load from build.json (includes all packs and prefabs)
const buildJson = await import("../prefabs/build.json")
const prefabs = await StowKitSystem.getInstance().loadFromBuildJson(buildJson.default, {
  fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path),
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

    await stowkit.loadFromBuildJson(buildJson, {
      fetchBlob: (path) => RundotGameAPI.cdn.fetchAsset(path),
    })

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

// Check load status
stowkit.isMeshLoaded("asset_name")

// Clone with shadow settings
const clone = await stowkit.cloneMesh("asset_name", true, true)
const cloneSync = stowkit.cloneMeshSync(originalMesh, true, true)
```

### Skinned Meshes

```typescript
// Get a skinned mesh for skeletal animation
const skinnedMesh = await stowkit.getSkinnedMesh("character_mesh", 1.0)
```

### Textures

```typescript
// Async
const texture = await stowkit.getTexture("texture_name")

// Sync (returns null if not loaded)
const texture = stowkit.getTextureSync("texture_name")
```

### Animations

```typescript
// Async
const clip = await stowkit.getAnimation("walk_anim", "character_mesh")

// Sync
const clip = stowkit.getAnimationSync("walk_anim")

// Get all loaded animations
const allAnims = stowkit.getAllAnimations() // Map<string, THREE.AnimationClip>
```

### Audio

```typescript
// Async
const audio = await stowkit.getAudio("sfx_click")

// Sync
const audio = stowkit.getAudioSync("sfx_click")

// Get all loaded audio
const allAudio = stowkit.getAllAudio() // Map<string, THREE.Audio>
```

### GPU Instancing Registration

```typescript
// Register a mesh for instancing
await stowkit.registerMeshForInstancing(
  "coin_batch",       // batch key
  "coin_mesh",        // mesh name
  true,               // castShadow
  true,               // receiveShadow
  500,                // initial capacity
)

// Register from a prefab
await stowkit.registerBatchFromPrefab("burger_station", true, true, 100)
```

### Pack Management

```typescript
// Load a specific pack
await stowkit.loadPack("environment", "packs/environment.stow")

// Check pack status
stowkit.isPackLoaded("environment")
stowkit.getPack("environment")
```

## API Reference

### StowKitSystem (Singleton)

#### Access
- `getInstance(): StowKitSystem` — get singleton instance
- `getMaterialConverter()` — get the configured material converter function

#### Loading
- `loadFromBuildJson(buildJson, config): Promise<PrefabCollection>` — load packs and prefabs
- `loadPack(alias, path): Promise<void>` — load a specific pack

#### Prefab Access
- `getPrefabCollection(): PrefabCollection` — get the loaded prefab collection
- `getPrefab(path): PrefabNode` — get a prefab by path

#### Mesh Access
- `getMesh(name): Promise<THREE.Group>` — load mesh async
- `getMeshSync(name): THREE.Group | null` — get cached mesh (null if not loaded)
- `isMeshLoaded(name): boolean` — check if mesh is loaded
- `getSkinnedMesh(name, scale?): Promise<THREE.Group>` — get skinned mesh
- `cloneMesh(name, castShadow?, receiveShadow?): Promise<THREE.Group>` — clone with shadows
- `cloneMeshSync(original, castShadow?, receiveShadow?): THREE.Group` — clone sync

#### Texture Access
- `getTexture(name): Promise<THREE.Texture>` — load texture async
- `getTextureSync(name): THREE.Texture | null` — get cached texture

#### Animation Access
- `getAnimation(name, meshName?): Promise<THREE.AnimationClip>` — load animation async
- `getAnimationSync(name): THREE.AnimationClip | null` — get cached animation
- `getAllAnimations(): Map<string, THREE.AnimationClip>` — get all loaded animations

#### Audio Access
- `getAudio(name): Promise<THREE.Audio>` — load audio async
- `getAudioSync(name): THREE.Audio | null` — get cached audio
- `getAllAudio(): Map<string, THREE.Audio>` — get all loaded audio

#### GPU Instancing
- `registerMeshForInstancing(batchKey, meshName, castShadow?, receiveShadow?, initialCapacity?): Promise<boolean>` — register mesh for instancing
- `registerBatchFromPrefab(prefabName, castShadow?, receiveShadow?, initialCapacity?): Promise<boolean>` — register batch from prefab

#### Pack Management
- `getPack(alias): StowKitPack | null` — get a loaded pack
- `isPackLoaded(alias): boolean` — check if pack is loaded

#### Utilities
- `getBounds(meshGroup): THREE.Vector3` — get mesh bounds
- `dispose()` — dispose and clean up

### StowKitLoadConfig

```typescript
interface StowKitLoadConfig {
  materialConverter?: (material: THREE.Material) => THREE.Material
  fetchBlob: (path: string) => Promise<Blob>
  decoderPaths?: {
    basis?: string    // Default: "basis/"
    draco?: string    // Default: "stowkit/draco/"
    wasm?: string     // Default: "stowkit_reader.wasm"
  }
}
```

## Related Systems

- [MeshRenderer](../rendering/MeshRenderer.md) - Uses StowKit for loading meshes
- [PrefabSystem](PrefabSystem.md) - Prefabs loaded from StowKit
- [InstancedRenderer](../rendering/InstancedRenderer.md) - GPU instancing registered via StowKit
- [AssetManager](../rendering/AssetManager.md) - StowKit assets registered with AssetManager
