# VenusGame

VenusGame is the base class for your game application. It manages the Three.js renderer, scene, camera, and orchestrates all engine systems.

## Quick Start

```typescript
import { VenusGame } from "@series-inc/rundot-3d-engine"
import { GameObject, Component } from "@series-inc/rundot-3d-engine"

class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        // Initialize your game here
        console.log("Game starting!")
        
        // Create game objects
        const player = new GameObject("Player")
        player.position.set(0, 1, 0)
        
        // Add lighting
        const light = new THREE.DirectionalLight(0xffffff, 1)
        light.position.set(5, 10, 5)
        this.scene.add(light)
    }
    
    protected preRender(deltaTime: number): void {
        // Called every frame before rendering
        // Use deltaTime for time-based calculations
    }
    
    protected async onDispose(): Promise<void> {
        // Cleanup your game resources
        console.log("Game shutting down")
    }
}

// Start the game
MyGame.create()
```

## Common Use Cases

### Configuring Rendering

```typescript
class MyGame extends VenusGame {
    protected getConfig(): VenusGameConfig {
        return {
            backgroundColor: 0x87CEEB, // Sky blue
            antialias: true,
            shadowMapEnabled: true,
            shadowMapType: "vsm", // or "pcf_soft"
            toneMapping: "aces", // Filmic look
            toneMappingExposure: 1.0,
            audioEnabled: true
        }
    }
}
```

### Accessing Global Scene/Camera

```typescript
// From anywhere in your code after game initialization
import { VenusGame } from "@series-inc/rundot-3d-engine"

// Access the scene
const scene = VenusGame.scene

// Access the camera
const camera = VenusGame.camera

// Access the renderer
const renderer = VenusGame.renderer

// Access the game instance
const game = VenusGame.instance
```

### Custom Render Pipeline

```typescript
class MyGame extends VenusGame {
    private composer: EffectComposer
    
    protected async onStart(): Promise<void> {
        // Set up post-processing
        this.composer = new EffectComposer(this.renderer)
        // ... add passes ...
    }
    
    protected render(): void {
        // Override default rendering
        this.composer.render()
    }
}
```

### Time-Based Logic

```typescript
class MyGame extends VenusGame {
    private gameTime: number = 0
    
    protected preRender(deltaTime: number): void {
        // IMPORTANT: Use deltaTime parameter, not this.clock.getDelta()!
        this.gameTime += deltaTime
        
        // Do time-based updates
        if (this.gameTime > 60) {
            console.log("One minute elapsed!")
        }
    }
}
```

## API Overview

### Static Methods

- `VenusGame.create<T>(): Promise<T>` - Create and initialize game instance
- `VenusGame.scene` - Get the active Three.js scene
- `VenusGame.camera` - Get the active camera
- `VenusGame.renderer` - Get the WebGL renderer
- `VenusGame.instance` - Get the game instance
- `VenusGame.setAnimationCullingCamera(camera, expansion?)` - Enable animation frustum culling
- `VenusGame.getAnimationCulling()` - Get animation culling manager for advanced config

### Protected Properties

- `scene: THREE.Scene` - The Three.js scene
- `camera: THREE.PerspectiveCamera` - The main camera
- `renderer: THREE.WebGLRenderer` - The WebGL renderer
- `canvas: HTMLCanvasElement` - The render canvas
- `config: VenusGameConfig` - Merged configuration
- `audioListener: THREE.AudioListener | null` - Auto-created audio listener

### Abstract Methods (Override These)

- `onStart(): Promise<void>` - Initialize game, called after engine setup
- `preRender(deltaTime: number): void` - Called every frame before rendering
- `onDispose(): Promise<void>` - Cleanup game resources

### Configuration Method

- `getConfig(): VenusGameConfig` - Return game-specific config (merged with defaults)

### Protected Methods

- `render(): void` - Render the scene (override for custom pipelines)
- `getElapsedTime(): number` - Get total elapsed time (not delta)
- `dispose(): Promise<void>` - Dispose game and all resources

## Configuration Options

