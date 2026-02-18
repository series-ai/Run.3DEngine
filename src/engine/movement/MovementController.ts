import * as THREE from "three"
import { Component } from "@engine/core"
import { RigidBodyComponentThree } from "@systems/physics/RigidBodyComponentThree.ts"

/**
 * Three.js Movement controller component that handles physics-based movement and rotation
 * Uses Rapier physics with rotation locking for smooth, controlled movement
 * Can be used for player input, AI navigation, or any entity that needs to move
 */
export class MovementController extends Component {
  // Public configuration properties
  public maxMoveSpeed: number = 8.0
  public acceleration: number = 40
  public turnSpeed: number = 12 // How fast to rotate (radians per second)

  private rigidBodyComponent: RigidBodyComponentThree | null = null
  private targetRotationY: number = 0
  private currentRotationY: number = 0

  // Pre-allocated vector for velocity queries to avoid GC pressure
  private _currentVelocity = new THREE.Vector3()

  /**
   * Called when the component is created and attached to a GameObject
   */
  protected onCreate(): void {
    // Find the rigid body component on this GameObject
    this.findRigidBodyComponentThree()

    // Initialize rotation tracking
    this.currentRotationY = this.gameObject.rotation.y
    this.targetRotationY = this.currentRotationY
  }

  /**
   * Find the rigid body component on this GameObject
   */
  private findRigidBodyComponentThree(): void {
    this.rigidBodyComponent = this.gameObject.getComponent(RigidBodyComponentThree) || null
    if (!this.rigidBodyComponent) {
      console.warn("MovementController: No RigidBodyComponentThree found on GameObject")
    }
  }

  /**
   * Set the rigid body component this controller should manage
   */
  public setRigidBodyComponentThree(rigidBodyComponent: RigidBodyComponentThree): void {
    this.rigidBodyComponent = rigidBodyComponent
  }

  /**
   * Move the entity based on input direction
   * @param inputDirection Normalized direction vector (or null for no movement)
   * @param deltaTime Time since last frame in seconds
   */
  public move(inputDirection: THREE.Vector3 | null, deltaTime: number): void {
    if (!this.rigidBodyComponent) return

    const targetVelocity = this.calculateTargetVelocity(inputDirection)
    const smoothedVelocity = this.smoothVelocity(targetVelocity, deltaTime)

    // Apply velocity to physics body (Rapier handles rotation locking)
    this.rigidBodyComponent.setVelocity(smoothedVelocity)

    // Handle Y rotation separately and smoothly
    this.updateRotation(inputDirection, deltaTime)
  }

  /**
   * Calculate target velocity based on input direction
   */
  private calculateTargetVelocity(inputDirection: THREE.Vector3 | null): THREE.Vector3 {
    const targetVelocity = new THREE.Vector3(0, 0, 0)

    if (inputDirection && inputDirection.length() > 0.01) {
      targetVelocity.x = inputDirection.x * this.maxMoveSpeed
      targetVelocity.z = inputDirection.z * this.maxMoveSpeed
    }

    // Y velocity is always 0 (grounded movement)
    targetVelocity.y = 0

    return targetVelocity
  }

  /**
   * Smooth velocity towards target using acceleration
   */
  private smoothVelocity(targetVelocity: THREE.Vector3, deltaTime: number): THREE.Vector3 {
    if (!this.rigidBodyComponent) return targetVelocity

    this.rigidBodyComponent.getVelocity(this._currentVelocity)
    const maxDelta = this.acceleration * deltaTime

    // Smooth X and Z velocities
    const smoothedVelocity = new THREE.Vector3()
    smoothedVelocity.x = this.moveTowards(this._currentVelocity.x, targetVelocity.x, maxDelta)
    smoothedVelocity.z = this.moveTowards(this._currentVelocity.z, targetVelocity.z, maxDelta)
    smoothedVelocity.y = 0 // Keep grounded

    return smoothedVelocity
  }

  /**
   * Update rotation smoothly towards movement direction using quaternion slerp
   */
  private updateRotation(inputDirection: THREE.Vector3 | null, deltaTime: number): void {
    // Always clear angular velocity first to prevent unwanted spinning
    if (this.rigidBodyComponent) {
      const rigidBody = this.rigidBodyComponent.getRigidBody()
      if (rigidBody) {
        // Stop any existing angular rotation to prevent spinning
        this.rigidBodyComponent.setAngularVelocity(new THREE.Vector3(0, 0, 0))
      }
    }

    // If no input direction, don't update rotation - just ensure rotation is stopped
    if (!inputDirection || inputDirection.length() < 0.01) {
      // We've already cleared angular velocity above, so just return
      return
    }

    // Calculate target rotation based on movement direction
    const targetRotationY = Math.atan2(inputDirection.x, inputDirection.z)

    // Create target quaternion
    const targetQuaternion = new THREE.Quaternion()
    targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetRotationY)

    // Get current quaternion
    const currentQuaternion = new THREE.Quaternion()
    currentQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentRotationY)

    // Calculate slerp factor based on turn speed
    const slerpFactor = Math.min(1.0, this.turnSpeed * deltaTime)

    // Slerp between current and target rotation
    const resultQuaternion = new THREE.Quaternion()
    resultQuaternion.slerpQuaternions(currentQuaternion, targetQuaternion, slerpFactor)

    // Update current rotation Y for tracking
    const euler = new THREE.Euler()
    euler.setFromQuaternion(resultQuaternion, "YXZ")
    this.currentRotationY = euler.y

    // Apply rotation through physics body if available, otherwise directly to GameObject
    if (this.rigidBodyComponent) {
      const rigidBody = this.rigidBodyComponent.getRigidBody()
      if (rigidBody) {
        // Apply to physics body (this will sync back to GameObject automatically)
        const rapierQuat = {
          x: resultQuaternion.x,
          y: resultQuaternion.y,
          z: resultQuaternion.z,
          w: resultQuaternion.w,
        }
        rigidBody.setRotation(rapierQuat, true)
      } else {
        // Fallback: apply rotation directly to GameObject
        this.gameObject.rotation.y = this.currentRotationY
      }
    } else {
      // Fallback: apply rotation directly to GameObject
      this.gameObject.rotation.y = this.currentRotationY
    }
  }

  /**
   * Utility function to move a value towards a target at a given rate
   */
  private moveTowards(current: number, target: number, maxDelta: number): number {
    const delta = target - current
    if (Math.abs(delta) <= maxDelta) {
      return target
    }
    return current + Math.sign(delta) * maxDelta
  }

  /**
   * Get current movement state for debugging
   */
  public getMovementState(): any {
    return {
      maxMoveSpeed: this.maxMoveSpeed,
      acceleration: this.acceleration,
      turnSpeed: this.turnSpeed,
      currentRotationY: this.currentRotationY,
      targetRotationY: this.targetRotationY,
      hasRigidBody: !!this.rigidBodyComponent,
    }
  }

  /**
   * Clean up resources when the component is removed
   */
  protected onCleanup(): void {
    this.rigidBodyComponent = null
  }
}
