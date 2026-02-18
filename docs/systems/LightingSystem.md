# LightingSystem

Lighting components for Three.js scenes with directional and ambient lights.

## Quick Start

```typescript
import { DirectionalLightComponentThree, AmbientLightComponentThree } from "@series-inc/rundot-3d-engine/systems"
import * as THREE from "three"

// Add directional light (sun)
const sunLight = new GameObject("Sun")
sunLight.addComponent(new DirectionalLightComponentThree(
    0xffffff,  // Color
    1.0        // Intensity
))
sunLight.position.set(10, 20, 10)

// Add ambient light (fill light)
const ambient = new GameObject("Ambient")
ambient.addComponent(new AmbientLightComponentThree(
    0x404040,  // Color
    0.5        // Intensity
))
```

## Common Use Cases

### Basic Scene Lighting

```typescript
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        // Sun light
        const sun = new GameObject("Sun")
        const sunLight = new DirectionalLightComponentThree(0xffffff, 1.5)
        sun.addComponent(sunLight)
        sun.position.set(10, 20, 5)
        sun.lookAt(0, 0, 0)
        
        // Ambient fill
        const ambient = new GameObject("Ambient")
        ambient.addComponent(new AmbientLightComponentThree(0x404040, 0.4))
    }
}
```

### Shadows

```typescript
// Enable shadows in VenusGame config
protected getConfig(): VenusGameConfig {
    return {
        shadowMapEnabled: true,
        shadowMapType: "vsm"
    }
}

// Directional lights cast shadows automatically
// Configure shadow camera for better quality
const sunLight = sun.getComponent(DirectionalLightComponentThree)
if (sunLight) {
    const light = sunLight.getLight()
    light.shadow.camera.left = -50
    light.shadow.camera.right = 50
    light.shadow.camera.top = 50
    light.shadow.camera.bottom = -50
    light.shadow.camera.far = 100
}
```

## API Overview

### DirectionalLightComponentThree
- `new DirectionalLightComponentThree(color, intensity)` - Create directional light
- `getLight(): THREE.DirectionalLight` - Get Three.js light
- `setIntensity(intensity)` - Change brightness
- `setColor(color)` - Change color

### AmbientLightComponentThree
- `new AmbientLightComponentThree(color, intensity)` - Create ambient light
- `getLight(): THREE.AmbientLight` - Get Three.js light

## Light Types

### Directional Light
- Simulates sun/moon
- Parallel rays
- Casts shadows
- Position determines direction

### Ambient Light
- Uniform lighting from all directions
- No shadows
- Fill light to prevent pure black

## Related Systems

- [VenusGame](../core/VenusGame.md) - Shadow configuration
- [GameObject](../core/GameObject.md) - Attach lights to objects

