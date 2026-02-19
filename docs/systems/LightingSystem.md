# LightingSystem

Lighting components for Three.js scenes with directional and ambient/hemisphere lights.

## Quick Start

```typescript
import { DirectionalLightComponent, AmbientLightComponent } from "@series-inc/rundot-3d-engine/systems"

// Add directional light (sun)
const sunLight = new GameObject("Sun")
sunLight.addComponent(new DirectionalLightComponent({
  color: 0xffffff,
  intensity: 1.0,
  castShadow: true,
}))

// Add ambient light (fill light)
const ambient = new GameObject("Ambient")
ambient.addComponent(new AmbientLightComponent({
  color: 0x404040,
  intensity: 0.5,
}))
```

## Common Use Cases

### Basic Scene Lighting

```typescript
class MyGame extends VenusGame {
  protected async onStart(): Promise<void> {
    // Sun light with shadows
    const sun = new GameObject("Sun")
    sun.addComponent(new DirectionalLightComponent({
      color: 0xffffff,
      intensity: 1.5,
      castShadow: true,
      shadowMapSize: 2048,
      shadowCamera: {
        left: -50, right: 50,
        top: 50, bottom: -50,
        near: 0.5, far: 100,
      },
    }))

    // Position and aim
    const light = sun.getComponent(DirectionalLightComponent)
    light?.setPosition(10, 20, 5)
    light?.setTarget(0, 0, 0)

    // Ambient fill
    const ambient = new GameObject("Ambient")
    ambient.addComponent(new AmbientLightComponent({
      color: 0x404040,
      intensity: 0.4,
    }))
  }
}
```

### Hemisphere Light (Sky + Ground)

```typescript
// Providing groundColor enables hemisphere lighting mode
const hemiLight = new GameObject("HemiLight")
hemiLight.addComponent(new AmbientLightComponent({
  color: 0x87CEEB,          // Sky color
  groundColor: 0x8B4513,    // Ground color
  intensity: 0.6,
}))
```

### Shadows

```typescript
// Enable shadows in VenusGame config
protected getConfig(): VenusGameConfig {
  return {
    shadowMapEnabled: true,
    shadowMapType: "vsm",
  }
}

// DirectionalLightComponent casts shadows via options
const sun = new DirectionalLightComponent({
  castShadow: true,
  shadowMapSize: 2048,
  shadowCamera: {
    left: -50, right: 50,
    top: 50, bottom: -50,
    far: 100,
  },
})
```

## API Reference

### DirectionalLightComponent

#### Constructor

```typescript
new DirectionalLightComponent(options?: {
  color?: THREE.ColorRepresentation     // Default: white
  intensity?: number                     // Default: 1
  castShadow?: boolean                   // Default: false
  shadowMapSize?: number                 // Shadow map resolution
  shadowCamera?: {
    left?: number
    right?: number
    top?: number
    bottom?: number
    near?: number
    far?: number
  }
})
```

#### Methods

- `getLight(): THREE.DirectionalLight` — get the Three.js light for direct access
- `setPosition(x, y, z): void` — set light position
- `setTarget(x, y, z): void` — set light target position
- `setIntensity(intensity): void` — set light intensity
- `setColor(color): void` — set light color
- `setCastShadow(enabled): void` — enable/disable shadow casting

### AmbientLightComponent

#### Constructor

```typescript
new AmbientLightComponent(options?: {
  color?: THREE.ColorRepresentation        // Sky/main color
  intensity?: number                        // Default: 1
  groundColor?: THREE.ColorRepresentation   // If set, uses HemisphereLight
  direction?: THREE.Vector3                 // Hemisphere light direction
})
```

If `groundColor` is provided, creates a `THREE.HemisphereLight` (sky + ground colors). Otherwise creates a `THREE.AmbientLight`.

#### Methods

- `getLight(): THREE.Light` — get the Three.js light (AmbientLight or HemisphereLight)
- `setIntensity(intensity): void` — set light intensity
- `setColor(color): void` — set sky/main color
- `setGroundColor(color): void` — set ground color (hemisphere mode only)

## Light Types

### Directional Light
- Simulates sun/moon with parallel rays
- Casts shadows
- Position determines direction

### Ambient Light
- Uniform lighting from all directions
- No shadows
- Fill light to prevent pure black

### Hemisphere Light
- Two-color lighting (sky + ground)
- More natural outdoor lighting than plain ambient
- Enabled by providing `groundColor` option

## Related Systems

- [VenusGame](../core/VenusGame.md) - Shadow configuration
- [GameObject](../core/GameObject.md) - Attach lights to objects
