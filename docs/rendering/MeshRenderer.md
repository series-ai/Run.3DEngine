# MeshRenderer

MeshRenderer is a Component that loads and displays 3D meshes from the StowKit asset system. It handles async loading, shadows, and material management automatically.

## Quick Start

```typescript
import { GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"

// The correct pattern: MeshRenderer + child GameObject
const renderer = new MeshRenderer("restaurant_display_Money")
const rendererObject = new GameObject("RendererObject")
rendererObject.addComponent(renderer)
this.gameObject.add(rendererObject)

// Optional: Position the mesh
rendererObject.position.set(0, 2, 0)
```

## Common Use Cases

### Basic Mesh Loading

```typescript
class Pickup extends Component {
    private rendererObject: GameObject | null = null
    
    protected onCreate(): void {
        // Load mesh using the child GameObject pattern
        const renderer = new MeshRenderer("restaurant_display_Money")
        this.rendererObject = new GameObject("PickupMesh")
        this.rendererObject.addComponent(renderer)
        this.gameObject.add(this.rendererObject)
        
        // Mesh loads async but shows automatically when ready
    }
}
```

### Mesh with Custom Shadows

```typescript
// Control shadow casting/receiving
const renderer = new MeshRenderer(
    "character_mesh",
    true,  // castShadow
    true   // receiveShadow
)
```

### Static Mesh (Performance Optimization)

```typescript
// For non-moving objects - disables matrix updates
const renderer = new MeshRenderer(
    "building_mesh",
    true,  // castShadow
    true,  // receiveShadow
    true   // isStatic - better performance!
)
```

### Custom Material Override

```typescript
// Replace default material with custom one
const customMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    metalness: 0.5,
    roughness: 0.5
})

const renderer = new MeshRenderer(
    "prop_mesh",
    true,
    true,
    false,
    customMaterial // Override material
)
```

### Checking Load State

```typescript
class MyComponent extends Component {
    private meshRenderer?: MeshRenderer
    
    protected onCreate(): void {
        const rendererObject = new GameObject("Mesh")
        this.meshRenderer = new MeshRenderer("my_mesh")
        rendererObject.addComponent(this.meshRenderer)
        this.gameObject.add(rendererObject)
    }
    
    public update(deltaTime: number): void {
        if (this.meshRenderer && this.meshRenderer.isLoaded()) {
            // Mesh is ready, can get bounds, etc.
            const bounds = this.meshRenderer.getBounds()
        }
    }
}
```

## API Overview

### Constructor

```typescript
new MeshRenderer(
    meshName: string,           // StowKit asset name
    castShadow?: boolean,       // Default: true
    receiveShadow?: boolean,    // Default: true
    isStatic?: boolean,         // Default: false
    materialOverride?: THREE.Material | null // Default: null
)
```

### Methods

- `isLoaded(): boolean` - Check if mesh has finished loading
- `getMesh(): THREE.Group | null` - Get the loaded mesh group
- `getMeshName(): string` - Get the asset name
- `getBounds(): THREE.Vector3 | null` - Get mesh bounding box size
- `setVisible(visible: boolean): void` - Show/hide the mesh
- `setMaterial(material: THREE.Material): void` - Override material
- `setStatic(isStatic: boolean): void` - Toggle static optimization
- `forceMatrixUpdate(): void` - Manually update transform (for static meshes)

### Lifecycle

MeshRenderer handles loading automatically:
1. `onCreate()` - Starts async mesh load from StowKit
2. `update()` - Polls for load completion
3. Once loaded - Mesh appears in scene automatically
4. `onCleanup()` - Disposes geometry, materials, textures

## Patterns & Best Practices

### Always Use Child GameObject Pattern

