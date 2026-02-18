# AnimationSystem

Advanced animation system with state machines, blending, retargeting, and frustum culling for skeletal characters.

## Quick Start

```typescript
import { AnimationControllerComponent } from "@series-inc/rundot-3d-engine/systems"

// Add to character with SkeletalRenderer
const character = new GameObject("Character")
character.addComponent(new SkeletalRenderer("Character/player.fbx"))

const animController = new AnimationControllerComponent()
character.addComponent(animController)

// Add animation states
animController.addState("idle", "Animations/idle.fbx")
animController.addState("walk", "Animations/walk.fbx")
animController.addState("run", "Animations/run.fbx")

// Play animation
animController.setState("idle")
```

## Common Use Cases

### State Machine

```typescript
class CharacterController extends Component {
    private animController?: AnimationControllerComponent
    
    protected onCreate(): void {
        this.animController = this.getComponent(AnimationControllerComponent)
    }
    
    public update(deltaTime: number): void {
        const speed = this.getMovementSpeed()
        
        if (speed === 0) {
            this.animController?.setState("idle")
        } else if (speed < 5) {
            this.animController?.setState("walk")
        } else {
            this.animController?.setState("run")
        }
    }
}
```

### Animation Culling

```typescript
// Enable frustum culling to skip animations for off-screen characters
VenusGame.setAnimationCullingCamera(camera, 1.2)

// Or distance culling
const culling = VenusGame.getAnimationCulling()
culling.setDistanceCullingEnabled(true)
culling.setMaxDistance(50) // Units
```

## API Overview

- `addState(name, animationPath)` - Register animation state
- `setState(name)` - Switch to animation
- `setBlendDuration(seconds)` - Set transition time
- `getState(): string` - Get current state

## Related Systems

- [SkeletalRenderer](../rendering/SkeletalRenderer.md) - Animated character meshes
- [AssetManager](../rendering/AssetManager.md) - Load animation clips

