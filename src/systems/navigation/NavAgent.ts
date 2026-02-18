import * as THREE from "three"
import { Component } from "@engine/core"
import { PathfindingResult, DynamicNavSystem } from "./DynamicNavSystem"
//import { PathVisualizationThree } from "./PathVisualizationThree"

/**
 * Three.js version of NavAgent
 * Transform-based navigation agent for AI entities
 * Moves the gameObject position directly without physics for smooth movement
 * Uses waypoint-based pathfinding for all movement
 * Perfect for entities that don't need collision detection (like customers)
 *
 * Handles pathfinding and visualization automatically!
 */
export class NavAgent extends Component {
  // Public movement parameters - can be adjusted directly
  public moveSpeed: number = 5.0
  public acceleration: number = 15.0
  public deceleration: number = 10.0
  public arrivalDistance: number = 0.5
  public angularAcceleration: number = 8.0 // How fast to rotate towards movement direction

  // Waypoint following
  private waypoints: THREE.Vector3[] = []
  private currentWaypointIndex: number = 0

  // Smooth movement interpolation
  private currentVelocity: THREE.Vector3 = new THREE.Vector3()
  private maxSpeed: number = 5.0

  // Target tracking
  private currentTarget: THREE.Vector3 | null = null
  private isMoving: boolean = false

  // Visualization management
  private pathVisualizationId: string
  private isVisualizationEnabled: boolean = true

