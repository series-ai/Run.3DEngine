# GameObject

GameObject is the base entity class in the Rundot 3D Engine, extending THREE.Object3D to provide entity-component architecture with automatic lifecycle management.

## Quick Start

```typescript
import { GameObject } from "@series-inc/rundot-3d-engine"

// Create a GameObject (automatically added to scene)
const player = new GameObject("Player")
player.position.set(0, 1, 0)

// Add components for behavior
const renderer = new MeshRenderer("character_mesh")
player.addComponent(renderer)

const controller = new PlayerController()
player.addComponent(controller)
```

## Common Use Cases

### Creating Child Objects

```typescript
// Create parent-child hierarchy
const parent = new GameObject("Parent")
const child = new GameObject("Child")

// Attach child to parent
parent.add(child)
child.position.set(2, 0, 0) // Local position relative to parent
```

### Getting Components

```typescript
// Retrieve a component from the same GameObject
const meshRenderer = player.getComponent(MeshRenderer)
if (meshRenderer) {
    meshRenderer.setVisible(false)
}

// Check if a component exists
if (player.hasComponent(RigidBodyComponent)) {
    console.log("Player has physics enabled")
}
```

### Enable/Disable Objects

```typescript
// Disable GameObject and all its components
player.setEnabled(false) // Triggers onDisabled() on all components

// Enable GameObject
player.setEnabled(true) // Triggers onEnabled() on all components

// Check enabled state (includes parent hierarchy)
if (player.isEnabled()) {
    console.log("Player is active")
}
```

### Cleanup

```typescript
// Properly dispose GameObject and all components
player.dispose() // Cleans up components, removes from scene, disposes meshes

// Remove a single component
player.removeComponent(RigidBodyComponent) // Triggers onCleanup() on component
```

## API Overview

### Constructor

- `new GameObject(name?: string)` - Creates GameObject and adds to scene. Auto-generates name if not provided.

### Component Management

- `addComponent<T>(component: T): T` - Adds a component instance. Throws if duplicate type exists.
- `getComponent<T>(type): T | undefined` - Gets component of specified type.
- `hasComponent<T>(type): boolean` - Checks if component exists.
- `removeComponent<T>(type): boolean` - Removes and cleans up component.

### Hierarchy

- `add(...objects)` - Add child objects (THREE.Object3D or GameObject).
- `parent` - Reference to parent object.
- `children` - Array of child objects.

### Lifecycle

- `dispose()` - Cleanup GameObject, all components, and children recursively.
- `setEnabled(enabled: boolean)` - Set enabled state, triggering component callbacks.
- `isEnabled(): boolean` - Check if enabled (includes parent hierarchy).

### Three.js Properties

GameObjects inherit all THREE.Object3D properties:
- `position: THREE.Vector3` - World or local position
- `rotation: THREE.Euler` - Rotation in radians
- `scale: THREE.Vector3` - Scale factors
- `quaternion: THREE.Quaternion` - Alternative rotation representation
- `visible: boolean` - Visibility (use setEnabled() for components)

## Patterns & Best Practices

### Always Name Your GameObjects

```typescript
// Good - Easy to debug
const pickup = new GameObject("MoneyPickup")

// Avoid - Auto-generated name is harder to track
const pickup = new GameObject()
```

### Use Child GameObjects for Hierarchy

```typescript
// Good - Organized hierarchy
const character = new GameObject("Character")
const visualsObject = new GameObject("Visuals")
const meshRenderer = new MeshRenderer("character_model")
visualsObject.addComponent(meshRenderer)
character.add(visualsObject)

// Now you can manipulate visuals separately
visualsObject.position.set(0, -0.5, 0) // Offset visual from collision center
```

### Proper Cleanup

```typescript
// Always dispose GameObjects when done
onGameEnd() {
    this.player.dispose() // Cleans up ALL components and children
}

// Don't just remove from scene
// Bad: this.player.removeFromParent() // Components still running!
```

### Component Communication

```typescript
// Good - Get component reference in onCreate
class MyComponent extends Component {
    private meshRenderer?: MeshRenderer
    
    protected onCreate(): void {
        this.meshRenderer = this.getComponent(MeshRenderer)
    }
    
    public update(deltaTime: number): void {
        if (this.meshRenderer) {
            // Use cached reference
        }
    }
}
```

## Anti-Patterns

### Don't Create GameObjects in Update

```typescript
// Bad - Creates new GameObject every frame
public update(deltaTime: number): void {
    const temp = new GameObject("Temp") // Memory leak!
}

// Good - Create once, reuse or pool
```

### Don't Forget to Dispose

```typescript
// Bad - Memory leak
spawnPickup() {
    const pickup = new GameObject("Pickup")
    // ... use it briefly ...
    // Never disposed!
}

// Good - Always clean up
spawnPickup() {
    const pickup = new GameObject("Pickup")
    // ... use it ...
    pickup.dispose() // Clean up when done
}
```

## Related Systems

- [Component](Component.md) - Base class for GameObject behaviors
- [VenusGame](VenusGame.md) - Main game class that manages the scene
- [MeshRenderer](../rendering/MeshRenderer.md) - Render 3D meshes on GameObjects
- [RigidBodyComponent](../physics/RigidBodyComponent.md) - Add physics to GameObjects

