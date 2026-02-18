# InputManager

Cross-platform input system for keyboard, mouse, and touch with mobile support.

## Quick Start

```typescript
import { InputManager } from "@series-inc/rundot-3d-engine/systems"

// Check keyboard input
if (InputManager.isKeyDown("w")) {
    player.moveForward()
}

// Check mouse button
if (InputManager.isMouseButtonDown(0)) { // Left click
    fireWeapon()
}

// Get mouse position
const mousePos = InputManager.getMousePosition()
```

## Common Use Cases

### Keyboard Input

```typescript
class PlayerController extends Component {
    public update(deltaTime: number): void {
        const speed = 5
        
        if (InputManager.isKeyDown("w")) {
            this.gameObject.position.z -= speed * deltaTime
        }
        if (InputManager.isKeyDown("s")) {
            this.gameObject.position.z += speed * deltaTime
        }
        if (InputManager.isKeyDown("a")) {
            this.gameObject.position.x -= speed * deltaTime
        }
        if (InputManager.isKeyDown("d")) {
            this.gameObject.position.x += speed * deltaTime
        }
    }
}
```

### Mouse Input

```typescript
// Mouse buttons
if (InputManager.isMouseButtonDown(0)) { // Left
    console.log("Left click")
}
if (InputManager.isMouseButtonDown(2)) { // Right
    console.log("Right click")
}

// Mouse position (screen coordinates)
const pos = InputManager.getMousePosition()
console.log(`Mouse at ${pos.x}, ${pos.y}`)
```

### Touch Input (Mobile)

```typescript
// Touch is automatically mapped to mouse on mobile
// isMouseButtonDown(0) works for taps
// getMousePosition() returns touch position
```

## API Overview

### Keyboard
- `isKeyDown(key: string): boolean` - Check if key is pressed
- `isKeyPressed(key: string): boolean` - Check if key was just pressed this frame
- `isKeyReleased(key: string): boolean` - Check if key was just released

### Mouse
- `isMouseButtonDown(button: number): boolean` - Check mouse button (0=left, 1=middle, 2=right)
- `getMousePosition(): {x: number, y: number}` - Get mouse/touch position
- `getMouseDelta(): {x: number, y: number}` - Get mouse movement since last frame

### System
- `initialize()` - Initialize input (called by VenusGame)
- `update()` - Update input state (automatic)

## Key Codes

Use standard keyboard keys:
- Letters: `"a"`, `"b"`, `"w"`, etc.
- Numbers: `"1"`, `"2"`, etc.
- Special: `"Space"`, `"Enter"`, `"Shift"`, `"Control"`, `"Alt"`
- Arrows: `"ArrowUp"`, `"ArrowDown"`, `"ArrowLeft"`, `"ArrowRight"`

## Related Systems

- [VenusGame](../core/VenusGame.md) - Initializes InputManager
- [Component](../core/Component.md) - Use input in update()

