# Creating GameObjects

Best practices for GameObject instantiation, hierarchy, and lifecycle management.

## Basic Creation

```typescript
// Always name your GameObjects
const player = new GameObject("Player")
player.position.set(0, 1, 0)

// Add components for behavior
player.addComponent(new PlayerController())
player.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC
}))
```

## Hierarchy Patterns

### Parent-Child Relationships

```typescript
// Create parent
const vehicle = new GameObject("Vehicle")

// Create children
const body = new GameObject("Body")
const wheel1 = new GameObject("Wheel1")
const wheel2 = new GameObject("Wheel2")

// Build hierarchy
vehicle.add(body)
vehicle.add(wheel1)
vehicle.add(wheel2)

// Position children relative to parent
wheel1.position.set(-1, 0, 0)
wheel2.position.set(1, 0, 0)

// Moving parent moves all children
vehicle.position.x += 5
```

### Separation of Concerns

```typescript
// Separate visual from logic
const character = new GameObject("Character")

// Logic/physics on parent
character.addComponent(new CharacterController())
character.addComponent(new RigidBodyComponentThree({
    type: RigidBodyType.DYNAMIC,
    shape: ColliderShape.CAPSULE
}))

// Visual as child (can be offset)
const visual = new GameObject("Visual")
visual.addComponent(new SkeletalRenderer("character.fbx"))
character.add(visual)
visual.position.y = -1 // Offset visual down
```

## Component Organization

### Single Responsibility

```typescript
// Good - Each component does one thing
const enemy = new GameObject("Enemy")
enemy.addComponent(new EnemyAI())        // Behavior
enemy.addComponent(new HealthComponent()) // Health tracking
enemy.addComponent(new MeshRenderer("enemy_mesh")) // Visual

// Bad - One component doing everything
enemy.addComponent(new EnemyEverything()) // AI + health + rendering
```

### Component Dependencies

```typescript
class WeaponComponent extends Component {
    private meshRenderer?: MeshRenderer
    
    protected onCreate(): void {
        // Get required components
        this.meshRenderer = this.getComponent(MeshRenderer)
        
        if (!this.meshRenderer) {
            console.error("WeaponComponent requires MeshRenderer!")
        }
    }
}
```

## Lifecycle Management

### Proper Initialization

```typescript
class SpawnManager extends Component {
    private enemies: GameObject[] = []
    
    public spawnEnemy(): void {
        // Create
        const enemy = new GameObject("Enemy")
        
        // Configure
        enemy.position.set(10, 0, 10)
        enemy.addComponent(new EnemyAI())
        
        // Track
        this.enemies.push(enemy)
    }
    
    protected onCleanup(): void {
        // Clean up all spawned objects
        for (const enemy of this.enemies) {
            enemy.dispose()
        }
        this.enemies = []
    }
}
```

### Pooling Pattern

```typescript
class ObjectPool {
    private pool: GameObject[] = []
    private active: GameObject[] = []
    
    public get(): GameObject {
        // Reuse from pool
        let obj = this.pool.pop()
        
        if (!obj) {
            // Create new if pool empty
            obj = new GameObject("Pooled")
            obj.addComponent(new PooledComponent())
        }
        
        obj.setEnabled(true)
        this.active.push(obj)
        return obj
    }
    
    public release(obj: GameObject): void {
        // Return to pool
        obj.setEnabled(false)
        const index = this.active.indexOf(obj)
        if (index > -1) {
            this.active.splice(index, 1)
            this.pool.push(obj)
        }
    }
    
    public cleanup(): void {
        // Dispose all
        for (const obj of [...this.pool, ...this.active]) {
            obj.dispose()
        }
        this.pool = []
        this.active = []
    }
}
```

## Common Patterns

### Factory Pattern

```typescript
class EnemyFactory {
    static createBasicEnemy(): GameObject {
        const enemy = new GameObject("BasicEnemy")
        enemy.addComponent(new EnemyAI())
        enemy.addComponent(new HealthComponent(100))
        
        const visual = new GameObject("Visual")
        visual.addComponent(new MeshRenderer("enemy_basic"))
        enemy.add(visual)
        
        return enemy
    }
    
    static createBossEnemy(): GameObject {
        const boss = new GameObject("BossEnemy")
        boss.addComponent(new BossAI())
        boss.addComponent(new HealthComponent(1000))
        
        const visual = new GameObject("Visual")
        visual.addComponent(new SkeletalRenderer("boss.fbx"))
        boss.add(visual)
        
        return boss
    }
}
```

### Builder Pattern

```typescript
class CharacterBuilder {
    private character: GameObject
    
    constructor(name: string) {
        this.character = new GameObject(name)
    }
    
    withMesh(meshName: string): this {
        const visual = new GameObject("Visual")
        visual.addComponent(new MeshRenderer(meshName))
        this.character.add(visual)
        return this
    }
    
    withPhysics(options: RigidBodyOptions): this {
        this.character.addComponent(new RigidBodyComponentThree(options))
        return this
    }
    
    withAI(): this {
        this.character.addComponent(new EnemyAI())
        return this
    }
    
    build(): GameObject {
        return this.character
    }
}

// Use it
const enemy = new CharacterBuilder("Enemy")
    .withMesh("enemy_mesh")
    .withPhysics({ type: RigidBodyType.DYNAMIC })
    .withAI()
    .build()
```

## Anti-Patterns

### Don't Create in Update

```typescript
// BAD - Creates objects every frame
public update(deltaTime: number): void {
    const temp = new GameObject("Temp") // Memory leak!
}

// GOOD - Create once, reuse
private tempObject: GameObject
protected onCreate(): void {
    this.tempObject = new GameObject("Temp")
}
```

### Don't Forget Disposal

```typescript
// BAD - Memory leak
spawnProjectile() {
    const bullet = new GameObject("Bullet")
    // Never disposed!
}

// GOOD - Track and clean up
private bullets: GameObject[] = []

spawnProjectile() {
    const bullet = new GameObject("Bullet")
    this.bullets.push(bullet)
}

cleanupBullet(bullet: GameObject) {
    bullet.dispose()
    const index = this.bullets.indexOf(bullet)
    if (index > -1) {
        this.bullets.splice(index, 1)
    }
}
```

## Related Patterns

- [Mesh Loading](MeshLoading.md) - Loading meshes correctly
- [Component Communication](ComponentCommunication.md) - Inter-component patterns
- [GameObject](../core/GameObject.md) - GameObject documentation