  constructor() {
    super()
    this.pathVisualizationId = `nav_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Move to a target position using pathfinding
   * Handles pathfinding and visualization automatically
   * Returns true if pathfinding succeeded, false otherwise
   */
  public moveTo(targetPosition: THREE.Vector3 | THREE.Vector2): boolean {
    // Update maxSpeed to match current moveSpeed
    this.maxSpeed = this.moveSpeed

    // Convert Vector2 to Vector3 if needed
    const target3D =
      targetPosition instanceof THREE.Vector2
        ? new THREE.Vector3(targetPosition.x, 0, targetPosition.y)
        : targetPosition

    // Clear any existing path visualization
    this.clearVisualization()

    // Find path using DynamicNavSystem
    const result = DynamicNavSystem.findPath(this.gameObject.position, target3D)

    if (result.success) {
      // Set the path
      this.setPath(result)
      this.currentTarget = target3D.clone()
      this.isMoving = true

      // Add visualization if enabled
      if (this.isVisualizationEnabled) {
        //PathVisualizationThree.addPath(this.pathVisualizationId, result)
      }

      return true
    } else {
      // Try to find closest reachable point for fallback
      const currentPos = this.gameObject.position
      const targetDistance = currentPos.distanceTo(target3D)

      if (targetDistance < 5.0) {
        // Target is close, try direct movement
        this.setWaypoints([target3D.clone()])
        this.currentTarget = target3D.clone()
        this.isMoving = true
        return true
      }

      return false
    }
  }

  /**
   * Check if the agent has reached its target (matches Babylon.js NavAgent exactly)
   */
  public hasReachedTarget(): boolean {
    // Must have waypoints and be at the final target position
    if (this.waypoints.length === 0 || !this.currentTarget) {
      return false
    }

    // Check if we've completed all waypoints AND are close to the final target
    const hasCompletedPath = this.currentWaypointIndex >= this.waypoints.length
    const distanceToFinalTarget = this.gameObject.position.distanceTo(this.currentTarget)
    const isCloseToTarget = distanceToFinalTarget <= this.arrivalDistance

    return hasCompletedPath && isCloseToTarget
  }

  /**
   * Check if the agent is currently in motion
   * Returns true if the agent has a target or is still moving (velocity > threshold)
   */
  public isInMotion(): boolean {
    // Check if we have an active target
    if (this.currentTarget !== null) {
      return true
    }

    // Check if we're still moving (velocity magnitude)
    const velocityMagnitude = this.currentVelocity.length()
    return velocityMagnitude > 0.1
  }

  /**
   * Get the current movement speed as a normalized value (0-1)
   * 0 = stopped, 1 = moving at max speed
   * Useful for animation blending
   */
  public getMovementSpeedNormalized(): number {
    const currentSpeed = this.currentVelocity.length()
    return Math.min(currentSpeed / this.maxSpeed, 1.0)
  }

  /**
   * Get the current movement speed (units per second)
   */
  public getMovementSpeed(): number {
    return this.currentVelocity.length()
  }

  /**
   * Enable or disable path visualization
   */
  public setVisualizationEnabled(enabled: boolean): void {
    this.isVisualizationEnabled = enabled
    if (!enabled) {
      this.clearVisualization()
    }
  }

  /**
   * Get current movement speed
   */
  public getCurrentSpeed(): number {
    return this.currentVelocity.length()
  }

  /**
   * Get current waypoints
   */
  public getWaypoints(): THREE.Vector3[] {
    return [...this.waypoints]
  }

  /**
   * Stop current movement (matches Babylon.js NavAgent)
   */
  public stop(): void {
    this.clearTarget()
  }

  /**
   * Set path from pathfinding result (used internally by moveTo)
   */
  private setPath(pathResult: PathfindingResult): boolean {
    if (!pathResult.success || pathResult.waypoints.length === 0) {
      console.warn("NavAgent: Invalid path result provided")
      this.clearTarget()
      return false
    }

    // Convert waypoints to Vector3 array internally
    const waypoints = pathResult.waypoints.map((wp) => new THREE.Vector3(wp.x, 0, wp.z))
    this.setWaypoints(waypoints)

    return true
  }

  /**
   * Set waypoints to follow (used internally)
   */
  private setWaypoints(waypoints: THREE.Vector3[]): void {
    this.waypoints = [...waypoints]

    // CRITICAL: Always skip first waypoint since it's just the starting grid cell center
    // This matches the original Babylon.js NavAgent behavior
    this.currentWaypointIndex = waypoints.length > 1 ? 1 : 0
  }

  /**
   * Clear the current target (stops movement) - matches Babylon.js NavAgent exactly
   */
  private clearTarget(): void {
    this.waypoints = []
    this.currentWaypointIndex = 0
    this.currentVelocity.set(0, 0, 0)
    this.currentTarget = null
    this.isMoving = false
    this.clearVisualization()
  }

  /**
   * Clear path visualization
   */
  private clearVisualization(): void {
    //PathVisualizationThree.removePath(this.pathVisualizationId)
  }

  /**
   * Update movement along waypoints (called automatically by component system)
   */
  public update(deltaTime: number): void {
    // Handle end of path
    if (this.handlePathComplete(deltaTime)) {
      return
    }

    // Move toward current waypoint
    this.moveTowardPosition(deltaTime)

    // Handle waypoint reached
    this.checkWaypointReached()
  }

  /**
   * Handle stopping when path is complete
   * Returns true if path is complete
   */
  private handlePathComplete(deltaTime: number): boolean {
    if (this.currentWaypointIndex >= this.waypoints.length) {
      // Stop moving with smooth deceleration
      this.currentVelocity.lerp(new THREE.Vector3(), this.deceleration * deltaTime)
      this.applyMovement(deltaTime)

      if (this.currentVelocity.length() < 0.1) {
        this.isMoving = false
        this.currentVelocity.set(0, 0, 0)
        this.clearVisualization()
      }
      return true
    }
    return false
  }

  /**
   * Check if current waypoint is reached and advance if so
   */
  private checkWaypointReached(): void {
    if (this.currentWaypointIndex >= this.waypoints.length) return

    const currentWaypoint = this.waypoints[this.currentWaypointIndex]
    const distance = this.gameObject.position.distanceTo(currentWaypoint)

    if (distance <= this.arrivalDistance) {
      this.currentWaypointIndex++
    }
  }

  /**
   * Move toward a specific position with smooth acceleration/deceleration
   */
  private moveTowardPosition(deltaTime: number): void {
    if (this.currentWaypointIndex >= this.waypoints.length) return

    const targetPos = this.waypoints[this.currentWaypointIndex]
    const direction = targetPos.clone().sub(this.gameObject.position)
    direction.y = 0 // Only move on XZ plane

    const distance = direction.length()
    if (distance > 0.01) {
      direction.normalize()

      // Handle rotation - only rotate when not at the final waypoint or when far from final target
      const isLastWaypoint = this.currentWaypointIndex === this.waypoints.length - 1
      const shouldRotate = !isLastWaypoint || distance > this.arrivalDistance * 2

      if (shouldRotate) {
        this.rotateTowardsDirection(direction, deltaTime)
      }

      const desiredVelocity = direction.multiplyScalar(this.maxSpeed)
      this.currentVelocity.lerp(desiredVelocity, this.acceleration * deltaTime)
    }

    this.applyMovement(deltaTime)
  }

  /**
   * Apply the current velocity to the gameObject position
   */
  private applyMovement(deltaTime: number): void {
    const movement = this.currentVelocity.clone().multiplyScalar(deltaTime)
    this.gameObject.position.add(movement)
  }

  /**
   * Rotate towards movement direction
   */
  private rotateTowardsDirection(direction: THREE.Vector3, deltaTime: number): void {
    // Calculate target rotation from direction
    const targetRotationY = Math.atan2(direction.x, direction.z)

    // Get current rotation Y
    const currentRotationY = this.gameObject.rotation.y

    // Calculate the shortest angular distance
    let angleDifference = targetRotationY - currentRotationY

    // Normalize angle difference to [-π, π] range
    while (angleDifference > Math.PI) angleDifference -= 2 * Math.PI
    while (angleDifference < -Math.PI) angleDifference += 2 * Math.PI

    // Apply angular acceleration with smooth interpolation
    const rotationSpeed = this.angularAcceleration * deltaTime
    const maxRotationThisFrame = rotationSpeed

    // Clamp rotation to prevent overshooting
    const rotationDelta =
      Math.sign(angleDifference) * Math.min(Math.abs(angleDifference), maxRotationThisFrame)

    // Apply rotation
    this.gameObject.rotation.y += rotationDelta

    // Normalize rotation to [0, 2π] range for consistency
    while (this.gameObject.rotation.y < 0) this.gameObject.rotation.y += 2 * Math.PI
    while (this.gameObject.rotation.y >= 2 * Math.PI) this.gameObject.rotation.y -= 2 * Math.PI
  }
}
