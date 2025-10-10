import * as THREE from "three"

export interface SplinePointThree {
  position: THREE.Vector3
  index: number
}

export interface SplineSegmentThree {
  startPoint: SplinePointThree
  endPoint: SplinePointThree
  length: number
}

export enum SplineTypeThree {
  LINEAR = "linear",
  CATMULL_ROM = "catmull_rom",
  BEZIER = "bezier",
}

export interface SplineConfigThree {
  type: SplineTypeThree
  resolution: number // Number of interpolated points per segment
  tension?: number // For Catmull-Rom splines (0-1)
  closed?: boolean // Whether the spline is a closed loop
}

/**
 * A flexible spline system for Three.js that can create smooth curves through waypoints
 */
export class SplineThree {
  private waypoints: THREE.Vector3[] = []
  private config: SplineConfigThree
  private interpolatedPoints: THREE.Vector3[] = []
  private segments: SplineSegmentThree[] = []
  private totalLength: number = 0

  constructor(
    config: SplineConfigThree = {
      type: SplineTypeThree.CATMULL_ROM,
      resolution: 10,
      tension: 0.5,
      closed: false,
    },
  ) {
    this.config = config
  }

  /**
   * Set the waypoints for the spline
   */
  public setWaypoints(waypoints: THREE.Vector3[]): void {
    this.waypoints = waypoints.map((p) => p.clone())
    this.generateSpline()
  }

  /**
   * Get a point along the spline at parameter t (0-1)
   */
  public getPointAt(t: number): THREE.Vector3 {
    t = Math.max(0, Math.min(1, t))

    if (this.interpolatedPoints.length === 0) {
      return new THREE.Vector3()
    }

    if (t === 0) return this.interpolatedPoints[0].clone()
    if (t === 1)
      return this.interpolatedPoints[this.interpolatedPoints.length - 1].clone()

    const index = t * (this.interpolatedPoints.length - 1)
    const lowerIndex = Math.floor(index)
    const upperIndex = Math.ceil(index)
    const factor = index - lowerIndex

    if (lowerIndex === upperIndex) {
      return this.interpolatedPoints[lowerIndex].clone()
    }

    const p1 = this.interpolatedPoints[lowerIndex]
    const p2 = this.interpolatedPoints[upperIndex]

    return p1.clone().lerp(p2, factor)
  }

  /**
   * Get the direction (tangent) at parameter t (0-1)
   */
  public getDirectionAt(t: number): THREE.Vector3 {
    const epsilon = 0.001
    const t1 = Math.max(0, t - epsilon)
    const t2 = Math.min(1, t + epsilon)

    const p1 = this.getPointAt(t1)
    const p2 = this.getPointAt(t2)

    return p2.sub(p1).normalize()
  }

  /**
   * Get a point at a specific distance from the start
   */
  public getPointAtDistance(distance: number): THREE.Vector3 {
    if (this.totalLength === 0) return new THREE.Vector3()

    const t = distance / this.totalLength
    return this.getPointAt(t)
  }

  /**
   * Find the closest point on the spline to a given position
   */
  public getClosestPoint(position: THREE.Vector3): {
    point: THREE.Vector3
    t: number
    distance: number
  } {
    let closestPoint = new THREE.Vector3()
    let closestT = 0
    let closestDistance = Infinity

    // Sample the spline at regular intervals
    const samples = 100
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const point = this.getPointAt(t)
      const distance = position.distanceTo(point)

      if (distance < closestDistance) {
        closestDistance = distance
        closestPoint = point
        closestT = t
      }
    }

