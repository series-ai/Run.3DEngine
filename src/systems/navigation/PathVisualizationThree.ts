import * as THREE from "three"
import {
  DynamicNavSystem,
  Waypoint,
  PathfindingResult,
} from "./DynamicNavSystem"

/**
 * Three.js visualization system for pathfinding results
 * Shows waypoints as spheres and paths as lines for debugging
 */
export class PathVisualizationThree {
  private static scene: THREE.Scene | null = null
  private static isInitialized: boolean = false

  // Global control for path visualization
  private static visualizationEnabled: boolean = false

  // Materials
  private static pathMaterial: THREE.LineBasicMaterial | null = null
  private static waypointMaterial: THREE.MeshBasicMaterial | null = null
  private static startMaterial: THREE.MeshBasicMaterial | null = null
  private static endMaterial: THREE.MeshBasicMaterial | null = null

  // Multiple path support
  private static pathVisualizations: Map<
    string,
    {
      pathLines: THREE.Line[]
      waypointSpheres: THREE.Mesh[]
      startMarker: THREE.Mesh | null
      endMarker: THREE.Mesh | null
    }
  > = new Map()

  // Legacy support
  private static currentPath: PathfindingResult | null = null

  /**
   * Initialize the path visualization system
   */
  public static initialize(scene: THREE.Scene): void {
    if (PathVisualizationThree.isInitialized) {
      return
    }

    PathVisualizationThree.scene = scene
    PathVisualizationThree.createMaterials()
    PathVisualizationThree.isInitialized = true

    // PathVisualizationThree initialized
  }

