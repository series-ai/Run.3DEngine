# Spline System

A flexible spline system for creating smooth curves through waypoints with debug visualization.

## Quick Start

```typescript
import { SplineThree, SplineTypeThree } from "@series-inc/rundot-3d-engine/systems"
import * as THREE from "three"

// Create a spline
const spline = new SplineThree({
  type: SplineTypeThree.CATMULL_ROM,
  resolution: 10,
  tension: 0.5,
  closed: false,
})

// Set waypoints
spline.setWaypoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(10, 0, 5),
  new THREE.Vector3(20, 0, 0),
  new THREE.Vector3(30, 0, -10),
])

// Get positions along the spline
const startPos = spline.getPointAt(0)    // t = 0 (start)
const midPos = spline.getPointAt(0.5)    // t = 0.5 (middle)
const endPos = spline.getPointAt(1)      // t = 1 (end)

// Get direction at a point
const direction = spline.getDirectionAt(0.5)

// Position and rotate a GameObject on the spline
spline.setGameObjectAt(myGameObject, 0.5)
```

## Spline Types

### Linear

Simple linear interpolation between waypoints.

```typescript
const spline = new SplineThree({
  type: SplineTypeThree.LINEAR,
  resolution: 5,
})
```

### Catmull-Rom

Smooth curves that pass through all waypoints. Recommended for most use cases.

```typescript
const spline = new SplineThree({
  type: SplineTypeThree.CATMULL_ROM,
  resolution: 10,
  tension: 0.5, // 0 = loose curves, 1 = tight curves
})
```

### Bezier

Cubic Bezier curves with automatic control point generation.

```typescript
const spline = new SplineThree({
  type: SplineTypeThree.BEZIER,
  resolution: 12,
})
```

## Debug Visualization

### Per-Spline Debug

```typescript
// Enable debug on a spline
spline.enableDebug({
  showWaypoints: true,
  showCurve: true,
  showDirection: true,
  waypointColor: new THREE.Color(0xff0000),
  curveColor: new THREE.Color(0x0000ff),
})

// Disable
spline.disableDebug()

// Check state
spline.isDebugEnabled()
```

### SplineDebugRendererThree Component

A component for attaching debug visualization to a GameObject.

```typescript
import { SplineDebugRendererThree } from "@series-inc/rundot-3d-engine/systems"

const debugRenderer = new SplineDebugRendererThree(spline, {
  showWaypoints: true,
  showCurve: true,
  showDirection: true,
  waypointSize: 0.5,
  waypointColor: new THREE.Color(0xff0000),
  curveColor: new THREE.Color(0x0000ff),
  directionColor: new THREE.Color(0x00ff00),
  directionLength: 1.0,
  directionSpacing: 2.0,
})

const debugObject = new GameObject("SplineDebug")
debugObject.addComponent(debugRenderer)
```

#### Methods

- `refresh(): void` — manually refresh visualization
- `setShowWaypoints(show: boolean): void` — toggle waypoint display
- `setShowCurve(show: boolean): void` — toggle curve display
- `setShowDirection(show: boolean): void` — toggle direction arrows

### SplineDebugManager (Singleton)

Global manager for debug visualization across all splines.

```typescript
import { SplineDebugManager } from "@series-inc/rundot-3d-engine/systems"

const manager = SplineDebugManager.getInstance()

// Register splines for global debug
manager.registerSpline(spline, { showCurve: true })
manager.unregisterSpline(spline)

// Toggle all debug at once
manager.setDebugEnabled(true)
manager.isDebugEnabled()

// Configure defaults
manager.setDefaultConfig({ showWaypoints: true, showCurve: true })

// Query
manager.getRegisteredCount()

// Clear all
manager.clear()
```

## API Reference

### SplineThree

#### Constructor

```typescript
new SplineThree(config?: SplineConfigThree)
```

Default config:
```typescript
{
  type: SplineTypeThree.CATMULL_ROM,
  resolution: 10,
  tension: 0.5,
  closed: false,
}
```

#### Waypoint Management

- `setWaypoints(waypoints: THREE.Vector3[]): void` — set all waypoints
- `getWaypoints(): THREE.Vector3[]` — get all waypoints

#### Point Sampling

- `getPointAt(t: number): THREE.Vector3` — get position at parameter t (0–1)
- `getDirectionAt(t: number): THREE.Vector3` — get direction (tangent) at parameter t
- `getPointAtDistance(distance: number): THREE.Vector3` — get position at a specific distance
- `getDirectionAtDistance(distance: number): THREE.Vector3` — get direction at a specific distance

#### Query Methods

- `getClosestPoint(position: THREE.Vector3): { point, t, distance }` — find closest point on spline
- `getTotalLength(): number` — get total spline length
- `getInterpolatedPoints(): THREE.Vector3[]` — get all interpolated points
- `getSegments(): SplineSegmentThree[]` — get segment data

#### GameObject Positioning

- `setGameObjectAt(gameObject: any, t: number): void` — position and rotate a GameObject on the spline

#### Debug

- `enableDebug(config?: SplineDebugConfig): void` — enable debug visualization
- `disableDebug(): void` — disable debug visualization
- `isDebugEnabled(): boolean` — check debug state
- `getDebugConfig(): SplineDebugConfig | undefined` — get current debug config

#### Cleanup

- `dispose(): void` — clean up resources

### SplineTypeThree Enum

```typescript
enum SplineTypeThree {
  LINEAR = "linear",
  CATMULL_ROM = "catmull_rom",
  BEZIER = "bezier",
}
```

### Interfaces

```typescript
interface SplineConfigThree {
  type: SplineTypeThree
  resolution: number
  tension?: number     // For Catmull-Rom (0–1)
  closed?: boolean     // Closed loop
}

interface SplinePointThree {
  position: THREE.Vector3
  index: number
}

interface SplineSegmentThree {
  startPoint: SplinePointThree
  endPoint: SplinePointThree
  length: number
}

interface SplineDebugOptionsThree {
  showWaypoints?: boolean
  showCurve?: boolean
  showDirection?: boolean
  waypointSize?: number
  waypointColor?: THREE.Color
  curveColor?: THREE.Color
  directionColor?: THREE.Color
  directionLength?: number
  directionSpacing?: number
}

interface SplineDebugConfig {
  showWaypoints?: boolean
  showCurve?: boolean
  showDirection?: boolean
  waypointSize?: number
  waypointColor?: THREE.Color
  curveColor?: THREE.Color
}
```

## Performance Notes

- Splines are regenerated when waypoints change
- Debug visualization creates mesh instances — disable when not needed
- Higher resolution values create smoother curves but use more memory
- Catmull-Rom splines are recommended for most use cases

## Related Systems

- [Component](../core/Component.md) - SplineDebugRendererThree is a component
- [GameObject](../core/GameObject.md) - Position GameObjects on splines
