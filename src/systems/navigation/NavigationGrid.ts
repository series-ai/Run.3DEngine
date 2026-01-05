import { Vector3 } from "three"

export interface Footprint {
  type: "polygon" | "circle"
  vertices?: Vector3[]
  x?: number
  z?: number
  radius?: number
}

export interface AABB {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

/**
 * A fast 2D navigation grid using reference counting for obstacle management
 * OPTIMIZED for high-performance incremental add/remove operations
 */
export class NavigationGrid {
  private grid: number[][]
  private worldWidth: number
  private worldDepth: number
  private gridSize: number
  private cols: number
  private rows: number

  // Performance optimization: Pre-calculated frequently used values
  private halfWorldWidth: number
  private halfWorldDepth: number
  private halfGridSize: number
  private gridSizeInv: number // 1/gridSize for fast division

  // Debug mode flag - disable for production performance
  private static DEBUG_MODE: boolean = false

  constructor(worldWidth: number, worldDepth: number, gridSize: number) {
    this.worldWidth = worldWidth
    this.worldDepth = worldDepth
    this.gridSize = gridSize

    this.cols = Math.ceil(worldWidth / gridSize)
    this.rows = Math.ceil(worldDepth / gridSize)

    // Pre-calculate frequently used values for performance
    this.halfWorldWidth = worldWidth * 0.5
    this.halfWorldDepth = worldDepth * 0.5
    this.halfGridSize = gridSize * 0.5
    this.gridSizeInv = 1.0 / gridSize

    // Initialize grid: each cell stores a reference count
    this.grid = Array(this.rows)
      .fill(null)
      .map(() => Array(this.cols).fill(0))

    if (NavigationGrid.DEBUG_MODE) {
      console.log(
        `NavigationGrid: Initialized ${this.cols}x${this.rows} grid, cellSize=${gridSize}`,
      )
    }
  }

  /**
   * OPTIMIZED: Converts world X, Z coordinates to grid column, row
   * Uses pre-calculated values for maximum performance
   */
  public worldToGrid(x: number, z: number): { col: number; row: number } {
    return {
      col: Math.floor((x + this.halfWorldWidth) * this.gridSizeInv),
      row: Math.floor((z + this.halfWorldDepth) * this.gridSizeInv),
    }
  }

  /**
   * Converts grid column, row to world X, Z center coordinates
   * Uses centered coordinate system where (0,0) world = center of grid
   */
  public gridToWorld(col: number, row: number): { x: number; z: number } {
    return {
      x: col * this.gridSize - this.worldWidth / 2 + this.gridSize / 2,
      z: row * this.gridSize - this.worldDepth / 2 + this.gridSize / 2,
    }
  }

  /**
   * Point-in-Polygon test using ray casting algorithm for 2D XZ plane
   */
  private isPointInPolygon(
    px: number,
    pz: number,
    polygonVertices: Vector3[],
  ): boolean {
    let isInside = false
    for (
      let i = 0, j = polygonVertices.length - 1;
      i < polygonVertices.length;
      j = i++
    ) {
      const xi = polygonVertices[i].x,
        zi = polygonVertices[i].z
      const xj = polygonVertices[j].x,
        zj = polygonVertices[j].z

      const intersect =
        zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi
      if (intersect) isInside = !isInside
    }
    return isInside
  }

  /**
   * Point-in-Circle test for 2D XZ plane
   */
  private isPointInCircle(
    px: number,
    pz: number,
    circleX: number,
    circleZ: number,
    circleRadius: number,
  ): boolean {
    const dx = px - circleX
    const dz = pz - circleZ
    return dx * dx + dz * dz <= circleRadius * circleRadius
  }

