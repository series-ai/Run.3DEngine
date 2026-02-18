# AssetManager

AssetManager handles loading and caching of 3D assets (FBX, GLB, OBJ) with support for skeletal animation cloning and preloading workflows.

## Quick Start

```typescript
import { AssetManager } from "@series-inc/rundot-3d-engine/assets"
import * as THREE from "three"

// Initialize (done automatically by VenusGame)
AssetManager.init(scene, renderer)

// Preload assets before using them
await AssetManager.preloadAssets([
    "models/character.fbx",
    "models/environment.glb",
    "animations/walk.fbx"
])

// Use assets synchronously after preloading
const mesh = AssetManager.getMesh("models/character.fbx")
const animations = AssetManager.getAnimations("animations/walk.fbx")
```

## Common Use Cases

### Preloading Game Assets

```typescript
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        // Show loading progress
        const assets = [
            "models/player.fbx",
            "models/enemy.fbx",
            "models/level.glb",
            "animations/idle.fbx",
            "animations/walk.fbx"
        ]
        
        let loaded = 0
        await AssetManager.preloadAssets(assets, (progress) => {
            loaded++
            console.log(`Loading: ${loaded}/${assets.length}`)
        })
        
        // All assets ready - create game objects
        this.setupGame()
    }
}
```

### Skeletal Character Models

```typescript
// Preload skeletal model (for animated characters)
await AssetManager.preloadSkeletalModel("Character/player.fbx")

// Get properly cloned skeletal model with bone structure
const skeletalClone = AssetManager.getSkeletalClone("Character/player.fbx")

// Use with animation mixer
const mixer = new THREE.AnimationMixer(skeletalClone)
```

### Getting Meshes

```typescript
// Get mesh (returns null if not loaded)
const mesh = AssetManager.getMesh("models/tree.fbx")

if (mesh) {
    scene.add(mesh.clone()) // Clone before using
}
```

### Loading Animations

```typescript
// Preload animation file
await AssetManager.preloadAssets(["animations/walk.fbx"])

// Get animation clip
const clip = AssetManager.getAnimationClip("animations/walk.fbx")

if (clip) {
    const action = mixer.clipAction(clip)
    action.play()
}

// Get all animations from a file
const clips = AssetManager.getAnimations("animations/walk.fbx")
```

### Getting Asset Groups

```typescript
// Get entire asset group (meshes, materials, etc.)
const assetGroup = AssetManager.getAssetGroup("models/building.glb")

if (assetGroup) {
    // Access meshes, materials, animations
    const meshes = AssetManager.getMeshes("models/building.glb")
    const materials = AssetManager.getMaterials("models/building.glb")
}
```

## API Overview

### Initialization

- `AssetManager.init(scene, renderer?)` - Initialize (called by VenusGame)
- `AssetManager.setBaseUrl(url)` - Set base URL for relative paths

### Preloading

- `preloadAssets(paths, progressCallback?): Promise<void>` - Preload multiple assets
- `preloadSkeletalModel(path): Promise<void>` - Preload skeletal model for animation

### Accessing Assets

- `getMesh(path): THREE.Object3D | null` - Get first mesh from asset
- `getMeshes(path): THREE.Mesh[]` - Get all meshes from asset
- `getAssetGroup(path): THREE.Group | null` - Get entire asset group
- `getSkeletalClone(path): THREE.Object3D | null` - Get properly cloned skeletal model
- `getMaterials(path): THREE.Material[]` - Get all materials from asset
- `getAnimationClip(path, index?): THREE.AnimationClip | null` - Get specific animation clip
- `getAnimations(path): THREE.AnimationClip[]` - Get all animation clips
- `getGLTF(path): any | null` - Get raw GLTF data

### Utility

- `isAssetLoaded(path): boolean` - Check if asset is loaded
- `getLoadedAssetPaths(): string[]` - Get all loaded asset paths

## Supported Formats

### FBX (.fbx)
- 3D models with or without animations
- Skeletal character models
- Animation clips

### GLB/GLTF (.glb, .gltf)
- Complete scenes with meshes, materials, animations
- PBR materials with textures
- Optimized for web delivery

### OBJ (.obj)
- Static 3D models
- Optional .mtl material files
- No animation support

## Patterns & Best Practices

### Preload Everything First

