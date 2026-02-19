# ParticleSystem

GPU-instanced particle system for visual effects like smoke, fire, explosions, and magic, with animation curves and sprite sheet support.

## Quick Start

```typescript
import { Particle, ParticleSystemPrefabComponent } from "@series-inc/rundot-3d-engine/systems"

// Simple particle emitter via code
const emitter = new Particle(
  {
    maxParticles: 100,
    lifetime: [0.5, 1.5],
    speed: [2, 5],
    size: { start: [0.1, 0.3], end: [0, 0] },
    gravity: new THREE.Vector3(0, -9.8, 0),
    emission: { rateOverTime: 20 },
    shape: "cone",
    coneAngle: [0, 30],
  },
  { textureUrl: "particles/smoke.png" },
)
gameObject.addComponent(emitter)
```

## Components

### Particle

A simple component for creating particle emitters from code.

```typescript
const emitter = new Particle(config, assets)
gameObject.addComponent(emitter)

// Trigger a burst of particles
emitter.trigger(50)

// Access the underlying emitter
const system = emitter.getEmitter()
```

### ParticleSystemPrefabComponent

A prefab-based particle component loaded from JSON definitions. Registered as `"particle_system"` in the component registry.

```typescript
// Typically created from prefab instantiation
const instance = PrefabLoader.instantiate(prefabNode)
const particles = instance.getComponent(ParticleSystemPrefabComponent)

// Control playback
particles?.play()
particles?.stop()
particles?.trigger(10)

// Access the underlying emitter
const system = particles?.getEmitter()
```

## EmitterConfig

```typescript
interface EmitterConfig {
  maxParticles?: number
  duration?: number
  looping?: boolean
  playOnAwake?: boolean

  // Emission
  emission?: { rateOverTime?: number; bursts?: BurstConfig[] }

  // Shape
  shape?: "cone" | "sphere" | "box" | "point"
  coneAngle?: [number, number]
  coneDirection?: THREE.Vector3
  radius?: number
  boxSize?: THREE.Vector3
  sphereRadius?: number

  // Particle properties
  lifetime?: [number, number]
  size?: { start: [number, number]; end: [number, number] }
  speed?: [number, number]
  gravity?: THREE.Vector3
  damping?: number

  // Over-lifetime curves
  sizeOverLifetime?: number | { curve: AnimationCurve }
  speedOverLifetime?: number | { curve: AnimationCurve }
  opacityOverLifetime?: number | { curve: AnimationCurve }
  rotationOverLifetime?: number | { curve: AnimationCurve }

  // Rotation
  rotation?: { angle?: [number, number]; velocity?: [number, number] }

  // Orbital motion
  orbital?: { x?: number; y?: number; z?: number }

  // Color
  color?: {
    start: [THREE.Vector4, THREE.Vector4]
    end: [THREE.Vector4, THREE.Vector4]
    mid?: [THREE.Vector4, THREE.Vector4]
  }

  // Rendering
  blending?: THREE.Blending
  premultipliedAlpha?: boolean

  // Sprite sheets
  spriteSheet?: {
    rows: number
    columns: number
    frameCount?: number
    timeMode?: "fps" | "startLifetime"
    fps?: number
    loop?: boolean
    randomStartFrame?: boolean
  }

  // Collision
  collision?: {
    enabled?: boolean
    planeY?: number
    restitution?: number
    friction?: number
    killAfterBounces?: number
  }

  // Noise
  noise?: NoiseConfig
}
```

## Animation Curves

The particle system uses an animation curve system for over-lifetime properties.

```typescript
import {
  AnimationCurve,
  CurvePresets,
  evaluateCurve,
  createCurveFromPoints,
  createKeyframe,
} from "@series-inc/rundot-3d-engine/systems"

// Use presets
const fadeOut = CurvePresets.fadeOut()
const bell = CurvePresets.bell()
const easeIn = CurvePresets.easeIn()

// Custom curve from points
const custom = createCurveFromPoints([
  [0, 0],
  [0.3, 1],
  [0.7, 1],
  [1, 0],
])

// Manual keyframes
const curve: AnimationCurve = {
  keys: [
    createKeyframe(0, 0, 0, 2),
    createKeyframe(0.5, 1, 0, 0),
    createKeyframe(1, 0, -2, 0),
  ],
}

// Evaluate
const value = evaluateCurve(curve, 0.5) // => 1
```

### CurvePresets

```typescript
CurvePresets.linear()        // 0 → 1
CurvePresets.linearInverse() // 1 → 0
CurvePresets.constant(0.5)   // Flat value
CurvePresets.easeIn()        // Slow start
CurvePresets.easeOut()       // Slow end
CurvePresets.easeInOut()     // Smooth S-curve
CurvePresets.bell()          // 0 → 1 → 0
CurvePresets.fadeIn()        // Smooth fade in
CurvePresets.fadeOut()       // Smooth fade out
CurvePresets.bounce()        // Bouncing effect
```

### Curve Utilities

- `createKeyframe(time, value, inTangent?, outTangent?): CurveKeyframe`
- `createCurveFromPoints(points): AnimationCurve`
- `evaluateCurve(curve, t): number`
- `evaluateCurveableValue(value, t, default?): number`
- `cloneCurve(curve): AnimationCurve`
- `addKeyframe(curve, keyframe): AnimationCurve`
- `removeKeyframe(curve, index): AnimationCurve`
- `updateKeyframe(curve, index, updates): AnimationCurve`

## Helper Functions

```typescript
import { createParticleEmitter, range } from "@series-inc/rundot-3d-engine/systems"

// Low-level emitter creation
const system = createParticleEmitter(config, assets)

// Helper for number ranges
const lifetime = range(0.5, 1.5)
```

## API Reference

### Particle (Component)
- `constructor(config: EmitterConfig, assets: EmitterAssets)`
- `trigger(count?): void` — emit a burst of particles
- `getEmitter(): ParticleSystem | null` — get underlying emitter

### ParticleSystemPrefabComponent (Component)
- `constructor(json: ParticleSystemJSON)`
- `play(): void` — start emitting
- `stop(): void` — stop emitting
- `trigger(count?): void` — emit a burst
- `getEmitter(): ParticleSystem | null` — get underlying emitter
- `static fromPrefabJSON(json, node): ParticleSystemPrefabComponent | null`

### ParticleSystem (Emitter Object)
- `play()` / `stop()` / `restart()` — playback control
- `burst(origin, count?)` — emit burst at position
- `setSpawnRate(rate)` — set emission rate
- `setOrigin(origin)` — set emitter origin
- `isPlaying()` — check playback state
- `getElapsed()` — get elapsed time

## Related Systems

- [PrefabSystem](PrefabSystem.md) - Particle prefab configuration
- [GameObject](../core/GameObject.md) - Attach particles to objects
- [Component](../core/Component.md) - Particle components extend Component
