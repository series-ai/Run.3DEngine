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

```typescript
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { InstancedRenderer } from "@series-inc/rundot-3d-engine/rendering"
import * as THREE from "three"

class CoinSpawner extends Component {
    private instancedRenderer: InstancedRenderer | null = null
    private rendererObject: GameObject | null = null
    
    protected onCreate(): void {
        this.spawnCoins()
    }
    
    private spawnCoins(): void {
        // 1. Create InstancedRenderer with mesh name and instance count
        this.instancedRenderer = new InstancedRenderer(
            "restaurant_display_Money",
            100 // Number of instances
        )
        
        // 2. Create child GameObject
        this.rendererObject = new GameObject("CoinsRenderer")
        
        // 3. Add component
        this.rendererObject.addComponent(this.instancedRenderer)
        
        // 4. Add as child
        this.gameObject.add(this.rendererObject)
        
        // 5. Set positions for each instance
        for (let i = 0; i < 100; i++) {
            const x = (i % 10) * 2 - 10
            const z = Math.floor(i / 10) * 2 - 10
            const position = new THREE.Vector3(x, 0, z)
            
            this.instancedRenderer.setInstancePosition(i, position)
        }
        
        // 6. Update to apply transforms
        this.instancedRenderer.updateInstances()
    }
    
    protected onCleanup(): void {
        this.rendererObject?.dispose()
    }
}
```

### Setting Instance Properties

```typescript
// Set position
instancedRenderer.setInstancePosition(0, new THREE.Vector3(0, 5, 0))

// Set rotation
instancedRenderer.setInstanceRotation(0, new THREE.Quaternion())

// Set scale
instancedRenderer.setInstanceScale(0, new THREE.Vector3(1, 1, 1))

// Set color (tint)
instancedRenderer.setInstanceColor(0, new THREE.Color(0xff0000))

// IMPORTANT: Always call updateInstances() after making changes
instancedRenderer.updateInstances()
```

### Dynamic Updates Example

```typescript
class FloatingCoins extends Component {
    private instancedRenderer: InstancedRenderer | null = null
    private elapsedTime: number = 0
    
    update(deltaTime: number): void {
        if (!this.instancedRenderer) return
        
        this.elapsedTime += deltaTime
        
        // Animate each instance
        for (let i = 0; i < 100; i++) {
            const offset = i * 0.1
            const y = Math.sin(this.elapsedTime + offset) * 2
            const pos = new THREE.Vector3(
                (i % 10) * 2 - 10,
                y,
                Math.floor(i / 10) * 2 - 10
            )
            this.instancedRenderer.setInstancePosition(i, pos)
        }
        
        // Update GPU buffer with new transforms
        this.instancedRenderer.updateInstances()
    }
}
```

### Showing/Hiding Instances

```typescript
// Hide an instance (moves it far away)
instancedRenderer.setInstanceVisible(5, false)

// Show an instance
instancedRenderer.setInstanceVisible(5, true)

// Don't forget to update!
instancedRenderer.updateInstances()
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
// BAD - 1000 individual MeshRenderers
for (let i = 0; i < 1000; i++) {
    const obj = new GameObject(`Coin_${i}`)
    const renderer = new MeshRenderer("coin_mesh")
    obj.addComponent(renderer)
    scene.add(obj)
    // Result: 1000 draw calls, poor performance
}

// GOOD - 1 InstancedRenderer with 1000 instances
const renderer = new InstancedRenderer("coin_mesh", 1000)
const obj = new GameObject("Coins")
obj.addComponent(renderer)
scene.add(obj)
// Result: 1 draw call, excellent performance
```

## Related Patterns

- [Creating GameObjects](CreatingGameObjects.md) - GameObject best practices
- [Component Communication](ComponentCommunication.md) - Inter-component patterns
- [MeshRenderer](../rendering/MeshRenderer.md) - Full MeshRenderer documentation
- [InstancedRenderer](../rendering/InstancedRenderer.md) - Full InstancedRenderer documentation