```typescript
// Good - Preload during initialization
protected async onStart(): Promise<void> {
    await AssetManager.preloadAssets([
        "all/your/assets.fbx"
    ])
    // Now use assets synchronously
    this.createGameObjects()
}

// Bad - Load on demand (slower, causes stuttering)
createEnemy() {
    AssetManager.preloadAssets(["enemy.fbx"]).then(() => {
        const mesh = AssetManager.getMesh("enemy.fbx")
        // Delays enemy creation
    })
}
```

### Always Clone Meshes

```typescript
// Good - Clone before adding to scene
const mesh = AssetManager.getMesh("tree.fbx")
if (mesh) {
    scene.add(mesh.clone()) // Fresh copy
}

// Bad - Reuse same instance
const mesh = AssetManager.getMesh("tree.fbx")
if (mesh) {
    scene.add(mesh) // Modifying this affects all references!
}
```

### Use Skeletal Cloning for Characters

```typescript
// Good - Proper skeletal cloning
await AssetManager.preloadSkeletalModel("character.fbx")
const skeletalClone = AssetManager.getSkeletalClone("character.fbx")
// Bones work correctly

// Bad - Regular clone breaks bones
const mesh = AssetManager.getMesh("character.fbx")
const clone = mesh.clone() // Broken bone structure!
```

### Check if Assets are Loaded

```typescript
// Good - Check before using
if (AssetManager.isAssetLoaded("model.fbx")) {
    const mesh = AssetManager.getMesh("model.fbx")
    // Safe to use
}

// Alternative - null check
const mesh = AssetManager.getMesh("model.fbx")
if (mesh) {
    // Safe to use
}
```

### Progress Tracking

```typescript
const assets = [...largeAssetList]
let progress = 0

await AssetManager.preloadAssets(assets, (p) => {
    progress = (++progress / assets.length) * 100
    console.log(`Loading: ${progress.toFixed(0)}%`)
})
```

## Anti-Patterns

### Don't Skip Preloading

```typescript
// Bad - Asset won't be loaded
const mesh = AssetManager.getMesh("model.fbx") // null!

// Good - Preload first
await AssetManager.preloadAssets(["model.fbx"])
const mesh = AssetManager.getMesh("model.fbx") // Available!
```

### Don't Use Regular Cloning for Skeletal Models

```typescript
// Bad - Breaks bone hierarchy
const character = AssetManager.getMesh("character.fbx")
const clone = character.clone() // Animations won't work!

// Good - Use getSkeletalClone
await AssetManager.preloadSkeletalModel("character.fbx")
const clone = AssetManager.getSkeletalClone("character.fbx")
```

### Don't Load Same Asset Multiple Times

```typescript
// Bad - Redundant preloading
await AssetManager.preloadAssets(["model.fbx"])
await AssetManager.preloadAssets(["model.fbx"]) // Cached, but unnecessary

// Good - Check first
if (!AssetManager.isAssetLoaded("model.fbx")) {
    await AssetManager.preloadAssets(["model.fbx"])
}
```

## Caching Behavior

AssetManager caches all loaded assets:
- **First load**: Downloads and parses the file
- **Subsequent access**: Returns cached version (fast!)
- **Memory**: Assets stay in memory until page reload

```typescript
// First call - loads from disk
await AssetManager.preloadAssets(["model.fbx"]) // ~100ms

// Later calls - instant (cached)
const mesh1 = AssetManager.getMesh("model.fbx") // <1ms
const mesh2 = AssetManager.getMesh("model.fbx") // <1ms (same cached instance)
```

## Integration with Renderers

AssetManager works seamlessly with renderer components:

```typescript
// SkeletalRenderer uses AssetManager internally
await AssetManager.preloadSkeletalModel("character.fbx")
const renderer = new SkeletalRenderer("character.fbx")
// SkeletalRenderer calls getSkeletalClone() automatically

// MeshRenderer uses StowKit (different system)
// For StowKit assets, use MeshRenderer instead
```

## Related Systems

- [MeshRenderer](MeshRenderer.md) - For StowKit assets (.stow format)
- [SkeletalRenderer](SkeletalRenderer.md) - Uses AssetManager for skeletal models
- [SkeletonCache](../../src/engine/assets/SkeletonCache.ts) - Proper bone cloning
- [VenusGame](../core/VenusGame.md) - Initializes AssetManager

