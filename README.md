# Venus Three Engine

A Three.js-based game engine with ECS architecture, physics, navigation, and comprehensive game systems.

## Features

- **ECS Architecture**: Component-based GameObject system
- **Physics**: Rapier3D integration with RigidBody components
- **Navigation**: Dynamic navigation system with A* pathfinding
- **Animation**: Advanced animation system with blending and retargeting
- **Audio**: 2D/3D audio system with music management
- **UI**: Comprehensive UI system with utilities
- **Camera**: Follow camera, free camera with smooth transitions
- **Asset Loading**: FBX, GLB, OBJ loaders with skeleton caching
- **Particles**: Flexible particle system
- **Input**: Cross-platform input management with mobile support

## Installation

### As npm workspace dependency
```json
{
  "dependencies": {
    "@series-ai/venus-three": "^0.2.0"
  }
}
```

### As git submodule
```bash
git submodule add git@github-other:series-ai/venus-three-engine.git venus-three
git submodule update --init --recursive
```

## Usage

```typescript
import { VenusGame, GameObject, Component } from "@series-ai/venus-three"
import { PhysicsSystem, UISystem } from "@series-ai/venus-three/systems"

class MyGame extends VenusGame {
  async onCreate(): Promise<void> {
    // Initialize game
  }
  
  async onStart(): Promise<void> {
    // Start game logic
  }
}
```

## Dependencies

- **three** ^0.180.0
- **@dimforge/rapier3d** ^0.11.2
- **venus-sdk** (tarball dependency)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Lint
npm run lint
```

## License

See LICENSE file in root repository.

