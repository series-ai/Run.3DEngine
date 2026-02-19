# InstancedRenderer

InstancedRenderer uses GPU instancing to efficiently render many copies of the same mesh. Perfect for coins, trees, bullets, or any object that appears many times in the scene.

## Quick Start

```typescript
import { GameObject, InstancedRenderer } from "@series-inc/rundot-3d-engine"
import { InstancedMeshManager } from "@series-inc/rundot-3d-engine"

// 1. Batches auto-create when the first InstancedRenderer registers,
// or pre-register via StowKitSystem or InstancedMeshManager

// 2. Create many instances efficiently
for (let i = 0; i < 50; i++) {
    const coin = new GameObject(`Coin_${i}`)
    coin.position.set(Math.random() * 20, 1, Math.random() * 20)
    
    // All coins share same geometry/material - very efficient!
    coin.addComponent(new InstancedRenderer("coin_batch"))
}
```

## Common Use Cases

### Dynamic Objects (Moving)

```typescript
// Default - updates matrix every frame
const coin = new GameObject("Coin")
coin.addComponent(new InstancedRenderer("coin_batch"))

// Coin can move/rotate freely
coin.position.x += 5 * deltaTime
```

### Static Objects (Non-Moving)

```typescript
// Static mode - only updates when markDirty() called
const tree = new GameObject("Tree")
const renderer = new InstancedRenderer("tree_batch", {
    isDynamic: false, // Static optimization
    castShadow: true,
    receiveShadow: true
})
tree.addComponent(renderer)

// If tree needs to move later
tree.position.x = 10
renderer.markDirty() // Manually trigger update
```

### With Options

```typescript
const renderer = new InstancedRenderer("prop_batch", {
    isDynamic: true,          // Updates every frame
    castShadow: true,         // Cast shadows
    receiveShadow: false,     // Don't receive
    initialCapacity: 200      // Pre-allocate space
})
```

### Show/Hide Instances

```typescript
class Collectable extends Component {
    private renderer?: InstancedRenderer
    
    protected onCreate(): void {
        this.renderer = new InstancedRenderer("collectable_batch")
        this.gameObject.addComponent(this.renderer)
    }
    
    public collect(): void {
        // Hide instance without removing it
        this.renderer?.hide()
        // or this.renderer?.setVisible(false)
    }
}
```

## API Overview

### Constructor

```typescript
new InstancedRenderer(
    batchKey: string,
    options?: InstancedRendererOptions | boolean
)

interface InstancedRendererOptions {
    isDynamic?: boolean      // Default: true
    castShadow?: boolean     // Default: false
    receiveShadow?: boolean  // Default: false
    initialCapacity?: number // Default: 16
}
```

### Methods

- `setVisible(visible: boolean): void` - Show/hide this instance
- `getVisible(): boolean` - Check if instance is visible
- `show(): void` - Show instance (convenience)
- `hide(): void` - Hide instance (convenience)
- `setDynamic(isDynamic: boolean): void` - Switch dynamic/static mode
- `markDirty(): void` - Force matrix update (for static instances)
- `getBatchKey(): string` - Get batch key
- `isRegistered(): boolean` - Check if successfully registered
- `getInstanceId(): string | null` - Get instance ID (debugging)

## Patterns & Best Practices

### Pre-Register Batches for Better Control

```typescript
// Good - Explicit batch registration via StowKitSystem
const stowKit = StowKitSystem.getInstance()
await stowKit.registerMeshForInstancing("enemy_batch", "enemy_mesh", true, true, 500)

// Then create instances
for (let i = 0; i < 100; i++) {
    const enemy = new GameObject("Enemy")
    enemy.addComponent(new InstancedRenderer("enemy_batch"))
}
```

### Use Static Mode for Stationary Objects

```typescript
// Terrain decorations, buildings, etc.
const decoration = new GameObject("Rock")
const renderer = new InstancedRenderer("rock_batch", {
    isDynamic: false // Save CPU
})
decoration.addComponent(renderer)
```

### Batch Similar Objects Together

```typescript
// Good - One batch per mesh type
InstancedRenderer("tree_oak_batch")    // All oak trees
InstancedRenderer("tree_pine_batch")   // All pine trees
InstancedRenderer("coin_gold_batch")   // All gold coins

// Avoid - Different meshes in same batch won't work
```

### Hide Instead of Dispose for Recycling