  /**
   * Check if a polygon intersects with a grid cell (not just contains the center)
   * This is crucial for thin obstacles like walls that might span multiple cells
   * but not contain the cell centers
   */
  private doesPolygonIntersectCell(
    cellCenterX: number,
    cellCenterZ: number,
    cellSize: number,
    polygonVertices: Vector3[],
  ): boolean {
    // First check if the cell center is inside the polygon (most common case)
    if (this.isPointInPolygon(cellCenterX, cellCenterZ, polygonVertices)) {
      return true
    }

    // If center is not inside, check if polygon intersects the cell area
    // Define the 4 corners of the grid cell
    const halfSize = cellSize / 2
    const cellCorners = [
      { x: cellCenterX - halfSize, z: cellCenterZ - halfSize }, // Bottom-left
      { x: cellCenterX + halfSize, z: cellCenterZ - halfSize }, // Bottom-right
      { x: cellCenterX + halfSize, z: cellCenterZ + halfSize }, // Top-right
      { x: cellCenterX - halfSize, z: cellCenterZ + halfSize }, // Top-left
    ]

    // Check if any polygon vertex is inside the cell
    for (const vertex of polygonVertices) {
      if (
        vertex.x >= cellCenterX - halfSize &&
        vertex.x <= cellCenterX + halfSize &&
        vertex.z >= cellCenterZ - halfSize &&
        vertex.z <= cellCenterZ + halfSize
      ) {
        return true
      }
    }

    // Check if any cell corner is inside the polygon
    for (const corner of cellCorners) {
      if (this.isPointInPolygon(corner.x, corner.z, polygonVertices)) {
        return true
      }
    }

    // Check if any polygon edge intersects any cell edge
    const cellEdges = [
      [cellCorners[0], cellCorners[1]], // Bottom edge
      [cellCorners[1], cellCorners[2]], // Right edge
      [cellCorners[2], cellCorners[3]], // Top edge
      [cellCorners[3], cellCorners[0]], // Left edge
    ]

    for (let i = 0; i < polygonVertices.length; i++) {
      const j = (i + 1) % polygonVertices.length
      const polyEdge = [
        { x: polygonVertices[i].x, z: polygonVertices[i].z },
        { x: polygonVertices[j].x, z: polygonVertices[j].z },
      ]

      for (const cellEdge of cellEdges) {
        if (
          this.doLineSegmentsIntersect(
            polyEdge[0],
            polyEdge[1],
            cellEdge[0],
            cellEdge[1],
          )
        ) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if two line segments intersect
   */
  private doLineSegmentsIntersect(
    p1: { x: number; z: number },
    p2: { x: number; z: number },
    p3: { x: number; z: number },
    p4: { x: number; z: number },
  ): boolean {
    const d1 = this.direction(p3, p4, p1)
    const d2 = this.direction(p3, p4, p2)
    const d3 = this.direction(p1, p2, p3)
    const d4 = this.direction(p1, p2, p4)

    if (
      ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    ) {
      return true
    }

    // Check for collinear points
    if (d1 === 0 && this.onSegment(p3, p4, p1)) return true
    if (d2 === 0 && this.onSegment(p3, p4, p2)) return true
    if (d3 === 0 && this.onSegment(p1, p2, p3)) return true
    if (d4 === 0 && this.onSegment(p1, p2, p4)) return true

    return false
  }

  /**
   * Calculate the direction/orientation of three points
   */
  private direction(
    a: { x: number; z: number },
    b: { x: number; z: number },
    c: { x: number; z: number },
  ): number {
    return (c.x - a.x) * (b.z - a.z) - (b.x - a.x) * (c.z - a.z)
  }

  /**
   * Check if point p lies on line segment ab
   */
  private onSegment(
    a: { x: number; z: number },
    b: { x: number; z: number },
    p: { x: number; z: number },
  ): boolean {
    return (
      p.x >= Math.min(a.x, b.x) &&
      p.x <= Math.max(a.x, b.x) &&
      p.z >= Math.min(a.z, b.z) &&
      p.z <= Math.max(a.z, b.z)
    )
  }

  /**
   * OPTIMIZED: Fast polygon-cell intersection using simplified approach
   * Much faster than full line-segment intersection for reference counting
   */
  private fastPolygonIntersectCell(
    cellCenterX: number,
    cellCenterZ: number,
    polygonVertices: Vector3[],
  ): boolean {
    // Fast check: If cell center is inside polygon, we're done
    if (this.isPointInPolygon(cellCenterX, cellCenterZ, polygonVertices)) {
      return true
    }

    // Fast check: If any polygon vertex is in cell bounds, we intersect
    const halfSize = this.halfGridSize
    const minX = cellCenterX - halfSize
    const maxX = cellCenterX + halfSize
    const minZ = cellCenterZ - halfSize
    const maxZ = cellCenterZ + halfSize

    for (let i = 0; i < polygonVertices.length; i++) {
      const v = polygonVertices[i]
      if (v.x >= minX && v.x <= maxX && v.z >= minZ && v.z <= maxZ) {
        return true
      }
    }

    // For thin objects, simplified AABB overlap test
    // This is much faster than line-segment intersection
    let polyMinX = polygonVertices[0].x,
      polyMaxX = polygonVertices[0].x
    let polyMinZ = polygonVertices[0].z,
      polyMaxZ = polygonVertices[0].z

    for (let i = 1; i < polygonVertices.length; i++) {
      const v = polygonVertices[i]
      if (v.x < polyMinX) polyMinX = v.x
      else if (v.x > polyMaxX) polyMaxX = v.x
      if (v.z < polyMinZ) polyMinZ = v.z
      else if (v.z > polyMaxZ) polyMaxZ = v.z
    }

    // Check if polygon AABB overlaps cell AABB
    return !(
      polyMaxX < minX ||
      polyMinX > maxX ||
      polyMaxZ < minZ ||
      polyMinZ > maxZ
    )
  }

  /**
   * OPTIMIZED: Calculate AABB with minimal overhead
   */
  private calculateAABB(footprint: Footprint): AABB {
    if (footprint.type === "circle") {
      const r = footprint.radius!
      return {
        minX: footprint.x! - r,
        minZ: footprint.z! - r,
        maxX: footprint.x! + r,
        maxZ: footprint.z! + r,
      }
    } else {
      const vertices = footprint.vertices!
      let minX = vertices[0].x,
        minZ = vertices[0].z
      let maxX = vertices[0].x,
        maxZ = vertices[0].z

      for (let i = 1; i < vertices.length; i++) {
        const v = vertices[i]
        if (v.x < minX) minX = v.x
        else if (v.x > maxX) maxX = v.x
        if (v.z < minZ) minZ = v.z
        else if (v.z > maxZ) maxZ = v.z
      }
      return { minX, minZ, maxX, maxZ }
    }
  }

  /**
   * OPTIMIZED: Add obstacle with maximum performance - INCREMENTAL reference counting only
   * Only touches cells affected by THIS obstacle - no global rebaking
   */
  public addObstacle(footprint: Footprint): void {
    const aabb = this.calculateAABB(footprint)

    // FAST: Inline grid bounds calculation without object allocations
    const minCol = Math.max(
      0,
      Math.floor((aabb.minX + this.halfWorldWidth) * this.gridSizeInv),
    )
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((aabb.maxX + this.halfWorldWidth) * this.gridSizeInv),
    )
    const minRow = Math.max(
      0,
      Math.floor((aabb.minZ + this.halfWorldDepth) * this.gridSizeInv),
    )
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((aabb.maxZ + this.halfWorldDepth) * this.gridSizeInv),
    )

    if (NavigationGrid.DEBUG_MODE) {
      console.log(
        `🔍 NavigationGrid: Adding ${footprint.type} obstacle, grid area: rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}`,
      )
    }

    let cellsAffected = 0

    // Pre-calculate values outside loops for maximum performance
    const isCircle = footprint.type === "circle"
    const circleX = isCircle ? footprint.x! : 0
    const circleZ = isCircle ? footprint.z! : 0
    const radiusSquared = isCircle ? footprint.radius! * footprint.radius! : 0
    const vertices = !isCircle ? footprint.vertices! : null

    // OPTIMIZED: Inline cell world coordinate calculation to avoid function calls
    for (let r = minRow; r <= maxRow; r++) {
      const cellWorldZ =
        r * this.gridSize - this.halfWorldDepth + this.halfGridSize

      for (let c = minCol; c <= maxCol; c++) {
        const cellWorldX =
          c * this.gridSize - this.halfWorldWidth + this.halfGridSize

        let isCovered = false
        if (isCircle) {
          // FAST: Pre-calculated squared radius avoids sqrt
          const dx = cellWorldX - circleX
          const dz = cellWorldZ - circleZ
          isCovered = dx * dx + dz * dz <= radiusSquared
        } else {
          // FAST: Use optimized polygon intersection
          isCovered = this.fastPolygonIntersectCell(
            cellWorldX,
            cellWorldZ,
            vertices!,
          )
        }

        if (isCovered) {
          this.grid[r][c]++ // INCREMENTAL: Only increment affected cells
          cellsAffected++
        }
      }
    }

    if (NavigationGrid.DEBUG_MODE) {
      console.log(
        `🔍 NavigationGrid: ${footprint.type} obstacle affected ${cellsAffected} cells`,
      )
    }
  }

  /**
   * OPTIMIZED: Remove obstacle with maximum performance - INCREMENTAL reference counting only
   * Only touches cells affected by THIS obstacle - no global rebaking
   */
  public removeObstacle(footprint: Footprint): void {
    const aabb = this.calculateAABB(footprint)

    // FAST: Inline grid bounds calculation (same as addObstacle for consistency)
    const minCol = Math.max(
      0,
      Math.floor((aabb.minX + this.halfWorldWidth) * this.gridSizeInv),
    )
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((aabb.maxX + this.halfWorldWidth) * this.gridSizeInv),
    )
    const minRow = Math.max(
      0,
      Math.floor((aabb.minZ + this.halfWorldDepth) * this.gridSizeInv),
    )
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((aabb.maxZ + this.halfWorldDepth) * this.gridSizeInv),
    )

