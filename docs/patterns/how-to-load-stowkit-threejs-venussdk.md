# How to Load .stow Files with stowkit-three-loader + RUN.game SDK

Load `.stow` pack files using `@series-inc/stowkit-three-loader` and the RUN.game SDK CDN — no engine wrapper required.

## Packages

| Package | Role |
|---------|------|
| `@series-inc/rundot-game-sdk` | Fetches `.stow` blobs from the CDN via `RundotGameAPI.cdn.fetchAsset()` |
| `@series-inc/stowkit-three-loader` | Parses `.stow` binary data into Three.js assets (`StowKitLoader`, `StowKitPack`) |
| `@series-inc/stowkit-reader` | Low-level WASM reader (peer dependency of the loader) |

## Quick Start

```typescript
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { StowKitLoader } from "@series-inc/stowkit-three-loader"

// 1. Fetch the .stow file from CDN as a Blob
const blob = await RundotGameAPI.cdn.fetchAsset("packs/environment.stow")
const arrayBuffer = await blob.arrayBuffer()

// 2. Parse into a StowKitPack
const pack = await StowKitLoader.loadFromMemory(arrayBuffer, {
  basisPath: "basis/",
  dracoPath: "stowkit/draco/",
  wasmPath: "stowkit_reader.wasm",
})

// 3. Load assets from the pack
const mesh = await pack.loadMesh("restaurant_counter")
scene.add(mesh)
```

## Setup: CDN Assets

Place `.stow` files in `public/cdn-assets/`. The RUN.game CLI uploads them on deploy.

```
my-game/
├── public/
│   └── cdn-assets/
│       ├── packs/
│       │   ├── environment.stow
│       │   └── characters.stow
│       ├── basis/              # Basis Universal transcoder
│       ├── stowkit/
│       │   └── draco/          # Draco decoder
│       └── stowkit_reader.wasm # StowKit WASM reader
└── src/
    └── ...
```

## Step-by-Step

### 1. Initialize the SDK

```typescript
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

await RundotGameAPI.initializeAsync()
```

### 2. Fetch a .stow File

`cdn.fetchAsset` takes a path relative to `cdn-assets/` and returns a `Promise<Blob>`. Files are content-hashed and cache-busted automatically.

```typescript
const blob = await RundotGameAPI.cdn.fetchAsset("packs/environment.stow")
const arrayBuffer = await blob.arrayBuffer()
```

For large files you can increase the timeout (default 30s):

```typescript
const blob = await RundotGameAPI.cdn.fetchAsset("packs/environment.stow", {
  timeout: 60000,
})
```

### 3. Parse with StowKitLoader

```typescript
import { StowKitLoader } from "@series-inc/stowkit-three-loader"

const pack = await StowKitLoader.loadFromMemory(arrayBuffer, {
  basisPath: "basis/",           // Path to Basis Universal transcoder files
  dracoPath: "stowkit/draco/",   // Path to Draco decoder files
  wasmPath: "stowkit_reader.wasm", // Path to StowKit WASM reader
})
```

`loadFromMemory` returns a `StowKitPack` — the handle to all assets inside the `.stow` file.

### 4. Load Assets from the Pack

#### Meshes

```typescript
// Static mesh → THREE.Group
const mesh = await pack.loadMesh("restaurant_display_Money")
scene.add(mesh)

// Skinned mesh (for skeletal animation) → THREE.Group
const character = await pack.loadSkinnedMesh("character_mesh")
scene.add(character)
```

#### Textures

```typescript
// → THREE.Texture
const texture = await pack.loadTexture("wood_diffuse")

// Apply to a material
material.map = texture
```

#### Animations

```typescript
// Needs the mesh the animation targets
const mesh = await pack.loadMesh("character_mesh")
const { clip } = await pack.loadAnimation(mesh, "walk_cycle")

// Use with Three.js AnimationMixer
const mixer = new THREE.AnimationMixer(mesh)
mixer.clipAction(clip).play()
```

#### Audio

```typescript
// Needs a THREE.AudioListener
const listener = new THREE.AudioListener()
camera.add(listener)

const audio = await pack.loadAudio("sfx_click", listener)
audio.play()
```

## Loading Multiple Packs

```typescript
const packPaths = ["packs/environment.stow", "packs/characters.stow", "packs/props.stow"]

const packs = await Promise.all(
  packPaths.map(async (path) => {
    const blob = await RundotGameAPI.cdn.fetchAsset(path)
    return StowKitLoader.loadFromMemory(await blob.arrayBuffer(), {
      basisPath: "basis/",
      dracoPath: "stowkit/draco/",
      wasmPath: "stowkit_reader.wasm",
    })
  })
)

// Search across packs for an asset
async function findMesh(name: string): Promise<THREE.Group> {
  for (const pack of packs) {
    try {
      return await pack.loadMesh(name)
    } catch {
      // Not in this pack, try next
    }
  }
  throw new Error(`Mesh "${name}" not found in any pack`)
}
```

## Common Gotchas

### Texture wrapping defaults to ClampToEdge

The loader doesn't set `wrapS`/`wrapT`, so Three.js defaults to `ClampToEdgeWrapping`. Fix manually if your assets expect tiling:

```typescript
const mesh = await pack.loadMesh("tiled_floor")
mesh.traverse((child) => {
  if ((child as THREE.Mesh).isMesh) {
    const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
    if (mat.map) {
      mat.map.wrapS = THREE.RepeatWrapping
      mat.map.wrapT = THREE.RepeatWrapping
    }
  }
})
```

### Decoder files must be accessible

The `basisPath`, `dracoPath`, and `wasmPath` must point to files the browser can fetch. Place them in `public/cdn-assets/` or serve them from your own CDN.

## Related

- [Assets API (RUN.game SDK)](../../.rundot-docs/rundot-developer-platform/api/ASSETS.md) — CDN fetch details
- [StowKitSystem](../systems/StowKitSystem.md) — Engine wrapper that adds caching, prefabs, and instancing on top of this
