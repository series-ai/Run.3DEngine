# Colliders

Collision shapes and trigger systems for physics interactions using Rapier3D.

## Collider Shapes

### Box Collider

```typescript
new RigidBodyComponentThree({
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(width, height, depth)
})
```

Best for: Crates, walls, platforms, buildings

### Sphere Collider

```typescript
new RigidBodyComponentThree({
    shape: ColliderShape.SPHERE,
    radius: 0.5
})
```

Best for: Balls, projectiles, round objects

### Capsule Collider

```typescript
new RigidBodyComponentThree({
    shape: ColliderShape.CAPSULE,
    radius: 0.5,
    height: 2.0
})
```

Best for: Characters, cylinders (smooth movement, no edge catching)

## Auto-Fitted Colliders (Bounds)

Instead of manually specifying collider dimensions, you can automatically fit colliders to mesh bounds:

### fitToMesh Option

The simplest way to auto-fit a collider to a mesh:

```typescript
const rigidBody = new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.BOX,
    fitToMesh: true  // Automatically calculates size from mesh bounds
})
this.gameObject.addComponent(rigidBody)
```

Best for: Any mesh where you want automatic collision sizing

### Manual Bounds Calculation

Calculate bounds manually for more control:

```typescript
// Get bounds from GameObject's meshes
const bounds = RigidBodyComponentThree.getMeshBounds(this.gameObject)

// Create collider with calculated bounds
const rigidBody = new RigidBodyComponentThree({
    type: RigidBodyType.STATIC,
    shape: ColliderShape.BOX,
    size: bounds
})
this.gameObject.addComponent(rigidBody)
```

### Using MeshRenderer Bounds

Get bounds directly from a MeshRenderer component:

```typescript
const renderer = this.gameObject.getComponent(MeshRenderer)
const bounds = renderer?.getBounds()

if (bounds) {
    const rigidBody = RigidBodyComponentThree.fromBounds(bounds, {
        type: RigidBodyType.STATIC,
        shape: ColliderShape.BOX
    })
    this.gameObject.addComponent(rigidBody)
}
```

### When to Use Bounds vs Manual Sizing

**Use Auto-Fitted Bounds When:**
- ✅ Mesh shape closely matches the desired collision shape
- ✅ Accurate collision is more important than performance
- ✅ Prototyping or rapid development
- ✅ Mesh dimensions are unknown or variable

**Use Manual Primitive Colliders When:**
- ✅ Mesh is complex with many vertices
- ✅ Approximate collision is acceptable
- ✅ Performance is critical (many instances)
- ✅ Simpler collision behavior is desired
- ✅ Collision shape should be different from visual mesh

See [Mesh Colliders Pattern](../patterns/MeshColliders.md) for detailed examples.

## Trigger Colliders (Sensors)

Triggers detect overlaps without physical collision:

```typescript
class PickupZone extends Component {
    protected onCreate(): void {
        const trigger = new RigidBodyComponentThree({
            type: RigidBodyType.STATIC,
            shape: ColliderShape.BOX,
            size: new THREE.Vector3(2, 2, 2),
            isSensor: true  // Makes it a trigger
        })
        this.gameObject.addComponent(trigger)
        
        trigger.onTriggerEnter((other: GameObject) => {
            console.log(`${other.name} entered pickup zone`)
            this.collectItem(other)
        })
        
        trigger.onTriggerExit((other: GameObject) => {
            console.log(`${other.name} left pickup zone`)
        })
    }
}
```

## Collision Groups

Filter which objects collide with each other:

```typescript
import { createCollisionGroup } from "@series-inc/rundot-3d-engine/systems"

// Define groups (16-bit bitmasks)
const PLAYER_GROUP = 0x0001
const ENEMY_GROUP = 0x0002
const PROJECTILE_GROUP = 0x0004

// Player collides with enemies and projectiles
const playerBody = new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    collisionGroups: createCollisionGroup(
        PLAYER_GROUP,                           // I am player
        ENEMY_GROUP | PROJECTILE_GROUP          // I collide with these
    )
})

// Enemy collides only with player
const enemyBody = new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    collisionGroups: createCollisionGroup(
        ENEMY_GROUP,    // I am enemy
        PLAYER_GROUP    // I collide with player only
    )
})
```

## Collision Properties

### Restitution (Bounciness)

```typescript
restitution: 0.0  // No bounce (clay)
restitution: 0.5  // Medium bounce (wood)
restitution: 0.9  // High bounce (rubber ball)
```

### Friction

```typescript
friction: 0.0  // Ice (slippery)
friction: 0.5  // Normal (wood on wood)
friction: 1.0  // High friction (rubber)
```

## Common Patterns

### Character Controller

```typescript
const character = new GameObject("Player")
character.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.CAPSULE,
    radius: 0.5,
    height: 1.8,
    mass: 70,
    friction: 0.0,          // Smooth movement
    lockRotationX: true,    // No tipping
    lockRotationY: true,
    lockRotationZ: true,
    linearDamping: 0.9      // Quick stop
}))
```

### Projectile

```typescript
const bullet = new GameObject("Bullet")
bullet.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.SPHERE,
    radius: 0.1,
    mass: 0.01,
    restitution: 0.3,
    friction: 0.1
}))

// Apply velocity
const rb = bullet.getComponent(RigidBodyComponentThree)
rb?.setLinearVelocity(new THREE.Vector3(0, 0, 50))
```

### Trigger Zone

```typescript
const zone = new GameObject("TriggerZone")
const trigger = new RigidBodyComponentThree({
    type: RigidBodyType.STATIC,
    shape: ColliderShape.BOX,
    size: new THREE.Vector3(10, 5, 10),
    isSensor: true
})
zone.addComponent(trigger)

trigger.onTriggerEnter((other) => {
    if (other.name === "Player") {
        console.log("Player entered zone!")
    }
})
```

## Related Systems

- [RigidBodyComponent](RigidBodyComponent.md) - Physics bodies
- [PhysicsSystem](PhysicsSystem.md) - Physics simulation
- [Mesh Colliders Pattern](../patterns/MeshColliders.md) - Loading meshes with collision