  /**
   * Create materials for different visual elements
   */
  private static createMaterials(): void {
    // Path line material (bright yellow)
    PathVisualizationThree.pathMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00, // Bright yellow
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    })

    // Waypoint sphere material (orange)
    PathVisualizationThree.waypointMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8000, // Orange
      transparent: true,
      opacity: 0.9,
    })

    // Start position material (green)
    PathVisualizationThree.startMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00, // Bright green
      transparent: true,
      opacity: 0.9,
    })

    // End position material (red)
    PathVisualizationThree.endMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Bright red
      transparent: true,
      opacity: 0.9,
    })
  }

  /**
   * Enable or disable path visualization globally
   */
  public static setVisualizationEnabled(enabled: boolean): void {
    PathVisualizationThree.visualizationEnabled = enabled

    if (!enabled) {
      // Clear all visualizations when disabled
      PathVisualizationThree.clearVisualization()
    }

    // Path visualization toggled
  }

  /**
   * Check if path visualization is globally enabled
   */
  public static isVisualizationEnabled(): boolean {
    return PathVisualizationThree.visualizationEnabled
  }

  /**
   * Add a path visualization with optional ID for later removal
   */
  public static addPath(
    pathId: string,
    result: PathfindingResult,
    startX?: number,
    startZ?: number,
    endX?: number,
    endZ?: number,
  ): boolean {
    if (
      !PathVisualizationThree.isInitialized ||
      !PathVisualizationThree.scene
    ) {
      console.warn("PathVisualizationThree not initialized")
      return false
    }

    if (!result.success || result.waypoints.length === 0) {
      // No path data to visualize
      return false
    }

    // Check if visualization is globally enabled
    if (!PathVisualizationThree.visualizationEnabled) {
      // Path visualization disabled
      return false
    }

    // Remove existing path with same ID if it exists
    PathVisualizationThree.removePath(pathId)

    console.log(
      `🛤️ Adding path visualization '${pathId}' with ${result.waypoints.length} waypoints, distance: ${result.distance.toFixed(1)}`,
    )

    const visualization = {
      pathLines: [] as THREE.Line[],
      waypointSpheres: [] as THREE.Mesh[],
      startMarker: null as THREE.Mesh | null,
      endMarker: null as THREE.Mesh | null,
    }

    // If start/end coordinates aren't provided, infer them from waypoints
    const inferredStartX = startX ?? result.waypoints[0]?.x
    const inferredStartZ = startZ ?? result.waypoints[0]?.z
    const inferredEndX =
      endX ?? result.waypoints[result.waypoints.length - 1]?.x
    const inferredEndZ =
      endZ ?? result.waypoints[result.waypoints.length - 1]?.z

    // Create start and end markers if positions are available
    if (inferredStartX !== undefined && inferredStartZ !== undefined) {
      visualization.startMarker = PathVisualizationThree.createStartMarker(
        pathId,
        inferredStartX,
        inferredStartZ,
      )
    }

    if (inferredEndX !== undefined && inferredEndZ !== undefined) {
      visualization.endMarker = PathVisualizationThree.createEndMarker(
        pathId,
        inferredEndX,
        inferredEndZ,
      )
    }

    // Create waypoint spheres
    visualization.waypointSpheres =
      PathVisualizationThree.createWaypointSpheres(pathId, result.waypoints)

    // Create path lines
    visualization.pathLines = PathVisualizationThree.createPathLines(
      pathId,
      result.waypoints,
    )

    // Store the visualization
    PathVisualizationThree.pathVisualizations.set(pathId, visualization)
    PathVisualizationThree.currentPath = result

    return true
  }

  /**
   * Add a path visualization (simplified API - infers start/end from waypoints)
   */
  public static addPathSimple(
    pathId: string,
    result: PathfindingResult,
  ): boolean {
    return PathVisualizationThree.addPath(pathId, result)
  }

  /**
   * Remove a specific path visualization by ID
   */
  public static removePath(pathId: string): boolean {
    const visualization = PathVisualizationThree.pathVisualizations.get(pathId)
    if (!visualization) {
      return false
    }

    // Remove from scene and dispose
    visualization.pathLines.forEach((line) => {
      PathVisualizationThree.scene?.remove(line)
      line.geometry.dispose()
    })
    visualization.waypointSpheres.forEach((sphere) => {
      PathVisualizationThree.scene?.remove(sphere)
      sphere.geometry.dispose()
    })
    if (visualization.startMarker) {
      PathVisualizationThree.scene?.remove(visualization.startMarker)
      visualization.startMarker.geometry.dispose()
    }
    if (visualization.endMarker) {
      PathVisualizationThree.scene?.remove(visualization.endMarker)
      visualization.endMarker.geometry.dispose()
    }

    // Remove from map
    PathVisualizationThree.pathVisualizations.delete(pathId)

    console.log(`🛤️ Removed path visualization '${pathId}'`)
    return true
  }

  /**
   * Visualize a pathfinding result (legacy method - uses default ID)
   */
  public static visualizePath(
    result: PathfindingResult,
    startX?: number,
    startZ?: number,
    endX?: number,
    endZ?: number,
  ): void {
    PathVisualizationThree.addPath(
      "default",
      result,
      startX,
      startZ,
      endX,
      endZ,
    )
  }

  /**
   * Create visual marker for start position
   */
  private static createStartMarker(
    pathId: string,
    x: number,
    z: number,
  ): THREE.Mesh | null {
    if (!PathVisualizationThree.scene || !PathVisualizationThree.startMaterial)
      return null

    const geometry = new THREE.SphereGeometry(0.5, 16, 16)
    const marker = new THREE.Mesh(
      geometry,
      PathVisualizationThree.startMaterial,
    )

    marker.position.set(x, 0.5, z)
    marker.name = `PathStartMarker_${pathId}`

    PathVisualizationThree.scene.add(marker)
    return marker
  }

  /**
   * Create visual marker for end position
   */
  private static createEndMarker(
    pathId: string,
    x: number,
    z: number,
  ): THREE.Mesh | null {
    if (!PathVisualizationThree.scene || !PathVisualizationThree.endMaterial)
      return null

    const geometry = new THREE.SphereGeometry(0.5, 16, 16)
    const marker = new THREE.Mesh(geometry, PathVisualizationThree.endMaterial)

    marker.position.set(x, 0.5, z)
    marker.name = `PathEndMarker_${pathId}`

    PathVisualizationThree.scene.add(marker)
    return marker
  }

  /**
   * Create spheres to mark waypoints along the path
   */
  private static createWaypointSpheres(
    pathId: string,
    waypoints: Waypoint[],
  ): THREE.Mesh[] {
    if (
      !PathVisualizationThree.scene ||
      !PathVisualizationThree.waypointMaterial
    )
      return []

    const spheres: THREE.Mesh[] = []

    waypoints.forEach((waypoint, index) => {
      const geometry = new THREE.SphereGeometry(0.3, 12, 12)
      const sphere = new THREE.Mesh(
        geometry,
        PathVisualizationThree.waypointMaterial!,
      )

      sphere.position.set(waypoint.x, 0.3, waypoint.z)
      sphere.name = `PathWaypoint_${pathId}_${index}`

      PathVisualizationThree.scene!.add(sphere)
      spheres.push(sphere)
    })

    return spheres
  }

  /**
   * Create lines connecting waypoints to show the path
   */
  private static createPathLines(
    pathId: string,
    waypoints: Waypoint[],
  ): THREE.Line[] {
    if (
      !PathVisualizationThree.scene ||
      !PathVisualizationThree.pathMaterial ||
      waypoints.length < 2
    )
      return []

    const lines: THREE.Line[] = []

    // Create lines between consecutive waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i]
      const end = waypoints[i + 1]

      const points = [
        new THREE.Vector3(start.x, 0.2, start.z),
        new THREE.Vector3(end.x, 0.2, end.z),
      ]

      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, PathVisualizationThree.pathMaterial)
      line.name = `PathLine_${pathId}_${i}`

      PathVisualizationThree.scene.add(line)
      lines.push(line)
    }

    return lines
  }

  /**
   * Clear all path visualizations
   */
  public static clearVisualization(): void {
    // Clear all paths
    const pathIds = Array.from(PathVisualizationThree.pathVisualizations.keys())
    pathIds.forEach((pathId) => PathVisualizationThree.removePath(pathId))

    PathVisualizationThree.currentPath = null
    // Path visualizations cleared
  }

  /**
   * Get list of active path IDs
   */
  public static getActivePathIds(): string[] {
    return Array.from(PathVisualizationThree.pathVisualizations.keys())
  }

  /**
   * Check if any path is currently being visualized
   */
  public static hasActiveVisualization(): boolean {
    return PathVisualizationThree.pathVisualizations.size > 0
  }

  /**
   * Get current path result (legacy support)
   */
  public static getCurrentPath(): PathfindingResult | null {
    return PathVisualizationThree.currentPath
  }

  /**
   * Console helper function for manual testing
   */
  public static testPath(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
  ): void {
    console.log(
      `🛤️ Testing path from (${startX}, ${startZ}) to (${endX}, ${endZ})`,
    )

    if (!DynamicNavSystem.getIsInitialized()) {
      console.warn("❌ DynamicNavSystem not initialized")
      return
    }

    PathVisualizationThree.initialize(PathVisualizationThree.scene!)

    const result = DynamicNavSystem.findPath(
      new THREE.Vector2(startX, startZ),
      new THREE.Vector2(endX, endZ),
    )

    if (result.success) {
      console.log(
        `✅ Path found! ${result.waypoints.length} waypoints, distance: ${result.distance.toFixed(1)} units`,
      )
      result.waypoints.forEach((waypoint, index) => {
        console.log(
          `   ${index + 1}. (${waypoint.x.toFixed(1)}, ${waypoint.z.toFixed(1)})`,
        )
      })
      PathVisualizationThree.visualizePath(result, startX, startZ, endX, endZ)
    } else {
      console.log("❌ No path found!")
      PathVisualizationThree.clearVisualization()
    }
  }

  /**
   * Dispose of the path visualization system
   */
  public static dispose(): void {
    if (PathVisualizationThree.isInitialized) {
      PathVisualizationThree.clearVisualization()

      // Dispose materials
      if (PathVisualizationThree.pathMaterial)
        PathVisualizationThree.pathMaterial.dispose()
      if (PathVisualizationThree.waypointMaterial)
        PathVisualizationThree.waypointMaterial.dispose()
      if (PathVisualizationThree.startMaterial)
        PathVisualizationThree.startMaterial.dispose()
      if (PathVisualizationThree.endMaterial)
        PathVisualizationThree.endMaterial.dispose()

      PathVisualizationThree.scene = null
      PathVisualizationThree.isInitialized = false

      console.log("🛤️ PathVisualizationThree disposed")
    }
  }
}

