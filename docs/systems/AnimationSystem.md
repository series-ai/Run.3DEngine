# AnimationSystem

Advanced animation system with state machines, blend trees, parameter-driven transitions, and frustum culling for skeletal characters.

## Quick Start

```typescript
import { AnimationGraphComponent } from "@series-inc/rundot-3d-engine/systems"

// Create animation graph config
const animConfig = {
  states: {
    idle: { animation: "idle" },
    walk: { animation: "walk" },
    run: { animation: "run" },
  },
  initialState: "idle",
}

// Add to character with a loaded model
const animGraph = new AnimationGraphComponent(model, animConfig)
character.addComponent(animGraph)

// Change state directly
animGraph.setState("run")
```

## Common Use Cases

### Parameter-Driven Transitions

```typescript
const animConfig = {
  parameters: {
    speed: { type: "float", default: 0 },
    isGrounded: { type: "bool", default: true },
  },
  states: {
    idle: { animation: "idle" },
    walk: { animation: "walk" },
    run: { animation: "run" },
  },
  transitions: [
    { from: "idle", to: "walk", when: { speed: 1 } },
    { from: "walk", to: "run", when: { speed: 2 } },
    { from: "run", to: "walk", when: { speed: 1 } },
    { from: "walk", to: "idle", when: { speed: 0 } },
  ],
  initialState: "idle",
}

const animGraph = new AnimationGraphComponent(model, animConfig)
character.addComponent(animGraph)
```

```typescript
class CharacterController extends Component {
    private animGraph?: AnimationGraphComponent

    protected onCreate(): void {
        this.animGraph = this.getComponent(AnimationGraphComponent)
    }

    public update(deltaTime: number): void {
        const speed = this.getMovementSpeed()
        this.animGraph?.setParameter("speed", speed)
        // Transitions happen automatically based on conditions
    }
}
```

### Blend Trees

```typescript
const animConfig = {
  parameters: {
    speed: { type: "float", default: 0 },
  },
  states: {
    locomotion: {
      tree: {
        parameter: "speed",
        children: [
          { animation: "idle", threshold: 0 },
          { animation: "walk", threshold: 1 },
          { animation: "run", threshold: 2 },
        ],
      },
    },
  },
  initialState: "locomotion",
}
```

### Exit Time Transitions

```typescript
// Transition after animation finishes playing
{ from: "attack", to: "idle", exitTime: 1.0 }

// Transition at 50% through the animation
{ from: "attack", to: "idle", exitTime: 0.5 }
```

### Randomized Start Times

```typescript
// Useful for crowds so characters don't animate in sync
states: {
  idle: { animation: "idle", randomizeStartTime: true },
}
```

### Animation Culling

```typescript
// Enable/disable frustum culling per animator (enabled by default)
animGraph.setFrustumCulling(true)
animGraph.setBoundingRadius(4)

// Global culling settings
const culling = AnimationGraphComponent.getCullingManager()
```

## AnimationControllerComponent

A simpler component for animation state machine visualization and debug. Does not handle actual animation playback (use `AnimationGraphComponent` for that).

```typescript
import { AnimationControllerComponent } from "@series-inc/rundot-3d-engine/systems"

const controller = new AnimationControllerComponent(true) // debug mode

// Add parameters
controller.addParameter("speed", ParameterType.FLOAT, 0)

// Set parameter values
controller.setBool("isRunning", true)
controller.setFloat("speed", 5.0)
controller.setInt("health", 100)

// Control state
controller.setState("idle")
controller.getCurrentState()
controller.stopAll()

// Enable debug visualizer for all instances
AnimationControllerComponent.setDebugViewEnabled(true)
```

## API Overview

### AnimationGraphComponent

- `constructor(model, config)` - Create with a THREE.Object3D and an AnimationGraphConfig
- `setState(stateName)` - Switch to a state
- `getCurrentState()` - Get current state name
- `setParameter(name, value)` - Set a parameter value (drives transitions and blend trees)
- `getParameter(name)` - Get a parameter value
- `setFrustumCulling(enabled)` - Enable/disable frustum culling
- `setBoundingRadius(radius)` - Set bounding sphere radius for culling
- `setPaused(paused)` - Pause/unpause animation updates
- `isPaused()` - Check if paused
- `static getCullingManager()` - Get the global AnimationCullingManager
- `static setDebugViewEnabled(enabled)` - Toggle debug visualizer

### AnimationControllerComponent

- `constructor(debug?)` - Create controller, optionally with debug mode
- `setState(stateId)` - Switch to a state
- `getCurrentState()` - Get current state name
- `addParameter(name, type, initialValue)` - Register a parameter
- `setBool(name, value)` / `setFloat(name, value)` / `setInt(name, value)` - Set parameter values
- `stopAll()` - Stop all animations
- `getAnimator()` - Get the underlying Animatrix instance

## Related Systems

- [SkeletalRenderer](../rendering/SkeletalRenderer.md) - Animated character meshes
- [AssetManager](../rendering/AssetManager.md) - Load animation clips