```typescript
// Good - Reuse instances by hiding/showing
collectCoin() {
    this.renderer.hide() // Fast, can show() later
}

// Less efficient - Dispose and recreate
collectCoin() {
    this.gameObject.dispose() // Slower, needs new instance
}
```

## Performance Benefits

### GPU Instancing Advantages

Single draw call for all instances:
- **1 instance**: 1 draw call
- **100 instances**: Still 1 draw call! (vs 100 without instancing)
- **1000 instances**: Still 1 draw call! (vs 1000 without instancing)

### When to Use InstancedRenderer

Use for:
- Projectiles/bullets
- Coins/collectables
- Trees/rocks
- Particles
- Repeated props
- Anything with 10+ copies

### When to Use MeshRenderer Instead

Use MeshRenderer for:
- Unique objects (player, boss)
- Objects needing different materials
- Objects with different meshes
- Fewer than 5-10 copies

## Anti-Patterns

### Don't Mix Mesh Types in Same Batch

```typescript
// Bad - Same batch key, different meshes
stowKit.registerMeshForInstancing("props", "tree_mesh")
stowKit.registerMeshForInstancing("props", "rock_mesh") // Overwrites!

// Good - Different keys
stowKit.registerMeshForInstancing("tree_batch", "tree_mesh")
stowKit.registerMeshForInstancing("rock_batch", "rock_mesh")
```

### Don't Use for Unique Objects

```typescript
// Bad - Only one player, instancing provides no benefit
const player = new GameObject("Player")
player.addComponent(new InstancedRenderer("player_batch"))

// Good - Use MeshRenderer for unique objects
const renderer = new MeshRenderer("player_mesh")
const renderObj = new GameObject("PlayerMesh")
renderObj.addComponent(renderer)
player.add(renderObj)
```

### Don't Forget to Mark Static Objects Dirty

```typescript
// Bad - Static object moves but never updates
const tree = new GameObject("Tree")
tree.addComponent(new InstancedRenderer("tree_batch", { isDynamic: false }))
// Later...
tree.position.x = 10 // Won't show movement!

// Good - Mark dirty after moving
tree.position.x = 10
tree.getComponent(InstancedRenderer)?.markDirty()
```

## InstancedMeshManager

The singleton that manages all instancing batches. InstancedRenderer components register with this manager automatically.

```typescript
import { InstancedMeshManager } from "@series-inc/rundot-3d-engine"

const manager = InstancedMeshManager.getInstance()
```

### Batch Management

```typescript
// Create a batch from geometry + material
manager.getOrCreateBatch("batch_key", geometry, material, castShadow, receiveShadow, initialCapacity)

// Create a batch from an existing GameObject's mesh
manager.getOrCreateBatchFromGameObject("batch_key", sourceGameObject)

// Check/get batches
manager.hasBatch("batch_key")
manager.getBatch("batch_key")
manager.removeBatch("batch_key")
```

### Instance Management (Low-Level)

```typescript
// Add/remove instances directly
const id = manager.addInstance("batch_key", gameObject, { isDynamic: true })
manager.removeInstance("batch_key", id)

// Visibility
manager.setInstanceVisible("batch_key", id, false)
manager.getInstanceVisible("batch_key", id)

// Static instance updates
manager.markInstanceDirty("batch_key", id)
manager.setInstanceDynamic("batch_key", id, true)
```

### Update & Debug

```typescript
// Call every frame
manager.updateAllBatches()

// Debug
manager.getStats()
manager.debugReport()
```

### Auto-Creating from GameObject

If you don't pre-register, the first instance auto-creates the batch:
```typescript
// First instance creates the batch from this GameObject's mesh
const firstCoin = new GameObject("Coin")
firstCoin.addComponent(new MeshRenderer("coin_mesh")) // Has mesh
firstCoin.addComponent(new InstancedRenderer("coin_batch")) // Auto-creates batch

// Subsequent instances use the batch
const secondCoin = new GameObject("Coin2")
secondCoin.addComponent(new InstancedRenderer("coin_batch")) // Uses existing
```

## Related Systems

- [MeshRenderer](MeshRenderer.md) - For unique/few objects
- [StowKitSystem](../systems/StowKitSystem.md) - Can register meshes for instancing
- [GameObject](../core/GameObject.md) - Entity class for components
- [Component](../core/Component.md) - Base component class

