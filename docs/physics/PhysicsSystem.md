# PhysicsSystem

PhysicsSystem manages Rapier3D physics simulation with fixed-step integration, collision detection, and trigger events.

## Quick Start

```typescript
import { PhysicsSystem } from "@series-inc/rundot-3d-engine/systems"

// Initialize (done automatically by VenusGame)
await PhysicsSystem.initialize()

// Physics steps automatically in game loop
// Add RigidBodyComponent to GameObjects for physics
```

## Common Use Cases

### Adding Physics to GameObject

```typescript
import { RigidBodyComponentThree, RigidBodyType } from "@series-inc/rundot-3d-engine/systems"

// Dynamic body (affected by gravity, forces)
const box = new GameObject("Box")
box.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(1, 1, 1),
    mass: 1.0
}))

// Static body (immovable, like ground)
const ground = new GameObject("Ground")
ground.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.STATIC,
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(10, 0.1, 10)
}))
```

### Configuring Physics Stepping

```typescript
// Configure fixed timestep (default: 120 Hz)
PhysicsSystem.configure({
    fixedTimeStep: 1/60,  // 60 Hz
    maxSubSteps: 4        // Max catch-up steps
})
```

### Accessing Physics World

```typescript
// Get Rapier world for advanced usage
const world = PhysicsSystem.getWorld()
if (world) {
    // Direct Rapier API access
    world.gravity.y = -20 // Stronger gravity
}
```

## API Overview

### Initialization

- `PhysicsSystem.initialize(): Promise<void>` - Initialize Rapier physics
- `PhysicsSystem.isReady(): boolean` - Check if initialized

### Configuration

- `configure(params)` - Set fixedTimeStep, maxSubSteps
- `getInterpolationAlpha(): number` - Get render interpolation value

### World Access

- `getWorld(): World | null` - Get Rapier physics world
- `step(deltaTime)` - Step simulation (called automatically)

### Body Management

- `createRigidBody(id, desc, colliderDesc?)` - Create physics body
- `getRigidBody(id): RigidBody | null` - Get body by ID
- `removeRigidBody(id)` - Remove and cleanup body

### Collision Events

- `registerGameObject(colliderId, gameObject)` - Register for collision events
- `registerTriggerComponent(colliderId, component)` - Register for trigger callbacks
- `unregisterGameObject(colliderId)` - Unregister GameObject
- `unregisterTriggerComponent(colliderId)` - Unregister component

### Debug Visualization

- `enableDebug(scene)` - Show collision shapes
- `disableDebug()` - Hide debug visualization
- `isDebugEnabled(): boolean` - Check debug state

## Fixed-Step Integration

PhysicsSystem uses fixed timestep for deterministic simulation:

```typescript
// Physics steps at fixed rate (default 120 Hz)
// Rendering can be any framerate (60 Hz, 144 Hz, etc.)
// System accumulates time and steps physics in fixed increments

// Example: 60 FPS render, 120 Hz physics
// Each render frame = 2 physics steps
```

Benefits:
- Deterministic simulation
- Stable at any framerate
- No physics explosions on slow frames

## Patterns & Best Practices

### Use RigidBodyComponent

```typescript
// Good - Use component system
const obj = new GameObject("PhysicsObject")
obj.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC
}))

// Avoid - Direct PhysicsSystem calls
// PhysicsSystem.createRigidBody(...) // Manual management
```

### Configure Once at Startup

```typescript
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        // Configure physics before creating bodies
        PhysicsSystem.configure({
            fixedTimeStep: 1/120,
            maxSubSteps: 8
        })
    }
}
```

## Related Systems

- [RigidBodyComponent](RigidBodyComponent.md) - Add physics to GameObjects
- [Colliders](Colliders.md) - Collision shapes and triggers
- [VenusGame](../core/VenusGame.md) - Initializes PhysicsSystem

