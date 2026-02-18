# Component

Component is the base class for all behaviors that can be attached to GameObjects. It provides lifecycle hooks and automatic update registration.

## Quick Start

```typescript
import { Component } from "@series-inc/rundot-3d-engine"

class RotateComponent extends Component {
    private speed: number = 1
    
    constructor(speed: number = 1) {
        super()
        this.speed = speed
    }
    
    protected onCreate(): void {
        console.log("Component initialized")
    }
    
    public update(deltaTime: number): void {
        // Rotate GameObject each frame
        this.gameObject.rotation.y += this.speed * deltaTime
    }
    
    protected onCleanup(): void {
        console.log("Component cleaned up")
    }
}

// Use the component
const box = new GameObject("RotatingBox")
box.addComponent(new RotateComponent(2.0))
```

## Component Lifecycle

Components have a well-defined lifecycle with automatic hook calls:

```typescript
class LifecycleExample extends Component {
    protected onCreate(): void {
        // Called when component is added to GameObject
        // Use for initialization, getting other components
    }
    
    public onEnabled(): void {
        // Called when GameObject becomes enabled
        // Use to resume behavior, start effects
    }
    
    public update(deltaTime: number): void {
        // Called every frame while GameObject is enabled
        // Use for per-frame logic, movement, checks
    }
    
    public lateUpdate(deltaTime: number): void {
        // Called after all update() calls
        // Use for camera following, UI updates
    }
    
    public onDisabled(): void {
        // Called when GameObject becomes disabled
        // Use to pause behavior, hide effects
    }
    
    protected onCleanup(): void {
        // Called when component is removed or GameObject disposed
        // Use for cleanup, removing listeners, disposing resources
    }
}
```

## Common Use Cases

### Accessing GameObject Properties

```typescript
class MoveForward extends Component {
    private speed: number = 5
    
    public update(deltaTime: number): void {
        // Access GameObject's transform directly
        this.gameObject.position.z += this.speed * deltaTime
    }
}
```

### Getting Other Components

```typescript
class HealthDisplay extends Component {
    private meshRenderer?: MeshRenderer
    
    protected onCreate(): void {
        // Get component from same GameObject
        this.meshRenderer = this.getComponent(MeshRenderer)
        
        if (!this.meshRenderer) {
            console.warn("No MeshRenderer found!")
        }
    }
    
    public showDamage(): void {
        if (this.meshRenderer) {
            // Flash red or hide temporarily
            this.meshRenderer.setVisible(false)
        }
    }
}
```

### Enable/Disable Behavior

```typescript
class EnemyAI extends Component {
    private isActive: boolean = false
    
    public onEnabled(): void {
        this.isActive = true
        console.log("AI activated")
    }
    
    public onDisabled(): void {
        this.isActive = false
        console.log("AI deactivated")
    }
    
    public update(deltaTime: number): void {
        if (this.isActive) {
            // AI logic only runs when enabled
            this.findTarget()
            this.moveTowardsTarget(deltaTime)
        }
    }
}
```

### Accessing Scene and Game

```typescript
class SpawnManager extends Component {
    public spawnEnemy(): void {
        // Access the scene directly
        const scene = this.scene
        
        // Create new GameObjects
        const enemy = new GameObject("Enemy")
        enemy.position.set(10, 0, 10)
    }
}
```

## API Overview

### Properties

- `gameObject: GameObject` - The GameObject this component is attached to (read-only)
- `scene: THREE.Scene` - The Three.js scene (convenience accessor)

### Methods

- `getGameObject(): GameObject` - Get the attached GameObject
- `getComponent<T>(type): T | undefined` - Get another component from same GameObject
- `isAttached(): boolean` - Check if component is attached

### Lifecycle Hooks (Override These)

- `onCreate(): void` - Initialization after attachment
- `onEnabled(): void` - Called when GameObject becomes enabled
- `onDisabled(): void` - Called when GameObject becomes disabled
- `update(deltaTime: number): void` - Per-frame update
- `lateUpdate(deltaTime: number): void` - Per-frame update after all update() calls
- `onCleanup(): void` - Cleanup before removal

## Patterns & Best Practices

### Cache Component References

```typescript
// Good - Cache in onCreate
class Follower extends Component {
    private target?: Transform
    
    protected onCreate(): void {
        const targetObj = GameObject.find("Target")
        this.target = targetObj // Cache reference
    }
    
    public update(deltaTime: number): void {
        if (this.target) {
            // Use cached reference - fast!
        }
    }
}

// Bad - Search every frame
class Follower extends Component {
    public update(deltaTime: number): void {
        const target = GameObject.find("Target") // Slow!
        if (target) {
            // ...
        }
    }
}
```

### Use update() vs lateUpdate()

```typescript
// Player movement in update()
class PlayerController extends Component {
    public update(deltaTime: number): void {
        // Move player based on input
        this.movePlayer(deltaTime)
    }
}

// Camera follows player in lateUpdate()
class CameraFollow extends Component {
    public lateUpdate(deltaTime: number): void {
        // Follow player AFTER they've moved
        this.followTarget(deltaTime)
    }
}
```

### Proper Event Listener Cleanup

```typescript
class ClickHandler extends Component {
    private boundOnClick: (e: MouseEvent) => void
    
    protected onCreate(): void {
        this.boundOnClick = this.onClick.bind(this)
        document.addEventListener("click", this.boundOnClick)
    }
    
    protected onCleanup(): void {
        // Always remove listeners!
        document.removeEventListener("click", this.boundOnClick)
    }
    
    private onClick(e: MouseEvent): void {
        console.log("Clicked!")
    }
}
```

### Optional Update Methods

```typescript
// Only implement update if you need it
class StaticData extends Component {
    // No update() - won't be registered for updates (more efficient)
    
    protected onCreate(): void {
        // One-time initialization only
    }
}
```

## Anti-Patterns

### Don't Access GameObject Before Attached

```typescript
// Bad - gameObject doesn't exist yet!
class BadComponent extends Component {
    private position = this.gameObject.position // ERROR!
    
    constructor() {
        super()
    }
}

// Good - Access in onCreate or later
class GoodComponent extends Component {
    private position?: THREE.Vector3
    
    protected onCreate(): void {
        this.position = this.gameObject.position.clone()
    }
}
```

### Don't Store References to Disposed GameObjects

```typescript
// Bad - holding reference to disposed object
class Spawner extends Component {
    private spawnedObjects: GameObject[] = []
    
    public spawnObject(): void {
        const obj = new GameObject("Spawned")
        this.spawnedObjects.push(obj)
        // If obj.dispose() is called elsewhere, array has dead reference
    }
}

// Good - Remove from array when disposing
class Spawner extends Component {
    private spawnedObjects: GameObject[] = []
    
    public despawnObject(obj: GameObject): void {
        obj.dispose()
        const index = this.spawnedObjects.indexOf(obj)
        if (index > -1) {
            this.spawnedObjects.splice(index, 1)
        }
    }
}
```

## Related Systems

- [GameObject](GameObject.md) - Entity class that components attach to
- [VenusGame](VenusGame.md) - Main game class with lifecycle
- [ComponentUpdater](../../src/engine/core/ComponentUpdater.ts) - Internal update manager

