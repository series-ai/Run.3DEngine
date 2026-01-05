import * as THREE from "three"

/**
 * Second-order dynamics system for smooth, physics-based animation
 * Based on the critically damped harmonic oscillator
 * Perfect for springy, responsive animations that react to input changes
 */
export class SecondOrderDynamics {
  private k1: number
  private k2: number
  private k3: number
  private xp: THREE.Vector3 // Previous input
  private y: THREE.Vector3  // Current output position
  private yd: THREE.Vector3 // Current output velocity

  /**
   * Create a second-order dynamics system
   * @param f - Frequency (speed of response) - higher = faster response
   * @param z - Damping coefficient - 0 = no damping (oscillates forever), 1 = critically damped, >1 = overdamped
   * @param r - Initial response factor - affects initial "kick" of the animation
   * @param initialValue - Starting position
   */
  constructor(f: number, z: number, r: number, initialValue: THREE.Vector3 = new THREE.Vector3()) {
    // Compute constants
    const pi = Math.PI
    const w = 2 * pi * f // Angular frequency
    const d = w * Math.sqrt(Math.abs(z * z - 1)) // Damped frequency
    
    this.k1 = z / (pi * f)
    this.k2 = 1 / (w * w)
    this.k3 = r * z / w
    
    // Initialize state
    this.xp = initialValue.clone()
    this.y = initialValue.clone()
    this.yd = new THREE.Vector3()
  }

  /**
   * Update the system with a new target position
   * @param x - Target position
   * @param deltaTime - Time step
   * @returns Current smoothed position
   */
  update(x: THREE.Vector3, deltaTime: number): THREE.Vector3 {
    if (deltaTime === 0) {
      return this.y.clone()
    }

    // Estimate velocity from position change
    const xd = new THREE.Vector3()
      .subVectors(x, this.xp)
      .divideScalar(deltaTime)
    
    this.xp.copy(x)

    // Clamp deltaTime to prevent instability
    const T = Math.min(deltaTime, 0.05) // Max 50ms timestep

    // Integrate position by velocity
    this.y.addScaledVector(this.yd, T)

    // Integrate velocity by acceleration
    const acceleration = new THREE.Vector3()
      .addScaledVector(x, 1)
      .addScaledVector(xd, this.k3)
      .addScaledVector(this.y, -1)
      .addScaledVector(this.yd, -this.k1)
      .divideScalar(this.k2)
    
    this.yd.addScaledVector(acceleration, T)

    return this.y.clone()
  }

  /**
   * Get current position without updating
   */
  getCurrentPosition(): THREE.Vector3 {
    return this.y.clone()
  }

  /**
   * Get current velocity
   */
  getCurrentVelocity(): THREE.Vector3 {
    return this.yd.clone()
  }

  /**
   * Reset the system to a new position
   */
  reset(position: THREE.Vector3): void {
    this.xp.copy(position)
    this.y.copy(position)
    this.yd.set(0, 0, 0)
  }
}

/**
 * Simplified 1D version for scalar values
 */
export class SecondOrderDynamics1D {
  private k1: number
  private k2: number
  private k3: number
  private xp: number // Previous input
  private y: number  // Current output position
  private yd: number // Current output velocity

  constructor(f: number, z: number, r: number, initialValue: number = 0) {
    const pi = Math.PI
    const w = 2 * pi * f
    
    this.k1 = z / (pi * f)
    this.k2 = 1 / (w * w)
    this.k3 = r * z / w
    
    this.xp = initialValue
    this.y = initialValue
    this.yd = 0
  }

  update(x: number, deltaTime: number): number {
    if (deltaTime === 0) return this.y

    const xd = (x - this.xp) / deltaTime
    this.xp = x

    const T = Math.min(deltaTime, 0.05)
    
    this.y += this.yd * T
    
    const acceleration = (x + this.k3 * xd - this.y - this.k1 * this.yd) / this.k2
    this.yd += acceleration * T

    return this.y
  }

  getCurrentValue(): number {
    return this.y
  }

  getCurrentVelocity(): number {
    return this.yd
  }

  reset(value: number): void {
    this.xp = value
    this.y = value
    this.yd = 0
  }
}