// Make functions available globally for console testing
declare global {
  interface Window {
    testPathThree: (
      startX: number,
      startZ: number,
      endX: number,
      endZ: number,
    ) => void
    clearPathThree: () => void
    addPathThree: (
      pathId: string,
      startX: number,
      startZ: number,
      endX: number,
      endZ: number,
    ) => void
    removePathThree: (pathId: string) => void
    listPathsThree: () => void
  }
}

// Add to window for browser console access
if (typeof window !== "undefined") {
  window.testPathThree = (
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
  ) => {
    PathVisualizationThree.testPath(startX, startZ, endX, endZ)
  }

  window.clearPathThree = () => {
    PathVisualizationThree.clearVisualization()
    console.log("🛤️ Path visualization cleared")
  }

  window.addPathThree = (
    pathId: string,
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
  ) => {
    const result = DynamicNavSystem.findPath(
      new THREE.Vector2(startX, startZ),
      new THREE.Vector2(endX, endZ),
    )
    if (result.success) {
      PathVisualizationThree.addPath(pathId, result, startX, startZ, endX, endZ)
      console.log(`🛤️ Added path '${pathId}'`)
    } else {
      console.log(`❌ Failed to find path for '${pathId}'`)
    }
  }

  window.removePathThree = (pathId: string) => {
    const removed = PathVisualizationThree.removePath(pathId)
    if (!removed) {
      console.log(`❌ Path '${pathId}' not found`)
    }
  }

  window.listPathsThree = () => {
    const paths = PathVisualizationThree.getActivePathIds()
    console.log(
      `🛤️ Active paths: ${paths.length > 0 ? paths.join(", ") : "none"}`,
    )
  }
}
