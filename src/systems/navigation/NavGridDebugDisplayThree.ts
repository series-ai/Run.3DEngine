import * as THREE from "three"
import { NavigationGrid } from "./NavigationGrid"

/**
 * Debug visualization for NavigationGrid in Three.js
 * Shows grid lines and blocked areas
 */
export class NavGridDebugDisplayThree {
  private static isInitialized: boolean = false
  private static scene: THREE.Scene | null = null
  private static debugLines: THREE.LineSegments | null = null
  private static blockedCubes: THREE.Group | null = null // Group to hold all blocked area cubes

  /**
   * Initialize the debug display system
   */
  public static initialize(scene: THREE.Scene): void {
    if (NavGridDebugDisplayThree.isInitialized) {
      console.warn("NavGridDebugDisplayThree already initialized")
      return
    }

    NavGridDebugDisplayThree.scene = scene
    NavGridDebugDisplayThree.isInitialized = true

    // NavGridDebugDisplayThree initialized
  }

  /**
   * Dispose of the debug display system
   */
  public static dispose(): void {
    if (NavGridDebugDisplayThree.isInitialized) {
      NavGridDebugDisplayThree.clearDebugLines()
      NavGridDebugDisplayThree.scene = null
      NavGridDebugDisplayThree.isInitialized = false
      console.log("NavGridDebugDisplayThree disposed")
    }
  }

  /**
   * Debug method to visualize the navigation grid with blocked areas
   */
  public static debugNavigation(navigationGrid: NavigationGrid | null): void {
    if (
      !NavGridDebugDisplayThree.isInitialized ||
      !NavGridDebugDisplayThree.scene ||
      !navigationGrid
    ) {
      console.warn("NavGridDebugDisplayThree not initialized or no grid provided")
      return
    }

    // Clear existing debug visualization
    NavGridDebugDisplayThree.clearDebugLines()

    // Create debug visualization
    const dimensions = navigationGrid.getDimensions()
    const gridData = navigationGrid.getGridData()

    // Create grid lines
    NavGridDebugDisplayThree.createGridLines(navigationGrid, dimensions)

    // Create blocked area visualization
    NavGridDebugDisplayThree.createBlockedAreas(navigationGrid, dimensions, gridData)

    // Log statistics
    let walkableCount = 0
    let blockedCount = 0

    for (let row = 0; row < dimensions.rows; row++) {
      for (let col = 0; col < dimensions.cols; col++) {
        if (navigationGrid.isWalkable(col, row)) {
          walkableCount++
        } else {
          blockedCount++
        }
      }
    }

    // Navigation grid debug ready
  }

  /**
   * Create grid lines for the navigation grid
   */
  private static createGridLines(navigationGrid: NavigationGrid, dimensions: any): void {
    const points: THREE.Vector3[] = []

    // Create grid lines
    for (let row = 0; row <= dimensions.rows; row++) {
      for (let col = 0; col <= dimensions.cols; col++) {
        const worldPos = navigationGrid.gridToWorld(col, row)

        // Horizontal lines
        if (col < dimensions.cols) {
          const nextWorldPos = navigationGrid.gridToWorld(col + 1, row)
          points.push(new THREE.Vector3(worldPos.x, 0.1, worldPos.z))
          points.push(new THREE.Vector3(nextWorldPos.x, 0.1, nextWorldPos.z))
        }

        // Vertical lines
        if (row < dimensions.rows) {
          const nextWorldPos = navigationGrid.gridToWorld(col, row + 1)
          points.push(new THREE.Vector3(worldPos.x, 0.1, worldPos.z))
          points.push(new THREE.Vector3(nextWorldPos.x, 0.1, nextWorldPos.z))
        }
      }
    }

    // Create geometry and material for grid lines
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00, // Green for walkable grid
      transparent: true,
      opacity: 0.3,
    })

    // Create line segments
    NavGridDebugDisplayThree.debugLines = new THREE.LineSegments(geometry, material)
    NavGridDebugDisplayThree.scene!.add(NavGridDebugDisplayThree.debugLines)
  }

  /**
   * Create red cubes for blocked areas
   */
  private static createBlockedAreas(
    navigationGrid: NavigationGrid,
    dimensions: any,
    gridData: number[][]
  ): void {
    // Create a group to hold all blocked cubes
    NavGridDebugDisplayThree.blockedCubes = new THREE.Group()
    NavGridDebugDisplayThree.scene!.add(NavGridDebugDisplayThree.blockedCubes)

    // Create geometry and material for blocked cubes (reuse for performance)
    const cubeGeometry = new THREE.BoxGeometry(
      dimensions.gridSize * 0.8,
      0.2,
      dimensions.gridSize * 0.8
    )
    const blockedMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Red for blocked areas
      transparent: true,
      opacity: 0.7,
    })

    // Create cubes for blocked cells
    for (let row = 0; row < dimensions.rows; row++) {
      for (let col = 0; col < dimensions.cols; col++) {
        if (!navigationGrid.isWalkable(col, row)) {
          const worldPos = navigationGrid.gridToWorld(col, row)

          // Create cube mesh
          const cube = new THREE.Mesh(cubeGeometry, blockedMaterial)
          cube.position.set(worldPos.x, 0.1, worldPos.z)

          NavGridDebugDisplayThree.blockedCubes.add(cube)
        }
      }
    }

    // Created blocked area cubes
  }

  /**
   * Clear debug lines and blocked cubes from the scene
   */
  public static clearDebugLines(): void {
    // Clear grid lines
    if (NavGridDebugDisplayThree.debugLines && NavGridDebugDisplayThree.scene) {
      NavGridDebugDisplayThree.scene.remove(NavGridDebugDisplayThree.debugLines)
      NavGridDebugDisplayThree.debugLines.geometry.dispose()
      ;(NavGridDebugDisplayThree.debugLines.material as THREE.Material).dispose()
      NavGridDebugDisplayThree.debugLines = null
    }

    // Clear blocked cubes
    if (NavGridDebugDisplayThree.blockedCubes && NavGridDebugDisplayThree.scene) {
      NavGridDebugDisplayThree.scene.remove(NavGridDebugDisplayThree.blockedCubes)

      // Dispose of all cube geometries and materials
      NavGridDebugDisplayThree.blockedCubes.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })

      NavGridDebugDisplayThree.blockedCubes = null
    }

    // Debug visualization cleared
  }
}