    return {
      point: closestPoint,
      t: closestT,
      distance: closestDistance,
    }
  }

  /**
   * Get the total length of the spline
   */
  public getTotalLength(): number {
    return this.totalLength
  }

  /**
   * Get all interpolated points
   */
  public getInterpolatedPoints(): THREE.Vector3[] {
    return this.interpolatedPoints.map((p) => p.clone())
  }

  /**
   * Get the original waypoints (not interpolated points)
   */
  public getWaypoints(): THREE.Vector3[] {
    return this.waypoints.map((p) => p.clone())
  }

  /**
   * Get the segments of the spline
   */
  public getSegments(): SplineSegmentThree[] {
    return this.segments
  }

  /**
   * Position a GameObject at parameter t along the spline with proper rotation
   */
  public setGameObjectAt(gameObject: any, t: number): void {
    const position = this.getPointAt(t)
    const direction = this.getDirectionAt(t)

    // Set position
    gameObject.position.copy(position)

    // Set rotation to face along the spline direction
    if (direction.length() > 0.001) {
      const angle = Math.atan2(direction.x, direction.z)
      gameObject.rotation.set(0, angle, 0)
    }
  }

  /**
   * Generate the spline interpolation
   */
  private generateSpline(): void {
    if (this.waypoints.length < 2) {
      this.interpolatedPoints = []
      this.segments = []
      this.totalLength = 0
      return
    }

    this.interpolatedPoints = []
    this.segments = []

    switch (this.config.type) {
      case SplineTypeThree.LINEAR:
        this.generateLinearSpline()
        break
      case SplineTypeThree.CATMULL_ROM:
        this.generateCatmullRomSpline()
        break
      case SplineTypeThree.BEZIER:
        this.generateBezierSpline()
        break
    }

    this.calculateSegments()
    this.calculateTotalLength()
  }

  /**
   * Generate linear interpolation between waypoints
   */
  private generateLinearSpline(): void {
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const start = this.waypoints[i]
      const end = this.waypoints[i + 1]

      for (let j = 0; j < this.config.resolution; j++) {
        const t = j / this.config.resolution
        const point = start.clone().lerp(end, t)
        this.interpolatedPoints.push(point)
      }
    }

    // Add final point
    this.interpolatedPoints.push(
      this.waypoints[this.waypoints.length - 1].clone(),
    )
  }

  /**
   * Generate Catmull-Rom spline interpolation
   */
  private generateCatmullRomSpline(): void {
    const tension = this.config.tension || 0.5

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const p0 = i > 0 ? this.waypoints[i - 1] : this.waypoints[i]
      const p1 = this.waypoints[i]
      const p2 = this.waypoints[i + 1]
      const p3 =
        i < this.waypoints.length - 2
          ? this.waypoints[i + 2]
          : this.waypoints[i + 1]

      for (let j = 0; j < this.config.resolution; j++) {
        const t = j / this.config.resolution
        const point = this.catmullRomInterpolate(p0, p1, p2, p3, t, tension)
        this.interpolatedPoints.push(point)
      }
    }

    // Add final point
    this.interpolatedPoints.push(
      this.waypoints[this.waypoints.length - 1].clone(),
    )
  }

  /**
   * Catmull-Rom interpolation function
   */
  private catmullRomInterpolate(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    t: number,
    tension: number,
  ): THREE.Vector3 {
    const t2 = t * t
    const t3 = t2 * t

    // Calculate tangent vectors (same as Babylon.js)
    const v0 = p2.clone().sub(p0).multiplyScalar(tension)
    const v1 = p3.clone().sub(p1).multiplyScalar(tension)

    // Use the same formula as Babylon.js for correct Catmull-Rom interpolation
    return p1
      .clone()
      .multiplyScalar(1 + 2 * t3 - 3 * t2)
      .add(p2.clone().multiplyScalar(3 * t2 - 2 * t3))
      .add(v0.clone().multiplyScalar(t3 - 2 * t2 + t))
      .add(v1.clone().multiplyScalar(t3 - t2))
  }

  /**
   * Generate Bezier spline (simplified - using quadratic Bezier)
   */
  private generateBezierSpline(): void {
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const start = this.waypoints[i]
      const end = this.waypoints[i + 1]
      const control = start.clone().lerp(end, 0.5)

      for (let j = 0; j < this.config.resolution; j++) {
        const t = j / this.config.resolution
        const point = this.quadraticBezier(start, control, end, t)
        this.interpolatedPoints.push(point)
      }
    }

    // Add final point
    this.interpolatedPoints.push(
      this.waypoints[this.waypoints.length - 1].clone(),
    )
  }

  /**
   * Quadratic Bezier interpolation
   */
  private quadraticBezier(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    t: number,
  ): THREE.Vector3 {
    const oneMinusT = 1 - t

    return p0
      .clone()
      .multiplyScalar(oneMinusT * oneMinusT)
      .add(p1.clone().multiplyScalar(2 * oneMinusT * t))
      .add(p2.clone().multiplyScalar(t * t))
  }

  /**
   * Calculate segments between interpolated points
   */
  private calculateSegments(): void {
    this.segments = []

    for (let i = 0; i < this.interpolatedPoints.length - 1; i++) {
      const startPoint: SplinePointThree = {
        position: this.interpolatedPoints[i],
        index: i,
      }

      const endPoint: SplinePointThree = {
        position: this.interpolatedPoints[i + 1],
        index: i + 1,
      }

      const length = startPoint.position.distanceTo(endPoint.position)

      this.segments.push({
        startPoint,
        endPoint,
        length,
      })
    }
  }

  /**
   * Calculate total length of the spline
   */
  private calculateTotalLength(): void {
    this.totalLength = this.segments.reduce(
      (total, segment) => total + segment.length,
      0,
    )
  }
}
