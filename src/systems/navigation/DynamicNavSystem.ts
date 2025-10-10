import * as THREE from "three"
import { NavigationGrid, Footprint } from "./NavigationGrid"
import { NavGridDebugDisplayThree } from "./NavGridDebugDisplayThree"
import { GameObject } from "@engine/core"
import { ObjRenderer } from "@engine/render"

export interface Waypoint {
  x: number
  z: number
}

export interface PathfindingResult {
  success: boolean
  waypoints: Waypoint[]
  distance: number
}

interface PathNode {
  col: number
  row: number
  gCost: number // Distance from start
  hCost: number // Heuristic distance to end
  fCost: number // gCost + hCost
  parent: PathNode | null
}

/**
 * Three.js version of DynamicNavSystem
 * Uses Three.js Vector2/Vector3 instead of Babylon.js types
 * Clean static API with no scene dependency needed
 */
export class DynamicNavSystem {
  private static navigationGrid: NavigationGrid | null = null
  private static scene: THREE.Scene | null = null
  private static isInitialized: boolean = false

  /**
   * Initialize the navigation system (must be called before use)
   * Scene parameter is optional - only needed for debug visualization
   */
  public static initialize(
    scene?: THREE.Scene,
    worldWidth: number = 200,
    worldDepth: number = 200,
    gridSize: number = 2,
  ): void {
    if (DynamicNavSystem.isInitialized) {
      console.warn("DynamicNavSystem already initialized")
      return
    }

    DynamicNavSystem.scene = scene || null
    DynamicNavSystem.navigationGrid = new NavigationGrid(
      worldWidth,
      worldDepth,
      gridSize,
    )
    DynamicNavSystem.isInitialized = true

    // Initialize debug display system if scene is provided
    if (scene) {
      NavGridDebugDisplayThree.initialize(scene)
    }

    // DynamicNavSystem initialized
  }

  /**
   * Check if the system is initialized
   */
  public static getIsInitialized(): boolean {
    return DynamicNavSystem.isInitialized
  }

  /**
   * Dispose of the navigation system
   */
  public static dispose(): void {
    if (DynamicNavSystem.isInitialized) {
      //NavGridDebugDisplayThree.dispose()
      DynamicNavSystem.navigationGrid = null
      DynamicNavSystem.scene = null
      DynamicNavSystem.isInitialized = false
      console.log("DynamicNavSystem disposed")
    }
  }

  /**
   * Add an obstacle to the navigation grid
   */
  public static addObstacle(footprint: Footprint): void {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return
    }

