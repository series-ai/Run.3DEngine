# RigidBodyComponent

RigidBodyComponentThree adds Rapier physics to GameObjects with automatic position syncing, collision detection, and trigger events.

## Quick Start

```typescript
import { RigidBodyComponentThree, RigidBodyType, ColliderShape } from "@series-inc/rundot-3d-engine/systems"

// Dynamic physics object
const ball = new GameObject("Ball")
ball.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.SPHERE,
    radius: 0.5,
    mass: 1.0,
    restitution: 0.8  // Bouncy!
}))
```

## Common Use Cases

### Dynamic Body (Moves with Physics)

```typescript
const crate = new GameObject("Crate")
crate.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(1, 1, 1),
    mass: 10,
    friction: 0.5,
    restitution: 0.2
}))
```

### Static Body (Immovable)

```typescript
const ground = new GameObject("Ground")
ground.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.STATIC,
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(20, 0.5, 20)
}))
```

### Kinematic Body (Script-Controlled)

```typescript
const platform = new GameObject("MovingPlatform")
const rb = new RigidBodyComponentThree({
    type: RigidBodyType.KINEMATIC,
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(3, 0.5, 3)
})
platform.addComponent(rb)

// Move kinematically
rb.setNextKinematicTranslation(new THREE.Vector3(5, 2, 0))
```

### Trigger Collider (No Physics, Detects Overlap)

```typescript
class TriggerZone extends Component {
    protected onCreate(): void {
        const trigger = new RigidBodyComponentThree({
            type: RigidBodyType.STATIC,
            shape: ColliderShape.BOX,
            size: new THREE.Vector3(5, 5, 5),
            isSensor: true  // Trigger mode
        })
        this.gameObject.addComponent(trigger)
        
        // Register callbacks
        trigger.onTriggerEnter((other) => {
            console.log("Entered:", other.name)
        })
        
        trigger.onTriggerExit((other) => {
            console.log("Exited:", other.name)
        })
    }
}
```

### Auto-Fit to Mesh Bounds

```typescript
// Automatically calculate size from mesh
const renderer = new MeshRenderer("complex_mesh")
const meshObj = new GameObject("MeshObject")
meshObj.addComponent(renderer)
this.gameObject.add(meshObj)

this.gameObject.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.BOX,
    fitToMesh: true  // Auto-calculates size
}))
```

### Lock Rotations/Translations

```typescript
// Character controller - no rotation
const character = new GameObject("Character")
character.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.CAPSULE,
    radius: 0.5,
    height: 2,
    lockRotationX: true,
    lockRotationY: true,
    lockRotationZ: true
}))
```

## API Overview

### Constructor Options

```typescript
interface RigidBodyOptions {
    type?: RigidBodyType              // DYNAMIC, STATIC, KINEMATIC
    shape?: ColliderShape             // BOX, SPHERE, CAPSULE
    size?: THREE.Vector3              // Box dimensions
    radius?: number                   // Sphere/capsule radius
    height?: number                   // Capsule height
    mass?: number                     // Body mass
    restitution?: number              // Bounciness (0-1)
    friction?: number                 // Surface friction
    isSensor?: boolean                // Trigger mode
    fitToMesh?: boolean               // Auto-size from mesh
    centerOffset?: THREE.Vector3      // Collider offset
    linearDamping?: number            // Velocity damping
    angularDamping?: number           // Rotation damping
    lockRotationX/Y/Z?: boolean       // Lock rotations
    lockTranslationX/Y/Z?: boolean    // Lock movement
    enableCollisionEvents?: boolean   // Collision callbacks
    collisionGroups?: number          // Collision filtering
}
```

### Methods

- `applyForce(force: THREE.Vector3)` - Apply force at center
- `applyImpulse(impulse: THREE.Vector3)` - Apply instant impulse
- `setLinearVelocity(velocity: THREE.Vector3)` - Set velocity directly
- `getLinearVelocity(): THREE.Vector3` - Get current velocity
- `setAngularVelocity(velocity: THREE.Vector3)` - Set rotation velocity
- `setNextKinematicTranslation(position: THREE.Vector3)` - Move kinematic body
- `onTriggerEnter(callback)` - Register trigger enter callback
- `onTriggerExit(callback)` - Register trigger exit callback

## Patterns & Best Practices

### Choose Correct Body Type

```typescript
// Dynamic - Affected by forces, gravity, collisions
RigidBodyType.DYNAMIC  // Use for: balls, crates, ragdolls

// Static - Never moves, infinite mass
RigidBodyType.STATIC   // Use for: ground, walls, buildings

// Kinematic - Script-controlled, affects others
RigidBodyType.KINEMATIC // Use for: moving platforms, doors
```

### Use Appropriate Shapes

```typescript
// Box - Most common, good performance
ColliderShape.BOX

// Sphere - Best for balls, rolling objects
ColliderShape.SPHERE

// Capsule - Perfect for characters (smooth movement)
ColliderShape.CAPSULE
```

### Damping for Smooth Movement

```typescript
// Add damping to prevent sliding
new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    linearDamping: 0.5,   // Slows down over time
    angularDamping: 0.5   // Reduces spinning
})
```

## Related Systems

- [PhysicsSystem](PhysicsSystem.md) - Physics simulation manager
- [Colliders](Colliders.md) - Collision shapes and triggers
- [GameObject](../core/GameObject.md) - Entity class