```typescript
interface VenusGameConfig {
    backgroundColor?: number           // Default: 0x000000
    antialias?: boolean               // Default: true
    shadowMapEnabled?: boolean        // Default: true
    shadowMapType?: "vsm" | "pcf_soft" // Default: "vsm"
    toneMapping?: "aces" | "linear" | "none" // Default: "aces"
    toneMappingExposure?: number      // Default: 1.0
    audioEnabled?: boolean            // Default: true
}
```

## Lifecycle

The game follows this initialization sequence:

1. `constructor()` - Creates renderer, scene, camera
2. `PhysicsSystem.initialize()` - Rapier physics setup
3. `InputManager.initialize()` - Input system setup
4. Other systems initialized (lighting, components, audio)
5. `onStart()` - Your game initialization
6. Render loop starts
7. Every frame: physics → tweens → components → `preRender()` → `render()`

## Patterns & Best Practices

### Initialize Systems in onStart

```typescript
protected async onStart(): Promise<void> {
    // Load assets first
    await this.loadAssets()
    
    // Create game objects
    this.setupScene()
    
    // Initialize game logic
    this.setupGameSystems()
}
```

### Use deltaTime Correctly

```typescript
// Good - Use deltaTime parameter
protected preRender(deltaTime: number): void {
    this.player.position.x += this.speed * deltaTime
}

// Bad - Don't call getDelta() multiple times
protected preRender(deltaTime: number): void {
    const dt = this.clock.getDelta() // Wrong! Causes timing issues
}
```

### Proper Resource Cleanup

```typescript
protected async onDispose(): Promise<void> {
    // Dispose custom systems
    this.customSystem?.cleanup()
    
    // Dispose game objects (they auto-cleanup)
    this.level?.dispose()
    
    // Clean up event listeners
    document.removeEventListener("keydown", this.boundKeyHandler)
}
```

### Responsive Camera

```typescript
protected async onStart(): Promise<void> {
    // Camera is automatically resized
    // Just set initial position
    this.camera.position.set(0, 10, 20)
    this.camera.lookAt(0, 0, 0)
}
```

### Performance Optimization

```typescript
protected getConfig(): VenusGameConfig {
    return {
        // Use VSM shadows for better quality
        shadowMapType: "vsm",
        
        // Enable ACES for filmic look
        toneMapping: "aces",
        toneMappingExposure: 1.0,
        
        // Antialiasing for smoothness (disable for better mobile perf)
        antialias: true
    }
}
```

## Anti-Patterns

### Don't Create Multiple Instances

```typescript
// Bad - Only one VenusGame should exist
const game1 = await MyGame.create()
const game2 = await MyGame.create() // Conflicts!

// Good - Create once
const game = await MyGame.create()
```

### Don't Access Clock Directly

```typescript
// Bad - Causes frame rate dependent behavior
protected preRender(deltaTime: number): void {
    const dt = this.getElapsedTime() // Wrong context!
    // Use deltaTime parameter instead
}

// Good - Use the parameter
protected preRender(deltaTime: number): void {
    this.gameTime += deltaTime
}
```

### Don't Forget to Call Super if Overriding

```typescript
// If you override dispose
public async dispose(): Promise<void> {
    this.myCustomCleanup()
    await super.dispose() // Important!
}
```

## Engine Initialization Order

When `VenusGame.create()` is called:

1. Rundot SDK initialized
2. Physics system (Rapier) initialized
3. Input manager initialized
4. Lighting system initialized
5. Component updater initialized
6. Instanced mesh manager initialized
7. Audio listener created (if enabled)
8. **Your `onStart()` method called**
9. Render loop starts
10. Loading screen hidden

## Related Systems

- [GameObject](GameObject.md) - Entities that populate the scene
- [Component](Component.md) - Behaviors attached to GameObjects
- [PhysicsSystem](../physics/PhysicsSystem.md) - Physics simulation
- [InputManager](../systems/InputManager.md) - Input handling
- [AudioSystem](../systems/AudioSystem.md) - Audio management
- [TweenSystem](../systems/TweenSystem.md) - Animation system

