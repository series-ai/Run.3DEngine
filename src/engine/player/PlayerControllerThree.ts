import * as THREE from "three"
import { Component } from "@engine/core"

export interface PlayerControls {
  forward: string
  backward: string
  left: string
  right: string
  run: string
  interact: string
}

/**
 * Three.js Player Controller Component
 * Handles WASD movement, mouse look, and basic interactions
 */
export class PlayerControllerThree extends Component {
  // Movement parameters
  public moveSpeed: number = 5.0
  public runSpeed: number = 8.0
  public rotationSpeed: number = 2.0

  // Controls configuration
  private controls: PlayerControls = {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD",
    run: "ShiftLeft",
    interact: "KeyE",
  }

  // Input state
  private keys: Set<string> = new Set()
  private mouseX: number = 0
  private mouseY: number = 0
  private mouseSensitivity: number = 0.002
  private isPointerLocked: boolean = false

  // Camera reference
  private camera: THREE.PerspectiveCamera
  private cameraHeight: number = 1.7 // Eye level height

  // Movement state
  private velocity: THREE.Vector3 = new THREE.Vector3()
  private direction: THREE.Vector3 = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera) {
    super()
    this.camera = camera
  }

  protected onCreate(): void {
    this.setupEventListeners()
    this.setupPointerLock()

    // Position camera at player eye level
    this.updateCameraPosition()

    console.log("🎮 Player controller initialized")
    console.log(
      "📋 Controls: WASD to move, Shift to run, E to interact, Click to look around",
    )
  }

  /**
   * Set up keyboard and mouse event listeners
   */
  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener("keydown", this.onKeyDown.bind(this))
    document.addEventListener("keyup", this.onKeyUp.bind(this))

    // Mouse events
    document.addEventListener("mousemove", this.onMouseMove.bind(this))
    document.addEventListener("click", this.onClick.bind(this))

    // Pointer lock events
    document.addEventListener(
      "pointerlockchange",
      this.onPointerLockChange.bind(this),
    )
  }

  /**
   * Set up pointer lock for mouse look
   */
  private setupPointerLock(): void {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement
    if (canvas) {
      canvas.addEventListener("click", () => {
        if (!this.isPointerLocked) {
          canvas.requestPointerLock()
        }
      })
    }
  }

  /**
   * Handle key down events
   */
  private onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.code)

    // Handle special keys
    if (event.code === this.controls.interact) {
      this.onInteract()
    }
  }

  /**
   * Handle key up events
   */
  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code)
  }

  /**
   * Handle mouse movement for looking around
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.isPointerLocked) return

    this.mouseX += event.movementX * this.mouseSensitivity
    this.mouseY += event.movementY * this.mouseSensitivity

    // Clamp vertical rotation
    this.mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouseY))

    // Apply rotation to camera
    this.camera.rotation.order = "YXZ"
    this.camera.rotation.y = -this.mouseX
    this.camera.rotation.x = -this.mouseY
  }

  /**
   * Handle canvas clicks for pointer lock
   */
  private onClick(event: MouseEvent): void {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement
    if (event.target === canvas && !this.isPointerLocked) {
      canvas.requestPointerLock()
    }
  }

  /**
   * Handle pointer lock state changes
   */
  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement !== null

    if (this.isPointerLocked) {
      console.log("🖱️ Mouse locked - look around!")
    } else {
      console.log("🖱️ Mouse unlocked - click canvas to lock again")
    }
  }

  /**
   * Handle interaction key press
   */
  private onInteract(): void {
    console.log("🤝 Player trying to interact...")
    // TODO: Implement interaction system
  }

  /**
   * Update method - called every frame
   */
  public update(deltaTime: number): void {
    this.updateMovement(deltaTime)
    this.updateCameraPosition()
  }

  /**
   * Update player movement based on input
   */
  private updateMovement(deltaTime: number): void {
    // Reset direction
    this.direction.set(0, 0, 0)

    // Get current movement speed
    const isRunning = this.keys.has(this.controls.run)
    const currentSpeed = isRunning ? this.runSpeed : this.moveSpeed

    // Calculate movement direction based on camera orientation
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()

    // Get camera's forward direction (ignoring Y rotation for ground movement)
    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    // Get camera's right direction
    right.crossVectors(forward, this.camera.up).normalize()

    // Apply movement inputs
    if (this.keys.has(this.controls.forward)) {
      this.direction.add(forward)
    }
    if (this.keys.has(this.controls.backward)) {
      this.direction.sub(forward)
    }
    if (this.keys.has(this.controls.right)) {
      this.direction.add(right)
    }
    if (this.keys.has(this.controls.left)) {
      this.direction.sub(right)
    }

    // Normalize direction to prevent faster diagonal movement
    if (this.direction.length() > 0) {
      this.direction.normalize()

      // Apply movement to player position
      this.velocity
        .copy(this.direction)
        .multiplyScalar(currentSpeed * deltaTime)
      this.gameObject.position.add(this.velocity)
    }

    // Keep player on ground level (no Y drift)
    this.gameObject.position.y = 0
  }

  /**
   * Update camera position to follow player
   */
  private updateCameraPosition(): void {
    // Position camera at player position + eye height
    this.camera.position.copy(this.gameObject.position)
    this.camera.position.y += this.cameraHeight
  }

  /**
   * Get current movement state for debugging
   */
  public getMovementState(): {
    position: THREE.Vector3
    isMoving: boolean
    isRunning: boolean
    lookDirection: THREE.Vector3
  } {
    const lookDirection = new THREE.Vector3()
    this.camera.getWorldDirection(lookDirection)

    return {
      position: this.gameObject.position.clone(),
      isMoving: this.direction.length() > 0,
      isRunning: this.keys.has(this.controls.run),
      lookDirection: lookDirection,
    }
  }

  /**
   * Set player position
   */
  public setPosition(position: THREE.Vector3): void {
    this.gameObject.position.copy(position)
    this.updateCameraPosition()
  }

  /**
   * Clean up event listeners
   */
  protected onCleanup(): void {
    document.removeEventListener("keydown", this.onKeyDown.bind(this))
    document.removeEventListener("keyup", this.onKeyUp.bind(this))
    document.removeEventListener("mousemove", this.onMouseMove.bind(this))
    document.removeEventListener("click", this.onClick.bind(this))
    document.removeEventListener(
      "pointerlockchange",
      this.onPointerLockChange.bind(this),
    )

    // Exit pointer lock if active
    if (this.isPointerLocked) {
      document.exitPointerLock()
    }

    console.log("🎮 Player controller cleaned up")
  }
}
