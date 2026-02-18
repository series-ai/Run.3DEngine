# ParticleSystem

Flexible particle system for visual effects like smoke, fire, explosions, and magic.

## Quick Start

```typescript
import { ParticleSystemPrefabComponent } from "@series-inc/rundot-3d-engine/systems"

// Particles are typically created from prefabs
// See prefab documentation for particle configuration
```

## Common Use Cases

### Explosion Effect

Particles are configured in prefab JSON with properties:
- Emission rate
- Particle lifetime
- Velocity curves
- Color gradients
- Size over time
- Sprite sheets

### Smoke Trail

Configure particles to:
- Emit continuously
- Move upward
- Fade out over time
- Scale up gradually

## API Overview

- `ParticleSystemPrefabComponent` - Prefab-based particle emitter
- Configure via prefab JSON definitions
- Supports sprite sheets for animated particles

## Related Systems

- [PrefabSystem](PrefabSystem.md) - Particle configuration
- [GameObject](../core/GameObject.md) - Attach particles to objects