    // Pre-calculate values outside loops (same as addObstacle for consistency)
    const isCircle = footprint.type === "circle"
    const circleX = isCircle ? footprint.x! : 0
    const circleZ = isCircle ? footprint.z! : 0
    const radiusSquared = isCircle ? footprint.radius! * footprint.radius! : 0
    const vertices = !isCircle ? footprint.vertices! : null

    // OPTIMIZED: Same performance optimizations as addObstacle
    for (let r = minRow; r <= maxRow; r++) {
      const cellWorldZ =
        r * this.gridSize - this.halfWorldDepth + this.halfGridSize

      for (let c = minCol; c <= maxCol; c++) {
        const cellWorldX =
          c * this.gridSize - this.halfWorldWidth + this.halfGridSize

        let isCovered = false
        if (isCircle) {
          // FAST: Same optimized circle test
          const dx = cellWorldX - circleX
          const dz = cellWorldZ - circleZ
          isCovered = dx * dx + dz * dz <= radiusSquared
        } else {
          // FAST: Same optimized polygon intersection
          isCovered = this.fastPolygonIntersectCell(
            cellWorldX,
            cellWorldZ,
            vertices!,
          )
        }

        if (isCovered) {
          this.grid[r][c]-- // INCREMENTAL: Only decrement affected cells
          if (this.grid[r][c] < 0) {
            this.grid[r][c] = 0
            if (NavigationGrid.DEBUG_MODE) {
              console.warn(
                `Grid count for cell (${c},${r}) went negative. Check logic.`,
              )
            }
          }
        }
      }
    }
  }

