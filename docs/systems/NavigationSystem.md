# Navigation System

Grid-based 2D navigation with A* pathfinding, obstacle management, and AI agent movement.

## Quick Start

```typescript
import { DynamicNavSystem, NavAgent } from "@series-inc/rundot-3d-engine/systems"
import * as THREE from "three"

// Initialize the navigation system
DynamicNavSystem.initialize(
  scene,  // THREE.Scene (optional, for debug visualization)
  200,    // World width
  200,    // World depth
  2,      // Grid cell size
)

// Add obstacles
DynamicNavSystem.addBoxObstacle(10, 10, 4, 4)

// Check walkability
const canWalk = DynamicNavSystem.isWalkable(5, 5)

// Find a path
const result = DynamicNavSystem.findPath(
  new THREE.Vector2(0, 0),
  new THREE.Vector2(20, 20),
)
if (result.success) {
  console.log(`Path found: ${result.waypoints.length} waypoints, distance: ${result.distance}`)
}
```

## AI Agent Movement

The `NavAgent` component provides automatic pathfinding and movement for GameObjects.

```typescript
import { NavAgent } from "@series-inc/rundot-3d-engine/systems"

class Enemy extends Component {
  private navAgent?: NavAgent

  protected onCreate(): void {
    this.navAgent = new NavAgent()
    this.navAgent.moveSpeed = 3.0
    this.navAgent.arrivalDistance = 0.5
    this.gameObject.addComponent(this.navAgent)
  }

  public update(deltaTime: number): void {
    if (this.navAgent?.hasReachedTarget()) {
      this.navAgent.moveTo(this.getNextPatrolPoint())
    }

    // Use normalized speed for animation blending
    const speedNorm = this.navAgent?.getMovementSpeedNormalized() ?? 0
    this.animator?.setBlendWeight("walk", speedNorm)
  }
}
```

### NavAgent Properties

- `moveSpeed: number` — movement speed (default: 5.0)
- `acceleration: number` — movement acceleration (default: 15.0)
- `deceleration: number` — movement deceleration (default: 10.0)
- `arrivalDistance: number` — distance threshold for waypoint arrival (default: 0.5)
- `angularAcceleration: number` — rotation speed (default: 8.0)

### NavAgent Methods

- `moveTo(target: THREE.Vector3 | THREE.Vector2): boolean` — move to target using pathfinding (returns `true` if path found)
- `stop(): void` — stop current movement
- `hasReachedTarget(): boolean` — check if agent has reached its target
- `isInMotion(): boolean` — check if agent is currently moving
- `getMovementSpeedNormalized(): number` — get speed as 0–1 (for animation blending)
- `getMovementSpeed(): number` — get current speed in units/second
- `getCurrentSpeed(): number` — alias for `getMovementSpeed()`
- `getWaypoints(): THREE.Vector3[]` — get current waypoints (copy)
- `setVisualizationEnabled(enabled: boolean): void` — enable/disable path visualization

## Obstacle Management

### Box Obstacles

```typescript
// Add a box obstacle (center position + size)
DynamicNavSystem.addBoxObstacle(x, z, width, depth)

// Remove a box obstacle
DynamicNavSystem.removeBoxObstacle(x, z, width, depth)

// Add from a GameObject with RigidBody
DynamicNavSystem.addBoxObstacleFromRigidBody(gameObject)

// Add from bounds
DynamicNavSystem.addBoxObstacleFromBounds(gameObject, boundsSize)
```

### Rotated Obstacles

```typescript
// Add a rotated box obstacle (returns ID for later removal)
const id = DynamicNavSystem.addRotatedBoxObstacle(gameObject, boundsSize)

// Remove by ID
DynamicNavSystem.removeObstacleById(id)

// Remove by GameObject
DynamicNavSystem.removeObstacleByGameObject(gameObject)
```

### Raw Footprint API

```typescript
import { NavigationGrid, Footprint } from "@series-inc/rundot-3d-engine/systems"

// Polygon footprint
const footprint: Footprint = {
  type: "polygon",
  vertices: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 0, 0), new THREE.Vector3(4, 0, 4)],
}
DynamicNavSystem.addObstacle(footprint)

// Circle footprint
const circle: Footprint = {
  type: "circle",
  x: 10,
  z: 10,
  radius: 3,
}
DynamicNavSystem.addObstacle(circle)
```

## Pathfinding

