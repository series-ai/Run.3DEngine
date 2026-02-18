# SkeletalRenderer

SkeletalRenderer loads and displays animated character meshes with skeletal animations. It properly clones bone structures and works with the animation system.

## Quick Start

```typescript
import { GameObject, SkeletalRenderer } from "@series-inc/rundot-3d-engine"
import { AssetManager } from "@series-inc/rundot-3d-engine/assets"

// 1. Preload skeletal model
await AssetManager.preloadSkeletalModel("Character/character_main.fbx")

// 2. Create character with skeletal renderer
const character = new GameObject("Character")
const renderer = new SkeletalRenderer("Character/character_main.fbx")
character.addComponent(renderer)

// 3. Access skeletal model for animation
const skeletalModel = renderer.getSkeletalModel()
// Use with AnimationSystem
```

## Common Use Cases

### Basic Character Setup

```typescript
class Character extends Component {
    private skeletalRenderer?: SkeletalRenderer
    
    protected async onCreate(): Promise<void> {
        // Must preload first
        await AssetManager.preloadSkeletalModel("Character/character_main.fbx")
        
        // Add renderer
        this.skeletalRenderer = new SkeletalRenderer("Character/character_main.fbx")
        this.gameObject.addComponent(this.skeletalRenderer)
    }
}
```

### With Custom Material

```typescript
import * as THREE from "three"

// Create custom material
const characterMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    metalness: 0.1,
    roughness: 0.8
})

// Apply to skeletal renderer
const renderer = new SkeletalRenderer(
    "Character/character_main.fbx",
    characterMaterial
)
```

### Integration with Animation System

```typescript
import { AnimationControllerComponent } from "@series-inc/rundot-3d-engine/systems"

class AnimatedCharacter extends Component {
    protected async onCreate(): Promise<void> {
        // Preload model and animations
        await AssetManager.preloadSkeletalModel("Character/character.fbx")
        await AssetManager.preloadAssets([
            "Animations/walk.fbx",
            "Animations/run.fbx",
            "Animations/idle.fbx"
        ])
        
        // Add skeletal renderer
        const renderer = new SkeletalRenderer("Character/character.fbx")
        this.gameObject.addComponent(renderer)
        
        // Add animation controller
        const animController = new AnimationControllerComponent()
        this.gameObject.addComponent(animController)
        
        // Get skeletal model for animation setup
        const model = renderer.getSkeletalModel()
        if (model) {
            // Animation controller will find and use this model
            animController.setTarget(model)
        }
    }
}
```

### Accessing Model for Custom Animation

```typescript
class CustomAnimatedCharacter extends Component {
    private mixer?: THREE.AnimationMixer
    private renderer?: SkeletalRenderer
    
    protected onCreate(): void {
        this.renderer = new SkeletalRenderer("Character/character.fbx")
        this.gameObject.addComponent(this.renderer)
        
        const model = this.renderer.getSkeletalModel()
        if (model) {
            // Set up custom animation mixer
            this.mixer = new THREE.AnimationMixer(model)
            
            // Load and play animation
            const clip = AssetManager.getAnimationClip("Animations/walk.fbx")
            if (clip) {
                const action = this.mixer.clipAction(clip)
                action.play()
            }
        }
    }
    
    public update(deltaTime: number): void {
        this.mixer?.update(deltaTime)
    }
}
```

## API Overview

### Constructor

```typescript
new SkeletalRenderer(
    assetPath: string,
    material?: THREE.Material
)
```

### Methods

- `getGroup(): THREE.Group | null` - Get wrapper group (attached to GameObject)
- `getSkeletalModel(): THREE.Object3D | null` - Get skeletal model for animation
- `getAssetPath(): string` - Get asset path being rendered
- `getMaterial(): THREE.Material | null` - Get custom material if set
- `setMaterial(material: THREE.Material): void` - Change material at runtime

### Shadow Behavior

SkeletalRenderer always:
- Casts shadows (`castShadow: true`)
- Receives shadows (`receiveShadow: true`)
- These cannot be disabled (characters always interact with lighting)

## Patterns & Best Practices

### Always Preload Before Using