  /**
   * Check if a grid cell is walkable (reference count is zero)
   */
  public isWalkable(col: number, row: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return false // Out of bounds
    }
    return this.grid[row][col] === 0
  }

  /**
   * Get grid dimensions
   */
  public getDimensions(): {
    cols: number
    rows: number
    worldWidth: number
    worldDepth: number
    gridSize: number
  } {
    return {
      cols: this.cols,
      rows: this.rows,
      worldWidth: this.worldWidth,
      worldDepth: this.worldDepth,
      gridSize: this.gridSize,
    }
  }

  /**
   * Debug helper to print the grid state
   */
  public printGrid(): void {
    console.log("Navigation Grid State:")
    console.log(
      `Grid: ${this.cols}x${this.rows}, World: ${this.worldWidth}x${this.worldDepth}, Cell Size: ${this.gridSize}`,
    )
    console.log("🧭 NORTH (positive Z) at bottom, SOUTH (negative Z) at top")

    // Print all rows from 0 to rows-1 (so north appears at bottom)
    for (let r = 0; r < this.rows; r++) {
      let rowString = ""
      for (let c = 0; c < this.cols; c++) {
        rowString += this.grid[r][c] === 0 ? "." : "#"
      }

      // Add row number and world Z coordinate for reference
      const worldZ = this.gridToWorld(0, r).z
      console.log(
        `${r.toString().padStart(2)} (Z=${worldZ.toFixed(1)}): ${rowString}`,
      )
    }
    console.log("🧭 SOUTH ← → NORTH (Z coordinates)")
  }

  /**
   * Get the raw grid data (for debugging or visualization)
   */
  public getGridData(): number[][] {
    return this.grid
  }

  /**
   * Enable/disable debug logging for performance tuning
   * Set to false for production performance
   */
  public static setDebugMode(enabled: boolean): void {
    NavigationGrid.DEBUG_MODE = enabled
    if (enabled) {
      console.log("NavigationGrid: Debug mode ENABLED (performance impact)")
    } else {
      console.log(
        "NavigationGrid: Debug mode DISABLED (production performance)",
      )
    }
  }

  /**
   * Get current debug mode status
   */
  public static isDebugMode(): boolean {
    return NavigationGrid.DEBUG_MODE
  }
}
