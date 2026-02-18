/**
 * Simple centralized input management system
 * Just tracks key state - gameplay logic stays in components
 */

export enum InputAction {
  MOVE_FORWARD = "move_forward",
  MOVE_BACKWARD = "move_backward",
  MOVE_LEFT = "move_left",
  MOVE_RIGHT = "move_right",
  RUN = "run",
}

/**
 * Default key bindings - can be customized later
 */
export const DEFAULT_KEY_BINDINGS: Record<InputAction, string> = {
  [InputAction.MOVE_FORWARD]: "KeyW",
  [InputAction.MOVE_BACKWARD]: "KeyS",
  [InputAction.MOVE_LEFT]: "KeyA",
  [InputAction.MOVE_RIGHT]: "KeyD",
  [InputAction.RUN]: "ShiftLeft",
}

/**
 * Centralized Input Manager - Singleton
 * Simple API for checking if keys/actions are currently pressed
 */
export class InputManager {
  private static instance: InputManager

  // Input state
  private activeKeys = new Set<string>()
  private keyBindings: Record<InputAction, string> = {
    ...DEFAULT_KEY_BINDINGS,
  }
  private isEnabled = true

  // Bound event listeners for proper cleanup
  private boundKeyDown = this.onKeyDown.bind(this)
  private boundKeyUp = this.onKeyUp.bind(this)
  private boundWindowBlur = this.onWindowBlur.bind(this)

  private constructor() {
    this.setupEventListeners()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager()
    }
    return InputManager.instance
  }

  /**
   * Initialize the input system (call this in VenusGame)
   */
  public static initialize(): void {
    InputManager.getInstance()
    // InputManager initialized
  }

  /**
   * Setup DOM event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener("keydown", this.boundKeyDown)
    document.addEventListener("keyup", this.boundKeyUp)
    window.addEventListener("blur", this.boundWindowBlur)
  }

  /**
   * Handle key down events
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return

    // Prevent default for game keys to avoid browser shortcuts
    if (this.isGameKey(event.code)) {
      event.preventDefault()
    }

    this.activeKeys.add(event.code)
  }

  /**
   * Handle key up events
   */
  private onKeyUp(event: KeyboardEvent): void {
    this.activeKeys.delete(event.code)
  }

  /**
   * Handle window blur to prevent stuck keys
   */
  private onWindowBlur(): void {
    this.activeKeys.clear()
  }

  /**
   * Check if a specific action is currently pressed
   */
  public isActionPressed(action: InputAction): boolean {
    if (!this.isEnabled) return false

    const keyCode = this.keyBindings[action]
    return this.activeKeys.has(keyCode)
  }

  /**
   * Check if a specific key code is currently pressed
   */
  public isKeyPressed(keyCode: string): boolean {
    return this.isEnabled && this.activeKeys.has(keyCode)
  }

  /**
   * Enable/disable input processing
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (!enabled) {
      this.activeKeys.clear()
    }
  }

  /**
   * Update key binding for an action
   */
  public setKeyBinding(action: InputAction, keyCode: string): void {
    this.keyBindings[action] = keyCode
  }

  /**
   * Check if a key code is used by the game (for preventDefault)
   */
  private isGameKey(keyCode: string): boolean {
    return Object.values(this.keyBindings).includes(keyCode)
  }

  /**
   * Get all currently active keys (for debugging)
   */
  public getActiveKeys(): string[] {
    return Array.from(this.activeKeys)
  }

  /**
   * Cleanup - remove event listeners
   */
  public dispose(): void {
    document.removeEventListener("keydown", this.boundKeyDown)
    document.removeEventListener("keyup", this.boundKeyUp)
    window.removeEventListener("blur", this.boundWindowBlur)
    this.activeKeys.clear()
  }
}

// Export simple convenience functions - just key state checking
export const Input = {
  isPressed: (action: InputAction) => InputManager.getInstance().isActionPressed(action),
  isKeyPressed: (keyCode: string) => InputManager.getInstance().isKeyPressed(keyCode),
  setEnabled: (enabled: boolean) => InputManager.getInstance().setEnabled(enabled),
}