```typescript
// Find a path (accepts Vector2 or Vector3)
const result = DynamicNavSystem.findPath(startPos, endPos)

// Result:
// {
//   success: boolean,
//   waypoints: Waypoint[],  // { x, z } objects
//   distance: number,
// }

// Quick reachability check (faster than full pathfinding)
const reachable = DynamicNavSystem.canReach(startX, startZ, endX, endZ)
```

## Debug Visualization

```typescript
// Print grid state to console
DynamicNavSystem.debugNavigation()
```

### Path Visualization

```typescript
import { PathVisualizationThree } from "@series-inc/rundot-3d-engine/systems"

// Initialize
PathVisualizationThree.initialize(scene)

// Visualize a path
PathVisualizationThree.addPath("myPath", pathResult)

// Remove a specific path
PathVisualizationThree.removePath("myPath")

// Toggle all visualization
PathVisualizationThree.setVisualizationEnabled(true)

// Query
PathVisualizationThree.getActivePathIds()
PathVisualizationThree.hasActiveVisualization()

// Clear all
PathVisualizationThree.clearVisualization()
PathVisualizationThree.dispose()
```

## API Reference

### DynamicNavSystem (Static Class)

#### Initialization

- `initialize(scene?, worldWidth?, worldDepth?, gridSize?): void` — initialize the system
- `getIsInitialized(): boolean` — check if initialized
- `dispose(): void` — clean up

#### Obstacle Management

- `addObstacle(footprint: Footprint): void` — add a raw footprint obstacle
- `removeObstacle(footprint: Footprint): void` — remove a raw footprint obstacle
- `addBoxObstacle(x, z, width, depth): void` — add a box obstacle
- `removeBoxObstacle(x, z, width, depth): void` — remove a box obstacle
- `addBoxObstacleFromRigidBody(gameObject): void` — add obstacle from RigidBody
- `addBoxObstacleFromBounds(gameObject, boundsSize): void` — add obstacle from bounds
- `addRotatedBoxObstacle(gameObject, boundsSize): string` — add rotated obstacle (returns ID)
- `removeObstacleById(id): boolean` — remove by ID
- `removeObstacleByGameObject(gameObject): boolean` — remove by GameObject

#### Queries

- `isWalkable(x, z): boolean` — check if a position is walkable
- `worldToGrid(x, z): { col, row } | null` — convert world to grid coords
- `gridToWorld(col, row): { x, z } | null` — convert grid to world coords
- `findPath(startPos, endPos): PathfindingResult` — A* pathfinding
- `canReach(startX, startZ, endX, endZ): boolean` — quick reachability check

#### Debug

- `debugNavigation(): void` — print navigation state

### NavigationGrid

- `constructor(worldWidth, worldDepth, gridSize)` — create a grid
- `worldToGrid(x, z): { col, row }` — convert coordinates
- `gridToWorld(col, row): { x, z }` — convert coordinates
- `addObstacle(footprint): void` — add obstacle with reference counting
- `removeObstacle(footprint): void` — remove obstacle
- `isWalkable(col, row): boolean` — check cell walkability
- `getDimensions(): { cols, rows, worldWidth, worldDepth, gridSize }` — get grid info
- `getGridData(): number[][]` — get raw grid data
- `printGrid(): void` — debug print
- `static setDebugMode(enabled): void` — toggle debug logging
- `static isDebugMode(): boolean` — check debug mode

### Interfaces

```typescript
interface Footprint {
  type: "polygon" | "circle"
  vertices?: Vector3[]   // For polygon
  x?: number             // For circle
  z?: number             // For circle
  radius?: number        // For circle
}

interface Waypoint {
  x: number
  z: number
}

interface PathfindingResult {
  success: boolean
  waypoints: Waypoint[]
  distance: number
}
```

## Performance

- **Obstacle add/remove:** O(footprint_area / cell_size²)
- **Walkability check:** O(1)
- **Pathfinding:** A* with 8-directional movement, line-of-sight optimization

## Configuration

- **Smaller cells (0.5–1.0):** Higher precision, more memory
- **Medium cells (1.0–2.0):** Good balance for most games
- **Larger cells (2.0–5.0):** Lower precision, less memory, faster updates

## Related Systems

- [PhysicsSystem](../physics/PhysicsSystem.md) - RigidBody-based obstacle detection
- [Component](../core/Component.md) - NavAgent is a component
- [GameObject](../core/GameObject.md) - Obstacle and agent GameObjects
