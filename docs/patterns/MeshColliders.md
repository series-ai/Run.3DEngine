# Mesh Colliders Pattern

How to load 3D meshes and attach collision bounds in the Rundot 3D Engine.

## Overview

When loading meshes, you need to decide between:
- **Auto-fitted bounds colliders** - Accurate collision that matches the mesh shape
- **Primitive colliders** - Simpler, more performant approximate collision

## Auto-Fitted Bounds Pattern

### Basic Example: fitToMesh

The simplest approach - automatically fit the collider to the mesh bounds:

```typescript
import { Component, GameObject, MeshRenderer } from "@series-ai/rundot-3d-engine"
import { RigidBodyComponentThree, RigidBodyType, ColliderShape } from "@series-ai/rundot-3d-engine/systems"

class Crate extends Component {
    private rendererObject: GameObject | null = null
    
    protected onCreate(): void {
        this.createMeshWithCollider()
    }
    
    private createMeshWithCollider(): void {
        // 1. Create and attach mesh renderer
        const renderer = new MeshRenderer("crate_mesh")
        this.rendererObject = new GameObject("CrateRenderer")
        this.rendererObject.addComponent(renderer)
        this.gameObject.add(this.rendererObject)
        
        // 2. Add auto-fitted collision
        const rigidBody = new RigidBodyComponentThree({
            type: RigidBodyType.DYNAMIC,
            shape: ColliderShape.BOX,
            fitToMesh: true,  // ✨ Automatically calculates collision bounds
            mass: 10
        })
        this.gameObject.addComponent(rigidBody)
    }
    
    protected onCleanup(): void {
        this.rendererObject?.dispose()
    }
}
```

### Advanced Example: Manual Bounds with Timing

Wait for mesh to load before calculating bounds:

```typescript
import { Component, GameObject, MeshRenderer } from "@series-ai/rundot-3d-engine"
import { RigidBodyComponentThree, RigidBodyType, ColliderShape } from "@series-ai/rundot-3d-engine/systems"

class ComplexObject extends Component {
    private rendererObject: GameObject | null = null
    private renderer: MeshRenderer | null = null
    private hasAddedCollider: boolean = false
    
    protected onCreate(): void {
        // 1. Create mesh renderer
        this.renderer = new MeshRenderer("complex_mesh")
        this.rendererObject = new GameObject("ComplexRenderer")
        this.rendererObject.addComponent(this.renderer)
        this.gameObject.add(this.rendererObject)
    }
    
    public update(deltaTime: number): void {
        // 2. Check if mesh is loaded and collider hasn't been added yet
        if (!this.hasAddedCollider && this.renderer && this.renderer.isLoaded()) {
            this.addColliderFromBounds()
            this.hasAddedCollider = true
        }
    }
    
    private addColliderFromBounds(): void {
        // 3. Calculate bounds from loaded mesh
        const bounds = this.renderer!.getBounds()
        
        if (bounds) {
            // 4. Create collider with calculated bounds
            const rigidBody = RigidBodyComponentThree.fromBounds(bounds, {
                type: RigidBodyType.STATIC,
                shape: ColliderShape.BOX
            })
            this.gameObject.addComponent(rigidBody)
            
            console.log(`Created collider with bounds: ${bounds.x}, ${bounds.y}, ${bounds.z}`)
        }
    }
    
    protected onCleanup(): void {
        this.rendererObject?.dispose()
    }
}
```

### Using getMeshBounds Static Method

Calculate bounds from the entire GameObject hierarchy:

```typescript
private addBoundsCollider(): void {
    // Calculate bounds from all meshes in GameObject
    const bounds = RigidBodyComponentThree.getMeshBounds(this.gameObject)
    
    console.log(`Calculated bounds: width=${bounds.x}, height=${bounds.y}, depth=${bounds.z}`)
    
    // Create collider with bounds
    const rigidBody = new RigidBodyComponentThree({
        type: RigidBodyType.STATIC,
        shape: ColliderShape.BOX,
        size: bounds
    })
    this.gameObject.addComponent(rigidBody)
}
```

## Primitive Colliders for Performance

For complex meshes or many instances, use simpler primitive colliders instead of bounds:

### Example: Complex Mesh with Simple Collider

```typescript
class Tree extends Component {
    private rendererObject: GameObject | null = null
    
    protected onCreate(): void {
        // 1. Load detailed tree mesh
        const renderer = new MeshRenderer("detailed_tree_mesh")
        this.rendererObject = new GameObject("TreeRenderer")
        this.rendererObject.addComponent(renderer)
        this.gameObject.add(this.rendererObject)
        
        // 2. Use simple capsule collider (not bounds)
        // Much better performance than fitting to complex tree mesh
        const rigidBody = new RigidBodyComponentThree({
            type: RigidBodyType.STATIC,
            shape: ColliderShape.CAPSULE,
            radius: 0.5,      // Approximate trunk radius
            height: 8.0,      // Approximate tree height
            mass: 1000        // Heavy (won't move)
        })
        this.gameObject.addComponent(rigidBody)
    }
}
```

### Example: Character with Mixed Colliders

Use simple colliders for the character, but bounds for attachments:

