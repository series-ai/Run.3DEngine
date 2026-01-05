# Spline System

A flexible spline system for creating smooth curves through waypoints with debug visualization capabilities.

## Features

- **Multiple interpolation types**: Linear, Catmull-Rom, and Bézier curves
- **Debug visualization**: Show waypoints, curves, and direction arrows
- **Dynamic configuration**: Change spline properties at runtime
- **Comprehensive API**: Get positions, directions, closest points, and more
- **Performance optimized**: Efficient interpolation and caching

## Quick Start

```typescript
import { SplineSystem, SplineType, SplineDebugRenderer } from "@/systems/spline"
import { Vector3, Color3 } from "@babylonjs/core"

// Create a spline system
const spline = new SplineSystem({
  type: SplineType.CATMULL_ROM,
  resolution: 10,
  tension: 0.5,
  closed: false,
})

// Set waypoints
const waypoints = [
  new Vector3(0, 0, 0),
  new Vector3(10, 0, 5),
  new Vector3(20, 0, 0),
  new Vector3(30, 0, -10),
]
spline.setWaypoints(waypoints)

// Get positions along the spline
const startPos = spline.getPointAt(0) // t = 0 (start)
const midPos = spline.getPointAt(0.5) // t = 0.5 (middle)
const endPos = spline.getPointAt(1) // t = 1 (end)

// Get directions (tangents)
const direction = spline.getDirectionAt(0.5)

// Position GameObject directly on spline (includes rotation)
spline.positionGameObjectAt(myGameObject, 0.5)
```

## Debug Visualization

```typescript
// Create debug renderer
const debugRenderer = new SplineDebugRenderer(spline, {
  showWaypoints: true,
  showCurve: true,
  showDirection: true,
  waypointColor: Color3.Red(),
  curveColor: Color3.Blue(),
  directionColor: Color3.Green(),
})

// Add to a GameObject
const debugObject = new GameObject("SplineDebug")
debugObject.addComponent(debugRenderer)
```

## Spline Types

### Linear

Simple linear interpolation between waypoints.

```typescript
const config = {
  type: SplineType.LINEAR,
  resolution: 5,
}
```

### Catmull-Rom

Smooth curves that pass through all waypoints.

```typescript
const config = {
  type: SplineType.CATMULL_ROM,
  resolution: 10,
  tension: 0.5, // 0 = loose curves, 1 = tight curves
}
```

### Bézier

Cubic Bézier curves with automatic control point generation.

```typescript
const config = {
  type: SplineType.BEZIER,
  resolution: 12,
}
```

## API Reference

### SplineSystem

#### Methods

- `setWaypoints(waypoints: Vector3[])` - Set the waypoints for the spline
- `addWaypoint(point: Vector3)` - Add a waypoint to the end
- `insertWaypoint(index: number, point: Vector3)` - Insert waypoint at index
- `removeWaypoint(index: number)` - Remove waypoint by index
- `updateWaypoint(index: number, newPosition: Vector3)` - Update waypoint position

- `getPointAt(t: number): Vector3` - Get position at parameter t (0-1)
- `getPointAtDistance(distance: number): Vector3` - Get position at specific distance
- `getDirectionAt(t: number): Vector3` - Get direction (tangent) at parameter t
- `getClosestPoint(position: Vector3)` - Find closest point on spline

- `getWaypoints(): Vector3[]` - Get all waypoints
- `getInterpolatedPoints(): Vector3[]` - Get all interpolated points
- `getTotalLength(): number` - Get total spline length

- `updateConfig(newConfig: Partial<SplineConfig>)` - Update configuration

#### GameObject Utilities

- `positionGameObjectAt(gameObject: any, t: number)` - Position and rotate GameObject on spline
- `setGameObjectPositionAt(gameObject: any, t: number)` - Set GameObject position only
- `setGameObjectRotationAt(gameObject: any, t: number)` - Set GameObject rotation only

These methods work with any object that has a `position` property and `lookAt` method (like BabylonJS GameObjects).

### SplineDebugRenderer

#### Methods

- `setSplineSystem(splineSystem: SplineSystem)` - Set spline to visualize
- `updateOptions(options: Partial<SplineDebugOptions>)` - Update visualization options
- `setVisible(visible: boolean)` - Show/hide visualization
- `refresh()` - Manually refresh visualization

#### Debug Options

```typescript
interface SplineDebugOptions {
  showWaypoints?: boolean // Show waypoint spheres
  showCurve?: boolean // Show interpolated curve
  showDirection?: boolean // Show direction arrows
  waypointSize?: number // Size of waypoint spheres
  waypointColor?: Color3 // Color of waypoints
  curveColor?: Color3 // Color of curve lines
  directionColor?: Color3 // Color of direction arrows
  directionLength?: number // Length of direction arrows
  directionSampleRate?: number // How often to show arrows (0-1)
}
```

## DriveThruSpline Integration

The `DriveThruSpline` has been updated to use this spline system:

```typescript
import { DriveThruSpline } from "./DriveThruSpline"
import { SplineDebugRenderer } from "@/systems/spline"

// Initialize the drive-thru spline
DriveThruSpline.initialize()

// Enable debug visualization
const debugRenderer = new SplineDebugRenderer()
DriveThruSpline.enableDebugVisualization(debugRenderer)

// Use new spline features
const position = DriveThruSpline.getPositionAt(0.5)
const direction = DriveThruSpline.getDirectionAt(0.5)
const totalLength = DriveThruSpline.getTotalLength()

// Change spline configuration
DriveThruSpline.updateSplineConfig({
  type: SplineType.LINEAR,
  resolution: 8,
})
```

## Example

See `SplineDebugExample.ts` for a complete example demonstrating all features of the spline system.

## Performance Notes

- Splines are regenerated when waypoints or configuration changes
- Debug visualization creates mesh instances - disable when not needed
- Higher resolution values create smoother curves but use more memory
- Catmull-Rom splines are recommended for most use cases