    DynamicNavSystem.navigationGrid.addObstacle(footprint)
  }

  /**
   * Remove an obstacle from the navigation grid
   */
  public static removeObstacle(footprint: Footprint): void {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return
    }

    DynamicNavSystem.navigationGrid.removeObstacle(footprint)
  }

  /**
   * Check if a position is walkable
   */
  public static isWalkable(x: number, z: number): boolean {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return false
    }

    const gridPos = DynamicNavSystem.navigationGrid.worldToGrid(x, z)
    return DynamicNavSystem.navigationGrid.isWalkable(gridPos.col, gridPos.row)
  }

  /**
   * Convert world coordinates to grid coordinates
   */
  public static worldToGrid(
    x: number,
    z: number,
  ): { col: number; row: number } | null {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return null
    }

    return DynamicNavSystem.navigationGrid.worldToGrid(x, z)
  }

  /**
   * Convert grid coordinates to world coordinates
   */
  public static gridToWorld(
    col: number,
    row: number,
  ): { x: number; z: number } | null {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return null
    }

    return DynamicNavSystem.navigationGrid.gridToWorld(col, row)
  }

  /**
   * Debug method to print current navigation state
   */
  public static debugNavigation(): void {
    NavGridDebugDisplayThree.debugNavigation(DynamicNavSystem.navigationGrid)
  }

  /**
   * Add a box obstacle to the navigation grid
   * @param x World X position (center)
   * @param z World Z position (center)
   * @param width Width of the obstacle
   * @param depth Depth of the obstacle
   */
  public static addBoxObstacle(
    x: number,
    z: number,
    width: number,
    depth: number,
  ): void {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return
    }

    // Create a polygon footprint for the box
    const halfWidth = width * 0.5
    const halfDepth = depth * 0.5

    const footprint: Footprint = {
      type: "polygon",
      vertices: [
        new THREE.Vector3(x - halfWidth, 0, z - halfDepth),
        new THREE.Vector3(x + halfWidth, 0, z - halfDepth),
        new THREE.Vector3(x + halfWidth, 0, z + halfDepth),
        new THREE.Vector3(x - halfWidth, 0, z + halfDepth),
      ],
    }

    DynamicNavSystem.navigationGrid.addObstacle(footprint)
    // Box obstacle added (logging disabled)
  }

  /**
   * Remove a box obstacle from the navigation grid
   * @param x World X position (center)
   * @param z World Z position (center)
   * @param width Width of the obstacle
   * @param depth Depth of the obstacle
   */
  public static removeBoxObstacle(
    x: number,
    z: number,
    width: number,
    depth: number,
  ): void {
    if (!DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return
    }

    // Create a polygon footprint for the box (same as addBoxObstacle)
    const halfWidth = width * 0.5
    const halfDepth = depth * 0.5

    const footprint: Footprint = {
      type: "polygon",
      vertices: [
        new THREE.Vector3(x - halfWidth, 0, z - halfDepth),
        new THREE.Vector3(x + halfWidth, 0, z - halfDepth),
        new THREE.Vector3(x + halfWidth, 0, z + halfDepth),
        new THREE.Vector3(x - halfWidth, 0, z + halfDepth),
      ],
    }

    DynamicNavSystem.navigationGrid.removeObstacle(footprint)
    console.log(
      `🚧 Removed box obstacle at (${x}, ${z}) with size ${width}x${depth}`,
    )
  }

  /**
   * Add a box obstacle from a GameObject and its bounds size
   * @param gameObject The GameObject to get world position from
   * @param boundsSize The size from renderer bounds (uses X and Z for navigation)
   */
  public static addBoxObstacleFromBounds(
    gameObject: GameObject,
    boundsSize: THREE.Vector3,
  ): void {
    // Get world position of the object
    const worldPos = gameObject.getWorldPosition(new THREE.Vector3())

    // Get the Y rotation to determine if dimensions need to be swapped
    const worldRotation = gameObject.getWorldQuaternion(new THREE.Quaternion())
    const euler = new THREE.Euler().setFromQuaternion(worldRotation)
    const rotationY = euler.y

    // Use X and Z dimensions for navigation (ignore Y/height)
    let width = boundsSize.x
    let depth = boundsSize.z

    // For 90° and 270° rotations, swap width and depth
    // Normalize rotation to 0-2π range to handle negative values
    let normalizedRotation = rotationY % (Math.PI * 2)
    if (normalizedRotation < 0) normalizedRotation += Math.PI * 2

    const is90Degrees = Math.abs(normalizedRotation - Math.PI * 0.5) < 0.1
    const is270Degrees = Math.abs(normalizedRotation - Math.PI * 1.5) < 0.1

    if (is90Degrees || is270Degrees) {
      // Swap dimensions for rotated objects
      const temp = width
      width = depth
      depth = temp
    }

    // Add obstacle to navigation system
    DynamicNavSystem.addBoxObstacle(worldPos.x, worldPos.z, width, depth)
    // Navigation obstacle added (logging disabled)
  }

  /**
   * Add a box obstacle from a GameObject with ObjRenderer component
   * Automatically gets bounds from the renderer
   * @param gameObject The GameObject with ObjRenderer component
   */
  public static addBoxObstacleFromRenderer(gameObject: GameObject): boolean {
    // Find ObjRenderer component
    const renderer = gameObject.getComponent(ObjRenderer)
    if (!renderer) {
      console.warn(`GameObject ${gameObject.name} has no ObjRenderer component`)
      return false
    }

    // Get bounds from renderer
    const bounds = renderer.getBounds()
    if (!bounds) {
      console.warn(`Could not get bounds for ${gameObject.name}`)
      return false
    }

    // Add obstacle using bounds
    DynamicNavSystem.addBoxObstacleFromBounds(gameObject, bounds)
    return true
  }

  // ========================================
  // PATHFINDING METHODS
  // ========================================

  /**
   * Find a path from start position to end position using A* pathfinding
   * @param startPos Start position as THREE.Vector2 (x, z)
   * @param endPos End position as THREE.Vector2 (x, z)
   */
  public static findPath(
    startPos: THREE.Vector2,
    endPos: THREE.Vector2,
  ): PathfindingResult

  /**
   * Find a path from start position to end position using A* pathfinding
   * @param startPos Start position as THREE.Vector3 (uses x, z components)
   * @param endPos End position as THREE.Vector3 (uses x, z components)
   */
  public static findPath(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
  ): PathfindingResult

  /**
   * Implementation for findPath - main logic using THREE.Vector2
   */
  public static findPath(
    startPos: THREE.Vector2 | THREE.Vector3,
    endPos: THREE.Vector2 | THREE.Vector3,
  ): PathfindingResult {
    // Convert inputs to THREE.Vector2
    let start: THREE.Vector2, end: THREE.Vector2

    if (startPos instanceof THREE.Vector3) {
      start = new THREE.Vector2(startPos.x, startPos.z)
    } else {
      start = startPos
    }

    if (endPos instanceof THREE.Vector3) {
      end = new THREE.Vector2(endPos.x, endPos.z)
    } else {
      end = endPos
    }

    // Main pathfinding implementation
    if (!DynamicNavSystem.isInitialized || !DynamicNavSystem.navigationGrid) {
      console.warn("DynamicNavSystem not initialized")
      return { success: false, waypoints: [], distance: 0 }
    }

    // Convert world coordinates to grid coordinates
    const startGrid = DynamicNavSystem.navigationGrid.worldToGrid(
      start.x,
      start.y,
    )
    const endGrid = DynamicNavSystem.navigationGrid.worldToGrid(end.x, end.y)

    // Check if start and end positions are valid
    if (
      !DynamicNavSystem.navigationGrid.isWalkable(startGrid.col, startGrid.row)
    ) {
      // Find the closest walkable cell to the start position
      const closestWalkableStartCell =
        DynamicNavSystem.findClosestWalkableCell(startGrid)
      if (!closestWalkableStartCell) {
        console.warn(
          `No walkable position found near start position (${start.x}, ${start.y})`,
        )
        return { success: false, waypoints: [], distance: 0 }
      }

      // Update the start to the closest walkable cell
      startGrid.col = closestWalkableStartCell.col
      startGrid.row = closestWalkableStartCell.row
      // Adjusted start position (logging disabled)
    }

    if (!DynamicNavSystem.navigationGrid.isWalkable(endGrid.col, endGrid.row)) {
      // Find the closest walkable cell to the target
      const closestWalkableCell =
        DynamicNavSystem.findClosestWalkableCell(endGrid)
      if (!closestWalkableCell) {
        return { success: false, waypoints: [], distance: 0 }
      }

      // Update the target to the closest walkable cell
      endGrid.col = closestWalkableCell.col
      endGrid.row = closestWalkableCell.row
    }

    // Run A* pathfinding on the grid
    const gridPath = DynamicNavSystem.findPathAStar(startGrid, endGrid)

    if (gridPath.length === 0) {
      return { success: false, waypoints: [], distance: 0 }
    }

    // Convert grid path to world waypoints
    const worldPath = gridPath.map((node) => {
      const worldPos = DynamicNavSystem.navigationGrid!.gridToWorld(
        node.col,
        node.row,
      )
      return { x: worldPos.x, z: worldPos.z }
    })

    // Simplify path to reduce waypoints (remove unnecessary intermediate points)
    const simplifiedPath = DynamicNavSystem.simplifyPath(worldPath)

    // CRITICAL: Use exact target position instead of grid center for final waypoint (like Babylon.js)
    if (simplifiedPath.length > 0 && gridPath.length > 0) {
      const finalPathCell = gridPath[gridPath.length - 1]
      // If pathfinding reached the target cell, use exact target position
      if (
        finalPathCell.col === endGrid.col &&
        finalPathCell.row === endGrid.row
      ) {
        // Check if target was redirected to a different cell
        const originalTargetGrid = DynamicNavSystem.navigationGrid!.worldToGrid(
          end.x,
          end.y,
        )
        if (
          endGrid.col === originalTargetGrid.col &&
          endGrid.row === originalTargetGrid.row
        ) {
          // Target wasn't redirected, use exact position
          simplifiedPath[simplifiedPath.length - 1] = {
            x: end.x,
            z: end.y,
          }
        } else {
          // Target was redirected, find closest point in the reachable cell to original target
          const cellWorldPos = DynamicNavSystem.navigationGrid!.gridToWorld(
            endGrid.col,
            endGrid.row,
          )
          const gridSize =
            DynamicNavSystem.navigationGrid!.getDimensions().gridSize
          const halfGrid = gridSize / 2

          // Clamp original target to be within the reachable cell bounds
          const clampedX = Math.max(
            cellWorldPos.x - halfGrid,
            Math.min(cellWorldPos.x + halfGrid, end.x),
          )
          const clampedZ = Math.max(
            cellWorldPos.z - halfGrid,
            Math.min(cellWorldPos.z + halfGrid, end.y),
          )

          simplifiedPath[simplifiedPath.length - 1] = {
            x: clampedX,
            z: clampedZ,
          }
        }
      }
    }

    // Calculate total distance
    const distance = DynamicNavSystem.calculatePathDistance(simplifiedPath)

    return {
      success: true,
      waypoints: simplifiedPath,
      distance: distance,
    }
  }

  /**
   * Find the closest walkable cell to a given position
   */
  private static findClosestWalkableCell(targetPos: {
    col: number
    row: number
  }): { col: number; row: number } | null {
    if (!DynamicNavSystem.navigationGrid) return null

    const maxSearchRadius = 10
    const gridInfo = DynamicNavSystem.navigationGrid.getDimensions()

    for (let radius = 1; radius <= maxSearchRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          // Skip inner cells (already checked in smaller radius)
          if (Math.abs(dx) < radius && Math.abs(dz) < radius) continue

          const checkCol = targetPos.col + dx
          const checkRow = targetPos.row + dz

          // Check bounds
          if (
            checkCol < 0 ||
            checkCol >= gridInfo.cols ||
            checkRow < 0 ||
            checkRow >= gridInfo.rows
          ) {
            continue
          }

          if (DynamicNavSystem.navigationGrid.isWalkable(checkCol, checkRow)) {
            return { col: checkCol, row: checkRow }
          }
        }
      }
    }

    return null
  }

  /**
   * A* pathfinding algorithm implementation
   * Returns array of grid nodes representing the path
   */
  private static findPathAStar(
    start: { col: number; row: number },
    end: { col: number; row: number },
  ): PathNode[] {
    const openSet: PathNode[] = []
    const closedSet: Set<string> = new Set()
    const gridInfo = DynamicNavSystem.navigationGrid!.getDimensions()

    // Create start node
    const startNode: PathNode = {
      col: start.col,
      row: start.row,
      gCost: 0,
      hCost: DynamicNavSystem.getDistance(
        start.col,
        start.row,
        end.col,
        end.row,
      ),
      fCost: 0,
      parent: null,
    }
    startNode.fCost = startNode.gCost + startNode.hCost

    openSet.push(startNode)

    while (openSet.length > 0) {
      // Find node with lowest fCost
      let currentNode = openSet[0]
      let currentIndex = 0

      for (let i = 1; i < openSet.length; i++) {
        if (
          openSet[i].fCost < currentNode.fCost ||
          (openSet[i].fCost === currentNode.fCost &&
            openSet[i].hCost < currentNode.hCost)
        ) {
          currentNode = openSet[i]
          currentIndex = i
        }
      }

      // Remove current node from open set
      openSet.splice(currentIndex, 1)
      const nodeKey = `${currentNode.col},${currentNode.row}`
      closedSet.add(nodeKey)

      // Check if we reached the target
      if (currentNode.col === end.col && currentNode.row === end.row) {
        return DynamicNavSystem.reconstructPath(currentNode)
      }

      // Check all neighbors (8-directional movement)
      const neighbors = [
        { col: -1, row: -1 },
        { col: 0, row: -1 },
        { col: 1, row: -1 },
        { col: -1, row: 0 },
        { col: 1, row: 0 },
        { col: -1, row: 1 },
        { col: 0, row: 1 },
        { col: 1, row: 1 },
      ]

      for (const neighborOffset of neighbors) {
        const neighborCol = currentNode.col + neighborOffset.col
        const neighborRow = currentNode.row + neighborOffset.row
        const neighborKey = `${neighborCol},${neighborRow}`

        // Skip if out of bounds
        if (
          neighborCol < 0 ||
          neighborCol >= gridInfo.cols ||
          neighborRow < 0 ||
          neighborRow >= gridInfo.rows
        ) {
          continue
        }

        // Skip if not walkable or already in closed set
        if (
          !DynamicNavSystem.navigationGrid!.isWalkable(
            neighborCol,
            neighborRow,
          ) ||
          closedSet.has(neighborKey)
        ) {
          continue
        }

        // Calculate movement cost (diagonal movement costs more)
        const isDiagonal = neighborOffset.col !== 0 && neighborOffset.row !== 0
        const movementCost = isDiagonal ? 1.414 : 1.0 // sqrt(2) for diagonal
        const tentativeGCost = currentNode.gCost + movementCost

        // Check if this neighbor is already in open set
        let neighborNode = openSet.find(
          (node) => node.col === neighborCol && node.row === neighborRow,
        )

        if (!neighborNode) {
          // Create new node
          neighborNode = {
            col: neighborCol,
            row: neighborRow,
            gCost: tentativeGCost,
            hCost: DynamicNavSystem.getDistance(
              neighborCol,
              neighborRow,
              end.col,
              end.row,
            ),
            fCost: 0,
            parent: currentNode,
          }
          neighborNode.fCost = neighborNode.gCost + neighborNode.hCost
          openSet.push(neighborNode)
        } else if (tentativeGCost < neighborNode.gCost) {
          // Update existing node with better path
          neighborNode.gCost = tentativeGCost
          neighborNode.fCost = neighborNode.gCost + neighborNode.hCost
          neighborNode.parent = currentNode
        }
      }
    }

    return [] // No path found
  }

  /**
   * Reconstruct path from the end node back to start
   */
  private static reconstructPath(endNode: PathNode): PathNode[] {
    const path: PathNode[] = []
    let current: PathNode | null = endNode

    while (current !== null) {
      path.unshift(current)
      current = current.parent
    }

    return path
  }

  /**
   * Calculate distance between two grid positions (Manhattan distance with diagonal support)
   */
  private static getDistance(
    col1: number,
    row1: number,
    col2: number,
    row2: number,
  ): number {
    const dx = Math.abs(col1 - col2)
    const dy = Math.abs(row1 - row2)

    // Use diagonal distance calculation for better heuristic
    const diagonalSteps = Math.min(dx, dy)
    const straightSteps = Math.max(dx, dy) - diagonalSteps

    return diagonalSteps * 1.414 + straightSteps * 1.0
  }

  /**
   * Simplify path by removing unnecessary waypoints using line-of-sight optimization
   */
  private static simplifyPath(waypoints: Waypoint[]): Waypoint[] {
    if (waypoints.length <= 2) {
      return waypoints
    }

    const simplified: Waypoint[] = [waypoints[0]] // Always include start point
    let currentIndex = 0

    while (currentIndex < waypoints.length - 1) {
      let farthestReachable = currentIndex + 1

      // Find the farthest point we can reach in a straight line
      for (
        let testIndex = currentIndex + 2;
        testIndex < waypoints.length;
        testIndex++
      ) {
        if (
          DynamicNavSystem.hasLineOfSight(
            waypoints[currentIndex],
            waypoints[testIndex],
          )
        ) {
          farthestReachable = testIndex
        } else {
          break
        }
      }

      simplified.push(waypoints[farthestReachable])
      currentIndex = farthestReachable
    }

    return simplified
  }

  /**
   * Check if there's a clear line of sight between two waypoints
   */
  private static hasLineOfSight(start: Waypoint, end: Waypoint): boolean {
    if (!DynamicNavSystem.navigationGrid) return false

    // Convert to grid coordinates
    const startGrid = DynamicNavSystem.navigationGrid.worldToGrid(
      start.x,
      start.z,
    )
    const endGrid = DynamicNavSystem.navigationGrid.worldToGrid(end.x, end.z)

    // Use Bresenham's line algorithm to check each grid cell along the line
    const dx = Math.abs(endGrid.col - startGrid.col)
    const dz = Math.abs(endGrid.row - startGrid.row)
    let x = startGrid.col
    let z = startGrid.row
    const xInc = startGrid.col < endGrid.col ? 1 : -1
    const zInc = startGrid.row < endGrid.row ? 1 : -1
    let error = dx - dz

    for (let i = 0; i <= dx + dz; i++) {
      // Check if current cell is walkable
      if (!DynamicNavSystem.navigationGrid.isWalkable(x, z)) {
        return false
      }

      if (x === endGrid.col && z === endGrid.row) {
        break
      }

      const error2 = error * 2
      if (error2 > -dz) {
        error -= dz
        x += xInc
      }
      if (error2 < dx) {
        error += dx
        z += zInc
      }
    }

    return true
  }

  /**
   * Calculate total distance of a path (like Babylon.js version)
   */
  private static calculatePathDistance(waypoints: Waypoint[]): number {
    let totalDistance = 0
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i + 1].x - waypoints[i].x
      const dz = waypoints[i + 1].z - waypoints[i].z
      totalDistance += Math.sqrt(dx * dx + dz * dz)
    }
    return totalDistance
  }

  /**
   * Check if a path exists between two positions (faster than full pathfinding)
   */
  public static canReach(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
  ): boolean {
    if (!DynamicNavSystem.isInitialized || !DynamicNavSystem.navigationGrid) {
      return false
    }

    // Quick checks first
    if (
      !DynamicNavSystem.isWalkable(startX, startZ) ||
      !DynamicNavSystem.isWalkable(endX, endZ)
    ) {
      return false
    }

    // If very close, just check line of sight
    const distance = Math.sqrt((endX - startX) ** 2 + (endZ - startZ) ** 2)
    if (
      distance <=
      DynamicNavSystem.navigationGrid.getDimensions().gridSize * 2
    ) {
      return DynamicNavSystem.hasLineOfSight(
        { x: startX, z: startZ },
        { x: endX, z: endZ },
      )
    }

    // For longer distances, use simplified A* with early exit
    const result = DynamicNavSystem.findPath(
      new THREE.Vector2(startX, startZ),
      new THREE.Vector2(endX, endZ),
    )
    return result.success
  }
}