```typescript
// ✅ CORRECT - Use child GameObject for mesh
private createMeshRenderer(): void {
    const renderer = new MeshRenderer("asset_name")
    this.rendererObject = new GameObject("RendererObject")
    this.rendererObject.addComponent(renderer)
    this.gameObject.add(this.rendererObject)
    
    // Can position/rotate the mesh independently
    this.rendererObject.position.set(0, 2, 0)
}

// ❌ INCORRECT - Don't use StowKitSystem directly
private async createMeshRenderer(): Promise<void> {
    const stowkit = StowKitSystem.getInstance()
    const mesh = await stowkit.getMesh("asset_name")
    this.gameObject.add(mesh.clone())
    // Bypasses component lifecycle, harder to manage
}
```

### Position Mesh Relative to Parent

```typescript
// Good - Mesh as child allows offset
const character = new GameObject("Character")
const visualsObject = new GameObject("Visuals")
const renderer = new MeshRenderer("character_mesh")
visualsObject.addComponent(renderer)
character.add(visualsObject)

// Offset visual from collision center
visualsObject.position.set(0, -0.5, 0)
```

### Use Static for Non-Moving Objects

```typescript
// Buildings, terrain, props that never move
const renderer = new MeshRenderer("building", true, true, true)
// Saves CPU by disabling matrix updates

// After moving a static mesh, force update:
renderer.forceMatrixUpdate()
```

### Check Loaded Before Accessing

```typescript
public update(deltaTime: number): void {
    if (this.meshRenderer?.isLoaded()) {
        // Safe to use mesh methods
        const bounds = this.meshRenderer.getBounds()
    }
}
```

## Anti-Patterns

### Don't Load Meshes Directly

```typescript
// ❌ Bad - Bypasses component system
const stowkit = StowKitSystem.getInstance()
const mesh = await stowkit.getMesh("mesh_name")
this.gameObject.add(mesh)

// ✅ Good - Use MeshRenderer component
const renderer = new MeshRenderer("mesh_name")
const meshObj = new GameObject("Mesh")
meshObj.addComponent(renderer)
this.gameObject.add(meshObj)
```

### Don't Forget Cleanup

```typescript
// ❌ Bad - MeshRenderer cleans up automatically in onCleanup
// Just dispose the GameObject
this.rendererObject?.dispose()

// ✅ Good - Let MeshRenderer handle cleanup
// It disposes geometry, materials, textures automatically
```

### Don't Add Multiple MeshRenderers to Same GameObject

```typescript
// ❌ Bad - Components of same type conflict
const obj = new GameObject("Object")
obj.addComponent(new MeshRenderer("mesh1")) // Error!
obj.addComponent(new MeshRenderer("mesh2")) // Throws!

// ✅ Good - Use child GameObjects
const parent = new GameObject("Parent")

const child1 = new GameObject("Mesh1")
child1.addComponent(new MeshRenderer("mesh1"))
parent.add(child1)

const child2 = new GameObject("Mesh2")
child2.addComponent(new MeshRenderer("mesh2"))
parent.add(child2)
```

## Performance Tips

### Static Meshes

Static meshes (isStatic=true) skip matrix calculations each frame:
- Use for buildings, terrain, decorations
- Saves significant CPU on scenes with many objects
- Call `forceMatrixUpdate()` if you need to move them

### Shadow Configuration

Shadows have performance cost:
```typescript
// Disable shadows for small/distant objects
const renderer = new MeshRenderer("prop", false, false)

// Enable only for important objects
const playerRenderer = new MeshRenderer("player", true, true)
```

### Material Overrides

Reusing materials is more efficient:
```typescript
// Share material across multiple MeshRenderers
const sharedMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })

const renderer1 = new MeshRenderer("mesh1", true, true, false, sharedMaterial)
const renderer2 = new MeshRenderer("mesh2", true, true, false, sharedMaterial)
// Both use same material instance - better performance
```

## Related Systems

- [GameObject](../core/GameObject.md) - Entity class for MeshRenderer
- [Component](../core/Component.md) - Base class for MeshRenderer
- [StowKitSystem](../systems/StowKitSystem.md) - Asset loading system
- [InstancedRenderer](InstancedRenderer.md) - For many copies of same mesh
- [SkeletalRenderer](SkeletalRenderer.md) - For animated characters
- [Mesh Loading Pattern](../patterns/MeshLoading.md) - Detailed pattern guide

