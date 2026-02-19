# Mesh Loading Pattern

The correct pattern for loading and displaying 3D meshes in the Rundot 3D Engine.

## Overview

**Use MeshRenderer or InstancedRenderer to load and display 3D meshes:**

- **MeshRenderer**: For individual meshes or small numbers of unique objects
- **InstancedRenderer**: For large numbers of the same mesh (GPU instancing for performance)

## Standard Pattern: MeshRenderer

**Use MeshRenderer with a child GameObject for most cases:**

```typescript
private createMeshRenderer(): void {
    const renderer = new MeshRenderer("restaurant_display_Money")
    this.rendererObject = new GameObject("RendererObject")
    this.rendererObject.addComponent(renderer)
    this.gameObject.add(this.rendererObject)
    
    // Optional: Position the mesh
    this.rendererObject.position.set(0, 2, 0)
}
```

## Why This Pattern?

1. **Component Lifecycle**: MeshRenderer handles loading, cleanup, and disposal automatically
2. **Hierarchy Control**: Child GameObject allows independent positioning/rotation
3. **Clean Architecture**: Follows the component-based design
4. **Automatic Loading**: Mesh loads asynchronously without blocking

## Complete Example

```typescript
import { Component, GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"

class Pickup extends Component {
    private rendererObject: GameObject | null = null
    
    protected onCreate(): void {
        this.createMeshRenderer()
    }
    
    private createMeshRenderer(): void {
        // 1. Create MeshRenderer component
        const renderer = new MeshRenderer("restaurant_display_Money")
        
        // 2. Create child GameObject
        this.rendererObject = new GameObject("RendererObject")
        
        // 3. Add component to GameObject
        this.rendererObject.addComponent(renderer)
        
        // 4. Add as child
        this.gameObject.add(this.rendererObject)
        
        // 5. Optional: Position/rotate mesh
        this.rendererObject.position.set(0, 2, 0)
        this.rendererObject.rotation.y = Math.PI / 4
    }
    
    protected onCleanup(): void {
        // Cleanup happens automatically when GameObject is disposed
        this.rendererObject?.dispose()
    }
}
```

## What NOT to Do

### ❌ Don't Use StowKitSystem Directly

```typescript
// BAD - Bypasses component system
private async createMeshRenderer(): Promise<void> {
    const stowkit = StowKitSystem.getInstance()
    const mesh = await stowkit.getMesh("restaurant_display_Money")
    this.gameObject.add(mesh.clone())
}
```

Problems:
- No automatic cleanup
- No component lifecycle
- Manual async handling required
- Harder to manage

### ❌ Don't Add MeshRenderer Directly to Parent

```typescript
// BAD - No hierarchy control
this.gameObject.addComponent(new MeshRenderer("mesh_name"))
```

Problems:
- Can't position mesh independently
- Can't have multiple meshes on same GameObject
- Less flexible

## Benefits of the Pattern

### Independent Positioning

```typescript
// Parent GameObject at (0, 0, 0)
const parent = new GameObject("Parent")

// Mesh offset from parent
const renderer = new MeshRenderer("mesh")
const meshObj = new GameObject("Mesh")
meshObj.addComponent(renderer)
parent.add(meshObj)

meshObj.position.set(0, -0.5, 0) // Visual offset
```

### Multiple Meshes

```typescript
// Multiple meshes on one GameObject
const character = new GameObject("Character")

const body = new GameObject("Body")
body.addComponent(new MeshRenderer("body_mesh"))
character.add(body)

const weapon = new GameObject("Weapon")
weapon.addComponent(new MeshRenderer("weapon_mesh"))
character.add(weapon)
weapon.position.set(0.5, 1, 0) // Weapon offset
```

### Automatic Async Loading

```typescript
// Mesh loads in background
const renderer = new MeshRenderer("large_mesh")
const obj = new GameObject("Mesh")
obj.addComponent(renderer)
this.gameObject.add(obj)

// No await needed - appears when ready!
// Component continues working while mesh loads
```

## High-Performance Pattern: InstancedRenderer

**Use InstancedRenderer when displaying many copies of the same mesh:**

InstancedRenderer uses GPU instancing to render hundreds or thousands of the same mesh efficiently. Each instance can have its own position, rotation, scale, and color.

### When to Use InstancedRenderer

- **Many copies** of the same mesh (50+)
- **Same geometry** for all instances (coins, trees, enemies, projectiles)
- **Performance critical** scenarios (large crowds, particle-like effects)
- **Different transforms** per instance (position, rotation, scale)

### Basic Example

Each InstancedRenderer is a **per-GameObject component** — one component per instance, all sharing the same batch.

```typescript
import { Component, GameObject, InstancedRenderer } from "@series-inc/rundot-3d-engine"
import * as THREE from "three"

class CoinSpawner extends Component {
    private coins: GameObject[] = []

    protected onCreate(): void {
        this.spawnCoins()
    }

    private spawnCoins(): void {
        for (let i = 0; i < 100; i++) {
            const coin = new GameObject(`Coin_${i}`)
            coin.position.set(
                (i % 10) * 2 - 10,
                0,
                Math.floor(i / 10) * 2 - 10,
            )
            // All coins share the same batch key
            coin.addComponent(new InstancedRenderer("coin_batch"))
            this.coins.push(coin)
        }
    }

    protected onCleanup(): void {
        this.coins.forEach((c) => c.dispose())
    }
}
```

### Dynamic vs Static Instances

```typescript
// Dynamic (default) - updates transform every frame
coin.addComponent(new InstancedRenderer("coin_batch"))

// Static - only updates when marked dirty (better performance)
const renderer = new InstancedRenderer("coin_batch", { isDynamic: false })
coin.addComponent(renderer)

// After moving a static instance:
coin.position.x = 10
renderer.markDirty()
```

### Showing/Hiding Instances

```typescript
const renderer = coin.getComponent(InstancedRenderer)

// Hide an instance
renderer?.hide()   // or renderer?.setVisible(false)

// Show an instance
renderer?.show()   // or renderer?.setVisible(true)
```

## Choosing Between MeshRenderer and InstancedRenderer

### Use MeshRenderer When:
- ✅ You have unique objects or small numbers (< 50)
- ✅ Each mesh is different
- ✅ Each object has unique components/behavior
- ✅ Objects are added/removed dynamically
- ✅ Standard use case

### Use InstancedRenderer When:
- ✅ You need many copies of the same mesh (50+)
- ✅ All instances share the same geometry
- ✅ Performance is critical
- ✅ You can manage instances in a batch
- ✅ Instances have similar behavior

### Performance Comparison

```typescript
// BAD - 1000 individual MeshRenderers (1000 draw calls)
for (let i = 0; i < 1000; i++) {
    const obj = new GameObject(`Coin_${i}`)
    obj.addComponent(new MeshRenderer("coin_mesh"))
}

// GOOD - 1000 InstancedRenderers sharing one batch (1 draw call)
for (let i = 0; i < 1000; i++) {
    const obj = new GameObject(`Coin_${i}`)
    obj.addComponent(new InstancedRenderer("coin_batch"))
}
```

## Related Patterns

- [Creating GameObjects](CreatingGameObjects.md) - GameObject best practices
- [Component Communication](ComponentCommunication.md) - Inter-component patterns
- [MeshRenderer](../rendering/MeshRenderer.md) - Full MeshRenderer documentation
- [InstancedRenderer](../rendering/InstancedRenderer.md) - Full InstancedRenderer documentation

