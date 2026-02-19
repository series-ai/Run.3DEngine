# InputManager

Action-based keyboard input system with configurable key bindings.

## Quick Start

```typescript
import { InputManager, InputAction, Input } from "@series-inc/rundot-3d-engine/systems"

// Initialize (called by VenusGame)
InputManager.initialize()

// Check action-based input
if (Input.isPressed(InputAction.MOVE_FORWARD)) {
  player.moveForward()
}

// Check raw key input
if (Input.isKeyPressed("Space")) {
  player.jump()
}
```

## Common Use Cases

### Movement with Actions

```typescript
class PlayerController extends Component {
  public update(deltaTime: number): void {
    const speed = 5

    if (Input.isPressed(InputAction.MOVE_FORWARD)) {
      this.gameObject.position.z -= speed * deltaTime
    }
    if (Input.isPressed(InputAction.MOVE_BACKWARD)) {
      this.gameObject.position.z += speed * deltaTime
    }
    if (Input.isPressed(InputAction.MOVE_LEFT)) {
      this.gameObject.position.x -= speed * deltaTime
    }
    if (Input.isPressed(InputAction.MOVE_RIGHT)) {
      this.gameObject.position.x += speed * deltaTime
    }

    if (Input.isPressed(InputAction.RUN)) {
      // Sprint
    }
  }
}
```

### Raw Key Input

```typescript
class Interaction extends Component {
  public update(deltaTime: number): void {
    if (Input.isKeyPressed("KeyE")) {
      this.interact()
    }
    if (Input.isKeyPressed("Escape")) {
      this.openMenu()
    }
  }
}
```

### Custom Key Bindings

```typescript
const manager = InputManager.getInstance()

// Rebind an action
manager.setKeyBinding(InputAction.RUN, "ShiftRight")

// Disable input (e.g., during menus)
Input.setEnabled(false)

// Re-enable
Input.setEnabled(true)
```

## InputAction Enum

```typescript
enum InputAction {
  MOVE_FORWARD = "move_forward",
  MOVE_BACKWARD = "move_backward",
  MOVE_LEFT = "move_left",
  MOVE_RIGHT = "move_right",
  RUN = "run",
}
```

## Default Key Bindings

```typescript
const DEFAULT_KEY_BINDINGS: Record<InputAction, string> = {
  [InputAction.MOVE_FORWARD]: "KeyW",
  [InputAction.MOVE_BACKWARD]: "KeyS",
  [InputAction.MOVE_LEFT]: "KeyA",
  [InputAction.MOVE_RIGHT]: "KeyD",
  [InputAction.RUN]: "ShiftLeft",
}
```

## Key Codes

Uses the browser `event.code` format:

- Letters: `"KeyW"`, `"KeyA"`, `"KeyS"`, `"KeyD"`, `"KeyE"`, etc.
- Numbers: `"Digit1"`, `"Digit2"`, etc.
- Special: `"Space"`, `"Enter"`, `"Escape"`, `"Tab"`
- Modifiers: `"ShiftLeft"`, `"ShiftRight"`, `"ControlLeft"`, `"AltLeft"`
- Arrows: `"ArrowUp"`, `"ArrowDown"`, `"ArrowLeft"`, `"ArrowRight"`

## API Reference

### Input (Convenience Object)

A shorthand for common InputManager operations:

- `Input.isPressed(action: InputAction): boolean` — check if an action is currently pressed
- `Input.isKeyPressed(keyCode: string): boolean` — check if a specific key code is pressed
- `Input.setEnabled(enabled: boolean): void` — enable/disable input processing

### InputManager (Singleton)

#### Static Methods

- `InputManager.getInstance(): InputManager` — get the singleton instance
- `InputManager.initialize(): void` — initialize the input system (called by VenusGame)

#### Instance Methods

- `isActionPressed(action: InputAction): boolean` — check if an action is pressed
- `isKeyPressed(keyCode: string): boolean` — check if a key code is pressed
- `setKeyBinding(action: InputAction, keyCode: string): void` — rebind a key for an action
- `setEnabled(enabled: boolean): void` — enable/disable input processing
- `getActiveKeys(): string[]` — get all currently pressed keys (for debugging)
- `dispose(): void` — clean up event listeners

## Related Systems

- [VenusGame](../core/VenusGame.md) - Initializes InputManager
- [Component](../core/Component.md) - Use input in update()
