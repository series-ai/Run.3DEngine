import * as THREE from "three"
import { Component } from "@engine/core"

export interface VirtualJoystickOptions {
  size?: number // Size of the joystick base
  knobSize?: number // Size of the joystick knob
  deadZone?: number // Dead zone radius (0-1)
  maxDistance?: number // Maximum distance for knob movement
  color?: string // Color of the joystick
}

/**
 * Virtual joystick component for mobile/touch input - Three.js version
 * Shows on pointer down, hides on pointer up
 * Provides normalized direction vector for movement
 * Uses HTML/CSS for UI elements
 */
export class VirtualJoystickThree extends Component {
  // Configuration
  private options: Required<VirtualJoystickOptions>

  // Mobile detection
  private static isMobileDevice(): boolean {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    )
  }

  // UI Elements
  private joystickContainer: HTMLElement | null = null
  private joystickBase: HTMLElement | null = null
  private joystickKnob: HTMLElement | null = null
  private mobileHint: HTMLElement | null = null

  // State
  private isActive: boolean = false
  private startPosition: THREE.Vector2 = new THREE.Vector2()
  private currentPosition: THREE.Vector2 = new THREE.Vector2()
  private direction: THREE.Vector2 = new THREE.Vector2()
  private magnitude: number = 0

  // Input tracking
  private joystickPointerId: number | null = null
  private isDragging: boolean = false
  private joystickRadius: number = 0

  // Event handlers (need to bind them for proper cleanup)
  private boundPointerDown = this.onPointerDown.bind(this)
  private boundPointerMove = this.onPointerMove.bind(this)
  private boundPointerUp = this.onPointerUp.bind(this)
  private boundTouchStart = this.onTouchStart.bind(this)
  private boundTouchMove = this.onTouchMove.bind(this)
  private boundTouchEnd = this.onTouchEnd.bind(this)

  constructor(options: VirtualJoystickOptions = {}) {
    super()

    this.options = {
      size: options.size ?? 120,
      knobSize: options.knobSize ?? 40,
      deadZone: options.deadZone ?? 0.15,
      maxDistance: options.maxDistance ?? 50,
      color: options.color ?? "white",
    }

    this.joystickRadius = this.options.maxDistance
  }

  protected onCreate(): void {
    this.createJoystickUI()
    this.createMobileHint()
    this.setupInputHandlers()
  }

  protected onCleanup(): void {
    this.cleanupUI()
    this.removeInputHandlers()
  }

  /**
   * Create the joystick UI elements using HTML/CSS
   */
  private createJoystickUI(): void {
    // Create container for joystick (initially hidden)
    this.joystickContainer = document.createElement("div")
    this.joystickContainer.id = "virtual-joystick-container"
    this.joystickContainer.style.cssText = `
            position: fixed;
            width: ${this.options.size + this.options.knobSize}px;
            height: ${this.options.size + this.options.knobSize}px;
            display: none;
            pointer-events: none;
            z-index: 1000;
            user-select: none;
            touch-action: none;
        `

    // Create joystick base (outer circle)
    this.joystickBase = document.createElement("div")
    this.joystickBase.style.cssText = `
            position: absolute;
            width: ${this.options.size}px;
            height: ${this.options.size}px;
            border: 4px solid ${this.options.color};
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-sizing: border-box;
        `

    // Create joystick knob (inner circle)
    this.joystickKnob = document.createElement("div")
    this.joystickKnob.style.cssText = `
            position: absolute;
            width: ${this.options.knobSize}px;
            height: ${this.options.knobSize}px;
            border: 2px solid ${this.options.color};
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.8);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            transition: none;
            box-sizing: border-box;
        `

    // Add elements to container
    this.joystickContainer.appendChild(this.joystickBase)
    this.joystickContainer.appendChild(this.joystickKnob)

    // Add to document body
    document.body.appendChild(this.joystickContainer)
  }

  /**
   * Create mobile hint for touch controls (only shows on mobile devices)
   */
  private createMobileHint(): void {
    // Only show hint on mobile devices
    if (!VirtualJoystickThree.isMobileDevice()) {
      return
    }

    this.mobileHint = document.createElement("div")
    this.mobileHint.id = "mobile-joystick-hint"
    this.mobileHint.textContent = "Touch & drag to move"
    this.mobileHint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 999;
            pointer-events: none;
            user-select: none;
            border: 2px solid rgba(255, 255, 255, 0.3);
            animation: fadeInOut 4s ease-in-out;
        `

    // Add CSS animation
    if (!document.querySelector("#mobile-hint-styles")) {
      const style = document.createElement("style")
      style.id = "mobile-hint-styles"
      style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    20% { opacity: 1; transform: translateX(-50%) translateY(0px); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0px); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                }
            `
      document.head.appendChild(style)
    }

    document.body.appendChild(this.mobileHint)

    // Remove hint after animation completes
    setTimeout(() => {
      if (this.mobileHint && this.mobileHint.parentNode) {
        this.mobileHint.parentNode.removeChild(this.mobileHint)
        this.mobileHint = null
      }
    }, 4000)
  }

  /**
   * Setup input handlers for pointer and touch events
   */
  private setupInputHandlers(): void {
    // Add both pointer and touch event listeners for maximum compatibility
    document.addEventListener("pointerdown", this.boundPointerDown, {
      passive: false,
    })
    document.addEventListener("pointermove", this.boundPointerMove, {
      passive: false,
    })
    document.addEventListener("pointerup", this.boundPointerUp, {
      passive: false,
    })

    // Touch events as fallback
    document.addEventListener("touchstart", this.boundTouchStart, {
      passive: false,
    })
    document.addEventListener("touchmove", this.boundTouchMove, {
      passive: false,
    })
    document.addEventListener("touchend", this.boundTouchEnd, {
      passive: false,
    })
  }

  /**
   * Remove input handlers
   */
  private removeInputHandlers(): void {
    document.removeEventListener("pointerdown", this.boundPointerDown)
    document.removeEventListener("pointermove", this.boundPointerMove)
    document.removeEventListener("pointerup", this.boundPointerUp)

    document.removeEventListener("touchstart", this.boundTouchStart)
    document.removeEventListener("touchmove", this.boundTouchMove)
    document.removeEventListener("touchend", this.boundTouchEnd)
  }

  /**
   * Handle pointer down event
   */
  private onPointerDown(event: PointerEvent): void {
    // Only respond to primary pointer (first touch/click)
    if (this.isActive || !event.isPrimary) return

    this.startJoystick(event.clientX, event.clientY, event.pointerId)
    event.preventDefault()
  }

  /**
   * Handle touch start event (fallback)
   */
  private onTouchStart(event: TouchEvent): void {
    if (this.isActive || event.touches.length === 0) return

    const touch = event.touches[0]
    this.startJoystick(touch.clientX, touch.clientY, touch.identifier)
    event.preventDefault()
  }

  /**
   * Start the joystick at the given position
   */
  private startJoystick(x: number, y: number, pointerId: number): void {
    this.isActive = true
    this.isDragging = true
    this.joystickPointerId = pointerId

    // Hide mobile hint when joystick is first used
    if (this.mobileHint && this.mobileHint.parentNode) {
      this.mobileHint.parentNode.removeChild(this.mobileHint)
      this.mobileHint = null
    }

    // Set positions
    this.startPosition.set(x, y)
    this.currentPosition.set(x, y)

    // Show and position the joystick
    if (this.joystickContainer) {
      this.joystickContainer.style.display = "block"
      this.joystickContainer.style.left = `${x - (this.options.size + this.options.knobSize) / 2}px`
      this.joystickContainer.style.top = `${y - (this.options.size + this.options.knobSize) / 2}px`
    }

    // Reset knob to center
    if (this.joystickKnob) {
      this.joystickKnob.style.transform = "translate(-50%, -50%)"
    }

    this.updateDirection()
  }

  /**
   * Handle pointer move event
   */
  private onPointerMove(event: PointerEvent): void {
    if (
      !this.isActive ||
      !this.isDragging ||
      event.pointerId !== this.joystickPointerId
    ) {
      return
    }

    this.updateJoystick(event.clientX, event.clientY)
    event.preventDefault()
  }

  /**
   * Handle touch move event (fallback)
   */
  private onTouchMove(event: TouchEvent): void {
    if (!this.isActive || !this.isDragging) return

    // Find the touch with our ID
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i]
      if (touch.identifier === this.joystickPointerId) {
        this.updateJoystick(touch.clientX, touch.clientY)
        event.preventDefault()
        break
      }
    }
  }

  /**
   * Update joystick position and direction
   */
  private updateJoystick(x: number, y: number): void {
    this.currentPosition.set(x, y)

    // Update knob position and direction
    this.updateKnobPosition()
    this.updateDirection()
  }

  /**
   * Handle pointer up event
   */
  private onPointerUp(event: PointerEvent): void {
    if (!this.isActive || event.pointerId !== this.joystickPointerId) {
      return
    }

    this.endJoystick()
    event.preventDefault()
  }

  /**
   * Handle touch end event (fallback)
   */
  private onTouchEnd(event: TouchEvent): void {
    if (!this.isActive) return

    // Check if our touch ended
    let touchEnded = true
    for (let i = 0; i < event.touches.length; i++) {
      if (event.touches[i].identifier === this.joystickPointerId) {
        touchEnded = false
        break
      }
    }

    if (touchEnded) {
      this.endJoystick()
      event.preventDefault()
    }
  }

  /**
   * End the joystick interaction
   */
  private endJoystick(): void {
    this.isActive = false
    this.isDragging = false
    this.joystickPointerId = null

    // Hide the joystick
    if (this.joystickContainer) {
      this.joystickContainer.style.display = "none"
    }

    // Reset direction
    this.direction.set(0, 0)
    this.magnitude = 0
  }

  /**
   * Update knob position based on current pointer position
   */
  private updateKnobPosition(): void {
    if (!this.joystickKnob) return

    // Calculate offset from joystick center
    const offset = this.currentPosition.clone().sub(this.startPosition)

    // Clamp to max distance
    const distance = offset.length()
    if (distance > this.joystickRadius) {
      offset.normalize().multiplyScalar(this.joystickRadius)
    }

    // Update knob position
    this.joystickKnob.style.transform = `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`
  }

  /**
   * Update direction vector based on knob position
   */
  private updateDirection(): void {
    // Calculate offset from center
    const offset = this.currentPosition.clone().sub(this.startPosition)
    const distance = offset.length()

    // Apply dead zone
    if (distance < this.options.deadZone * this.joystickRadius) {
      this.direction.set(0, 0)
      this.magnitude = 0
      return
    }

    // Calculate normalized direction
    const normalizedDistance = Math.min(distance / this.joystickRadius, 1.0)
    this.direction = offset.normalize()
    this.magnitude = normalizedDistance
  }

  /**
   * Get the current input direction as a Vector3 (Y=0 for movement)
   */
  public getDirection(): THREE.Vector3 | null {
    if (!this.isActive || this.magnitude === 0) {
      return null
    }

    // Convert 2D joystick input to 3D movement direction
    // X maps to X (left/right), Y maps to Z (forward/back)
    // Screen: drag up = negative Y, drag down = positive Y
    // World: forward = positive Z, back = negative Z
    // So: worldZ = -screenY (drag up = move forward)
    return new THREE.Vector3(
      this.direction.x * this.magnitude,
      0,
      -this.direction.y * this.magnitude,
    )
  }

  /**
   * Get the current input magnitude (0-1)
   */
  public getMagnitude(): number {
    return this.magnitude
  }

  /**
   * Check if the joystick is currently active
   */
  public isActiveJoystick(): boolean {
    return this.isActive
  }

  /**
   * Clean up UI resources
   */
  private cleanupUI(): void {
    if (this.joystickContainer && this.joystickContainer.parentNode) {
      this.joystickContainer.parentNode.removeChild(this.joystickContainer)
    }

    if (this.mobileHint && this.mobileHint.parentNode) {
      this.mobileHint.parentNode.removeChild(this.mobileHint)
    }

    this.joystickContainer = null
    this.joystickBase = null
    this.joystickKnob = null
    this.mobileHint = null
  }
}
