# Component Communication

Patterns for components to interact and share data.

## Getting Components

### Same GameObject

```typescript
class WeaponComponent extends Component {
    private meshRenderer?: MeshRenderer
    
    protected onCreate(): void {
        // Get component from same GameObject
        this.meshRenderer = this.getComponent(MeshRenderer)
        
        if (this.meshRenderer) {
            console.log("Found MeshRenderer!")
        }
    }
}
```

### Parent/Child GameObjects

```typescript
class ChildComponent extends Component {
    private parentController?: ParentController
    
    protected onCreate(): void {
        // Get component from parent
        if (this.gameObject.parent instanceof GameObject) {
            this.parentController = this.gameObject.parent.getComponent(ParentController)
        }
    }
}
```

### Finding by Name

```typescript
class TargetFinder extends Component {
    private target?: GameObject
    
    protected onCreate(): void {
        // Search scene for GameObject by name
        const scene = VenusGame.scene
        scene.traverse((obj) => {
            if (obj instanceof GameObject && obj.name === "Target") {
                this.target = obj
            }
        })
    }
}
```

## Communication Patterns

### Direct Method Calls

```typescript
class HealthComponent extends Component {
    private health: number = 100
    
    public takeDamage(amount: number): void {
        this.health -= amount
        if (this.health <= 0) {
            this.die()
        }
    }
    
    private die(): void {
        console.log("Dead!")
        this.gameObject.dispose()
    }
}

class WeaponComponent extends Component {
    public fire(target: GameObject): void {
        const health = target.getComponent(HealthComponent)
        if (health) {
            health.takeDamage(25)
        }
    }
}
```

### Event System

```typescript
// Simple event emitter
class EventBus {
    private static listeners = new Map<string, Function[]>()
    
    static on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event)!.push(callback)
    }
    
    static emit(event: string, ...args: any[]): void {
        const callbacks = this.listeners.get(event)
        if (callbacks) {
            for (const callback of callbacks) {
                callback(...args)
            }
        }
    }
    
    static off(event: string, callback: Function): void {
        const callbacks = this.listeners.get(event)
        if (callbacks) {
            const index = callbacks.indexOf(callback)
            if (index > -1) {
                callbacks.splice(index, 1)
            }
        }
    }
}

// Use it
class ScoreComponent extends Component {
    protected onCreate(): void {
        EventBus.on("enemy_killed", this.onEnemyKilled.bind(this))
    }
    
    private onEnemyKilled(points: number): void {
        this.score += points
    }
    
    protected onCleanup(): void {
        EventBus.off("enemy_killed", this.onEnemyKilled)
    }
}

class Enemy extends Component {
    private die(): void {
        EventBus.emit("enemy_killed", 100)
        this.gameObject.dispose()
    }
}
```

### Shared State

```typescript
// Global game state
class GameState {
    static score: number = 0
    static level: number = 1
    static playerHealth: number = 100
}

// Components access shared state
class ScoreDisplay extends Component {
    public update(deltaTime: number): void {
        this.updateUI(GameState.score)
    }
}

class Enemy extends Component {
    private die(): void {
        GameState.score += 100
        this.gameObject.dispose()
    }
}
```

### Component References

```typescript
class PlayerManager extends Component {
    public static instance?: PlayerManager
    private health: number = 100
    
    protected onCreate(): void {
        PlayerManager.instance = this
    }
    
    public getHealth(): number {
        return this.health
    }
    
    protected onCleanup(): void {
        if (PlayerManager.instance === this) {
            PlayerManager.instance = undefined
        }
    }
}

// Access from anywhere
class HealthBar extends Component {
    public update(deltaTime: number): void {
        if (PlayerManager.instance) {
            const health = PlayerManager.instance.getHealth()
            this.updateBar(health)
        }
    }
}
```

## Patterns & Best Practices

### Cache Component References

```typescript
// GOOD - Cache in onCreate
class Follower extends Component {
    private target?: Transform
    
    protected onCreate(): void {
        // Cache reference once
        const targetObj = this.findTarget()
        this.target = targetObj
    }
    
    public update(deltaTime: number): void {
        if (this.target) {
            // Use cached reference
            this.followTarget(this.target)
        }
    }
}

// BAD - Search every frame
class Follower extends Component {
    public update(deltaTime: number): void {
        // Slow! Searches scene every frame
        const target = this.findTarget()
        if (target) {
            this.followTarget(target)
        }
    }
}
```

### Null Checks

```typescript
class SafeComponent extends Component {
    private dependency?: OtherComponent
    
    protected onCreate(): void {
        this.dependency = this.getComponent(OtherComponent)
        
        if (!this.dependency) {
            console.warn("Missing required component!")
        }
    }
    
    public update(deltaTime: number): void {
        // Always check before using
        if (this.dependency) {
            this.dependency.doSomething()
        }
    }
}
```

### Clean Up Event Listeners

```typescript
class EventComponent extends Component {
    private boundHandler: () => void
    
    protected onCreate(): void {
        this.boundHandler = this.handleEvent.bind(this)
        EventBus.on("game_event", this.boundHandler)
    }
    
    protected onCleanup(): void {
        // Always remove listeners!
        EventBus.off("game_event", this.boundHandler)
    }
    
    private handleEvent(): void {
        console.log("Event received")
    }
}
```

## Anti-Patterns

### Don't Store Disposed References

```typescript
// BAD - Holding reference to disposed object
class BadManager extends Component {
    private enemies: GameObject[] = []
    
    public addEnemy(enemy: GameObject): void {
        this.enemies.push(enemy)
        // If enemy.dispose() called elsewhere, array has dead reference
    }
}

// GOOD - Remove from tracking
class GoodManager extends Component {
    private enemies: GameObject[] = []
    
    public removeEnemy(enemy: GameObject): void {
        enemy.dispose()
        const index = this.enemies.indexOf(enemy)
        if (index > -1) {
            this.enemies.splice(index, 1)
        }
    }
}
```

### Don't Use Global Variables

```typescript
// BAD - Global mutable state
let globalScore = 0

// GOOD - Encapsulated state
class GameState {
    private static _score: number = 0
    
    static getScore(): number {
        return this._score
    }
    
    static addScore(points: number): void {
        this._score += points
    }
}
```

## Related Patterns

- [Creating GameObjects](CreatingGameObjects.md) - GameObject creation patterns
- [Component](../core/Component.md) - Component documentation
- [GameObject](../core/GameObject.md) - GameObject documentation

