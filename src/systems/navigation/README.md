# Dynamic Navigation System

A fast 2D grid-based navigation system with reference counting for efficient obstacle management using static methods.

## Features

- **Fast Obstacle Addition/Removal**: Uses reference counting, no need to regenerate the entire navmesh
- **3D to 2D Projection**: Handles 3D rotated objects by projecting them to 2D footprints on the XZ plane
- **Component-Based**: Integrates seamlessly with the GameObject/Component system
- **Memory Efficient**: Grid-based approach with minimal memory overhead
- **Static API**: Clean static methods, no getInstance() calls needed
- **Unity-like Debug Drawing**: Visual debug lines using Babylon.js UtilityLayerRenderer (similar to Unity's Debug.Draw)

## Quick Start

### 1. Initialize the Navigation System

```typescript
import { DynamicNavSystem } from "./systems/DynamicNav"

// Initialize in your main game setup
DynamicNavSystem.initialize(
  scene, // Babylon.js Scene
  200, // World width
  200, // World depth
  2, // Grid cell size (smaller = higher precision, more memory)
)
```

### 2. Add Navigation Obstacles

```typescript
import { NavObstacleComponent, NavObstacleOptions } from "./systems/DynamicNav"

// Any GameObject can become a navigation obstacle
const obstacle = new GameObject("Wall")
obstacle.position = new Vector3(10, 0, 10)
obstacle.scaling = new Vector3(4, 2, 4) // 4x4 footprint

// Option 1: Basic usage (uses GameObject bounds)
obstacle.addComponent(new NavObstacleComponent())

// Option 2: With specific mesh data
const renderer = obstacle.getComponent(ObjRenderer)
const options: NavObstacleOptions = {
  mesh: renderer?.getMesh(),
}
obstacle.addComponent(new NavObstacleComponent(options))

// Option 3: With manual bounds specification
obstacle.addComponent(
  new NavObstacleComponent({
    bounds: { width: 4, height: 2, depth: 4 },
  }),
)

// Option 4: With custom position/rotation overrides
obstacle.addComponent(
  new NavObstacleComponent({
    position: new Vector3(10, 0, 10),
    rotation: new Vector3(0, Math.PI / 4, 0),
    bounds: { width: 4, height: 2, depth: 4 },
  }),
)
```

### 3. Check Walkability

```typescript
// Check if a world position is walkable
const canWalk = DynamicNavSystem.isWalkable(worldX, worldZ)

// Convert between world and grid coordinates
const gridPos = DynamicNavSystem.worldToGrid(worldX, worldZ)
const worldPos = DynamicNavSystem.gridToWorld(gridCol, gridRow)
```

### 4. Dynamic Obstacles

```typescript
// Obstacles are automatically removed when:
// 1. The GameObject is disposed
obstacle.dispose()

// 2. The NavObstacleComponent is removed
obstacle.removeComponent(NavObstacleComponent)

// 3. The GameObject is disabled
obstacle.setEnabled(false)

// If an obstacle moves or rotates, update its footprint:
const navObstacle = obstacle.getComponent(NavObstacleComponent)
navObstacle.updateFootprint()
```

### 5. Debug Visualization (Unity-like Debug.Draw)

```typescript
// Create debug visualization using line drawing (like Unity's Debug.DrawLine)
DynamicNavSystem.createDebugVisualization()

// Toggle debug visualization on/off
DynamicNavSystem.toggleDebugVisualization()

// Clear debug visualization
DynamicNavSystem.clearDebugVisualization()

// Check if debug is currently visible
const isVisible = DynamicNavSystem.isDebugVisualizationVisible()

// Also available via console (for backwards compatibility)
DynamicNavSystem.debugPrintGrid()
```

**Debug Panel Integration**: The debug visualization is also available in the game's debug panel (press ` to open) under "Dynamic Nav Debug".

**Debug Drawing Features**:

- **Grid Lines**: Gray wireframe showing the navigation grid structure
- **Blocked Cells**: Red squares with X marks showing obstacle locations
- **UtilityLayerRenderer**: Uses Babylon.js's debug overlay system (like Unity's Debug.Draw)
- **Non-intrusive**: Debug lines don't interfere with main scene rendering
- **Real-time Updates**: Visualization updates as obstacles are added/removed