```typescript
class Character extends Component {
    protected onCreate(): void {
        // Character uses simple capsule (better for movement)
        const characterBody = new RigidBodyComponentThree({
            type: RigidBodyType.DYNAMIC,
            shape: ColliderShape.CAPSULE,
            radius: 0.5,
            height: 1.8,
            lockRotationX: true,
            lockRotationY: true,
            lockRotationZ: true
        })
        this.gameObject.addComponent(characterBody)
        
        // Add visual mesh (doesn't need to match collision exactly)
        const renderer = new MeshRenderer("character_mesh")
        const rendererObj = new GameObject("CharacterRenderer")
        rendererObj.addComponent(renderer)
        this.gameObject.add(rendererObj)
    }
}
```

## When to Use Each Approach

### Use Auto-Fitted Bounds When:

✅ **Accurate collision is critical**
- Pickups that need precise click detection
- Interactive objects with complex shapes
- Puzzle pieces that must fit together
- Static environment meshes (walls, platforms)

✅ **Mesh shape is regular**
- Box-like objects (crates, buildings)
- Objects without many protrusions
- Static decorations

✅ **Performance isn't critical**
- Small number of objects (< 50)
- Static objects that don't move

### Use Primitive Colliders When:

✅ **Performance is critical**
- Many instances (trees, rocks, debris)
- Complex meshes with thousands of vertices
- Moving/dynamic objects
- Objects using InstancedRenderer

✅ **Approximate collision is acceptable**
- Background decorations
- Organic shapes (trees, bushes, rocks)
- Characters (capsule works better than mesh)

✅ **Simpler physics behavior desired**
- Spheres for smooth rolling
- Capsules for smooth character movement
- Boxes for stackable objects

## Performance Comparison

```typescript
// ❌ BAD: Complex mesh with many instances using bounds
for (let i = 0; i < 100; i++) {
    const rock = new GameObject(`Rock_${i}`)
    const renderer = new MeshRenderer("complex_rock_mesh")  // 10k vertices
    rock.addComponent(renderer)
    
    rock.addComponent(new RigidBodyComponentThree({
        shape: ColliderShape.BOX,
        fitToMesh: true  // Calculates bounds for each rock
    }))
}
// Result: Expensive bounds calculations, potential performance issues

// ✅ GOOD: Complex mesh with simple sphere collider
for (let i = 0; i < 100; i++) {
    const rock = new GameObject(`Rock_${i}`)
    const renderer = new MeshRenderer("complex_rock_mesh")
    rock.addComponent(renderer)
    
    rock.addComponent(new RigidBodyComponentThree({
        shape: ColliderShape.SPHERE,
        radius: 0.8  // Simple approximate collision
    }))
}
// Result: Fast, efficient collision with acceptable accuracy
```

## Complete Example: Pickup Item

Combining mesh loading with auto-fitted trigger collision:

```typescript
import { Component, GameObject, MeshRenderer } from "@series-ai/rundot-3d-engine"
import { RigidBodyComponentThree, RigidBodyType, ColliderShape } from "@series-ai/rundot-3d-engine/systems"

class CoinPickup extends Component {
    private rendererObject: GameObject | null = null
    
    protected onCreate(): void {
        // 1. Create visual mesh
        const renderer = new MeshRenderer("coin_mesh")
        this.rendererObject = new GameObject("CoinRenderer")
        this.rendererObject.addComponent(renderer)
        this.gameObject.add(this.rendererObject)
        
        // 2. Add trigger collider fitted to mesh bounds
        const trigger = new RigidBodyComponentThree({
            type: RigidBodyType.STATIC,
            shape: ColliderShape.BOX,
            fitToMesh: true,      // Automatically fit to coin mesh
            isSensor: true        // Make it a trigger
        })
        this.gameObject.addComponent(trigger)
        
        // 3. Handle pickup collision
        trigger.onTriggerEnter((other: GameObject) => {
            if (other.name === "Player") {
                console.log("Coin collected!")
                this.collect()
            }
        })
    }
    
    private collect(): void {
        // Animate and remove
        this.gameObject.dispose()
    }
    
    protected onCleanup(): void {
        this.rendererObject?.dispose()
    }
}
```

## Tips & Best Practices

### 1. fitToMesh Timing
`fitToMesh` calculates bounds during onCreate, so meshes should be loaded or loading. The calculation works even if the mesh isn't fully loaded yet (it recalculates when ready).

### 2. Scaling Considerations
If you scale your GameObject, bounds are calculated in world space:

```typescript
this.gameObject.scale.set(2, 2, 2)  // Double size
const rigidBody = new RigidBodyComponentThree({
    fitToMesh: true  // Bounds will account for scale
})
```

### 3. Multiple Meshes
`getMeshBounds()` combines all meshes in the GameObject hierarchy:

```typescript
// Parent with multiple child meshes
const composite = new GameObject("Composite")
composite.add(createMesh("part1"))
composite.add(createMesh("part2"))

// Bounds will include both meshes
const bounds = RigidBodyComponentThree.getMeshBounds(composite)
```

### 4. Debug Visualization
Enable physics debug rendering to see collision bounds:

```typescript
// In your game class
PhysicsSystem.getInstance().setDebugRender(true)
```

## Related Patterns

- [Mesh Loading](MeshLoading.md) - Loading and displaying meshes
- [Creating GameObjects](CreatingGameObjects.md) - GameObject best practices
- [Colliders](../physics/Colliders.md) - Full collider documentation
- [RigidBodyComponent](../physics/RigidBodyComponent.md) - Physics body documentation