```typescript
// Good - Preload in game initialization
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        // Preload all character models
        await AssetManager.preloadSkeletalModel("Character/player.fbx")
        await AssetManager.preloadSkeletalModel("Character/enemy.fbx")
        
        // Now safe to use
        this.createCharacters()
    }
}

// Bad - Don't use without preloading
const renderer = new SkeletalRenderer("Character/player.fbx") // Error!
```

### Use with AnimationControllerComponent

```typescript
// Good - Let AnimationController manage animations
const renderer = new SkeletalRenderer("Character/char.fbx")
this.gameObject.addComponent(renderer)

const animController = new AnimationControllerComponent()
this.gameObject.addComponent(animController)
// AnimationController finds and uses the skeletal model
```

### Material Customization

```typescript
// Apply game-specific materials to characters
const toonMaterial = MaterialUtils.createToonMaterial(0xff5500)

const renderer = new SkeletalRenderer(
    "Character/character.fbx",
    toonMaterial
)
```

## Anti-Patterns

### Don't Use for Static Meshes

```typescript
// Bad - SkeletalRenderer is for animated characters only
const tree = new SkeletalRenderer("tree.fbx")

// Good - Use MeshRenderer for static objects
const renderer = new MeshRenderer("tree")
const treeObj = new GameObject("TreeMesh")
treeObj.addComponent(renderer)
this.gameObject.add(treeObj)
```

### Don't Forget Preloading

```typescript
// Bad - Throws error "No skeletal model found"
const renderer = new SkeletalRenderer("Character/player.fbx")
this.gameObject.addComponent(renderer) // ERROR!

// Good - Preload first
await AssetManager.preloadSkeletalModel("Character/player.fbx")
const renderer = new SkeletalRenderer("Character/player.fbx")
this.gameObject.addComponent(renderer) // Works!
```

### Don't Clone Manually

```typescript
// Bad - Manual cloning breaks bones
const model = AssetManager.getAssetGroup("Character/char.fbx")
const clone = model.clone() // Broken bones!

// Good - Use SkeletalRenderer (uses SkeletonCache)
const renderer = new SkeletalRenderer("Character/char.fbx")
// Properly clones with bone structure intact
```

## Character Setup Workflow

Typical workflow for setting up animated characters:

```typescript
class CharacterSetup {
    static async preloadAssets(): Promise<void> {
        // 1. Preload character model
        await AssetManager.preloadSkeletalModel("Character/player.fbx")
        
        // 2. Preload animations
        await AssetManager.preloadAssets([
            "Animations/idle.fbx",
            "Animations/walk.fbx",
            "Animations/run.fbx",
            "Animations/jump.fbx"
        ])
    }
    
    static create(): GameObject {
        // 3. Create GameObject
        const character = new GameObject("Player")
        
        // 4. Add SkeletalRenderer
        const renderer = new SkeletalRenderer("Character/player.fbx")
        character.addComponent(renderer)
        
        // 5. Add AnimationController
        const animController = new AnimationControllerComponent()
        character.addComponent(animController)
        
        // 6. Set up animation states
        animController.addState("idle", "Animations/idle.fbx")
        animController.addState("walk", "Animations/walk.fbx")
        animController.setState("idle")
        
        return character
    }
}
```

## Performance Considerations

### Skeletal Animation Cost

Skeletal rendering is more expensive than static meshes:
- Bone calculations per frame
- Animation blending
- Skin weights processing

### Optimization Tips

```typescript
// Reduce character LOD distance
VenusGame.getAnimationCulling().setDistanceCullingEnabled(true)
VenusGame.getAnimationCulling().setMaxDistance(50) // Units

// Use frustum culling
VenusGame.setAnimationCullingCamera(camera, 1.2)

// Limit active characters
// Pool inactive characters instead of creating/destroying
```

## Related Systems

- [AssetManager](AssetManager.md) - Preloading skeletal models
- [AnimationControllerComponent](../systems/AnimationSystem.md) - Animation management
- [MeshRenderer](MeshRenderer.md) - For non-animated meshes
- [GameObject](../core/GameObject.md) - Entity class
- [Component](../core/Component.md) - Base component class