## Integration Example

```typescript
// In your main game initialization:
import { DynamicNavDemo } from "./systems/DynamicNav"

export class MyGame extends VenusGame {
  protected async onStart(): Promise<void> {
    // Initialize dynamic navigation
    await DynamicNavDemo.setupDynamicNavigation(this.scene)

    // Test the system
    DynamicNavDemo.testWalkability()

    // Your existing game setup...
  }

  protected async onDispose(): Promise<void> {
    // Clean up navigation system
    DynamicNavDemo.cleanup()
  }
}
```

## Architecture

### NavigationGrid

- Core grid logic with reference counting
- Handles 2D footprint calculations
- Point-in-polygon and point-in-circle tests

### DynamicNavSystem

- Static class that manages the NavigationGrid
- Provides high-level API for the game
- Handles initialization and cleanup
- **All static methods** - no getInstance() needed!
- **Debug Drawing**: Unity-like line visualization using UtilityLayerRenderer

### NavObstacleComponent

- Component that automatically registers GameObjects as obstacles
- Generates 2D footprints from 3D bounding boxes or provided data
- Handles rotated objects correctly
- Automatically manages registration/unregistration
- **Flexible Configuration**: Accepts mesh, bounds, position, and rotation overrides
- **Decoupled Design**: No direct dependency on specific renderer components

#### NavObstacleOptions Interface

```typescript
interface NavObstacleOptions {
  mesh?: AbstractMesh // Override mesh for bounds calculation
  rotation?: Vector3 | Quaternion // Override rotation
  position?: Vector3 // Override position
  bounds?: {
    // Manual bounds specification
    width: number
    height: number
    depth: number
  }
}
```

## Performance Characteristics

- **Obstacle Addition**: O(footprint_area / grid_cell_size²)
- **Obstacle Removal**: O(footprint_area / grid_cell_size²)
- **Walkability Check**: O(1)
- **Memory Usage**: O(grid_width × grid_height × 4 bytes)
- **Debug Drawing**: Minimal performance impact using UtilityLayerRenderer

## Static API Benefits

```typescript
// Old way (CustomNavigationSystem):
const navSystem = CustomNavigationSystem.getInstance()
const walkable = navSystem.isWalkable(x, z)

// New way (DynamicNavSystem):
const walkable = DynamicNavSystem.isWalkable(x, z)
```

- **Cleaner code**: No getInstance() calls
- **Less verbose**: Direct static method access
- **Better performance**: No instance lookups
- **Simpler API**: Just call `DynamicNavSystem.method()`

## Debug Drawing vs Unity Comparison

| Unity Debug.Draw       | Babylon.js DynamicNavSystem                           |
| ---------------------- | ----------------------------------------------------- |
| `Debug.DrawLine()`     | `MeshBuilder.CreateLines()` with UtilityLayerRenderer |
| `Debug.DrawWireCube()` | Custom line drawing for cell squares                  |
| Scene view only        | UtilityLayerRenderer overlay                          |
| Gizmos drawer          | Debug panel integration                               |

## Configuration

### Grid Size Selection

- **Smaller cells (0.5-1.0)**: Higher precision, more memory, slower obstacle updates
- **Medium cells (1.0-2.0)**: Good balance for most games
- **Larger cells (2.0-5.0)**: Lower precision, less memory, faster obstacle updates

### World Size

- Should match your game world bounds
- Can be larger than needed with minimal memory impact
- Positions outside bounds are automatically treated as non-walkable

## Future Extensions

This system is designed to be extensible:

- **A\* Pathfinding**: Add pathfinding algorithms on top of the grid
- **Multi-Layer Navigation**: Support for different agent sizes
- **Dynamic Grid Resizing**: Expand grid as world grows
- **Hierarchical Pathfinding**: For large worlds
- **Navigation Mesh**: Upgrade to proper navmesh with polygonal regions
- **Advanced Debug Tools**: 3D height visualization, pathfinding visualization
