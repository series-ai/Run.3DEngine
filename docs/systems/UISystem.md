# UISystem

HTML-based UI system with HUD elements, modals, buttons, progress bars, world-space UI, and responsive scaling.

## Quick Start

```typescript
import { UISystem, UILoadingScreen } from "@series-inc/rundot-3d-engine/systems"

// Initialize (called by VenusGame)
UISystem.initialize()

// Create a HUD element
const health = UISystem.createHUD("health", "HP: 100", { x: 20, y: 20 })

// Create a button
UISystem.createButton("restart", "Restart", { x: 400, y: 300 }, () => {
  restartGame()
})

// Show/hide loading screen
UILoadingScreen.showLoadingScreen("Loading assets...")
UILoadingScreen.hideLoadingScreen()
```

## HUD Elements

```typescript
// Basic HUD
const score = UISystem.createHUD("score", "Score: 0", { x: 20, y: 20 })

// With custom styling
const health = UISystem.createHUD("health", "HP: 100", { x: 20, y: 60 }, {
  className: "health-bar",
  style: "color: red; font-size: 24px;",
})

// Responsive HUD with anchor-based positioning
const minimap = UISystem.createResponsiveHUD(
  "minimap",
  "<canvas id='minimap'></canvas>",
  { x: 1, y: 0 },      // anchor: top-right
  { x: -20, y: 20 },    // offset from anchor
)

// Update money display (creates or updates)
UISystem.updateMoneyDisplay(500)
```

## Buttons

```typescript
const btn = UISystem.createButton("shop", "Open Shop", { x: 100, y: 400 }, () => {
  openShop()
})
```

## Modals

```typescript
const modal = UISystem.createModal("confirm", "Are you sure?", {
  title: "Confirm Action",
  buttons: [
    { text: "Yes", onClick: () => confirmAction() },
    { text: "Cancel", onClick: () => modal.remove() },
  ],
  width: 400,
  height: 200,
  fullScreenOverlay: true, // backdrop ignores safe areas
})
```

## Progress Bars

```typescript
const loadBar = UISystem.createProgressBar(
  "loading",
  { x: 100, y: 300 },
  { width: 200, height: 20 },
  0, // initial progress
)

// Update progress (0-1)
loadBar.setProgress(0.75)
```

## Interaction Prompts

```typescript
const prompt = UISystem.createInteractionPrompt(
  "door-prompt",
  "Press E to open",
  { x: 400, y: 500 },
)
```

## World-Space UI

UI elements that follow 3D positions in the world.

```typescript
const nameTag = UISystem.createWorldSpaceUI(
  "player-name",
  "<div>Player1</div>",
  new THREE.Vector3(0, 2, 0), // world position
  camera,
  { offset: { x: 0, y: -20 } },
)

// Update all world-space elements each frame
UISystem.updateWorldSpaceElements(camera)
```

## Responsive Scaling

Unity-style Canvas Scaler with configurable reference resolution.

```typescript
// Configure scaling (like Unity's Canvas Scaler)
UISystem.configureScaling(
  1920,   // reference width
  1080,   // reference height
  0.5,    // matchWidthOrHeight (0 = width, 1 = height, 0.5 = blend)
  0.5,    // minScale
  1.5,    // maxScale
)

// Get current scale factor
const scale = UISystem.getUIScale()

// Force update
UISystem.updateResponsiveScale()
```

## Safe Area Insets

```typescript
// Set safe area insets (for mobile notches, etc.)
UISystem.setInsets({ left: 0, top: 44, right: 0, bottom: 34 })
```

## Loading Screen

The loading screen is on a separate `UILoadingScreen` class:

```typescript
import { UILoadingScreen } from "@series-inc/rundot-3d-engine/systems"

// Show with custom message and background
UILoadingScreen.showLoadingScreen("Loading world...", "#1a1a1a")

// Hide with fade-out animation
UILoadingScreen.hideLoadingScreen(true)

// Hide immediately (no fade)
UILoadingScreen.hideLoadingScreen(false)
```

## UIUtils

Utilities for canvas-based world-space UI and drawing.

```typescript
import { UIUtils } from "@series-inc/rundot-3d-engine/systems"

// Create a world-space canvas UI
const { plane, canvas, ctx, texture } = UIUtils.createWorldUI(2, 1, {
  pixelsPerUnit: 128,
  heightOffset: 0.05,
})

// Draw on the canvas
UIUtils.drawRoundedRect(ctx, 10, 10, 200, 40, 8)

// Color and font constants
UIUtils.COLORS.SUCCESS  // "#008200"
UIUtils.COLORS.PRIMARY  // "#3b82f6"
UIUtils.COLORS.DANGER   // "#ef4444"
UIUtils.FONT_FAMILY     // "'Palanquin Dark', sans-serif"
```

## Element Management

```typescript
// Get an element by ID
const el = UISystem.getElement("score")

// Remove an element
UISystem.removeElement("score")

// Show/hide all UI
UISystem.setVisible(false)

// Clear all elements
UISystem.clear()

// Show/hide individual elements
el?.show()
el?.hide()
el?.remove()
```

## API Reference

### UISystem (Static Class)

#### Initialization
- `initialize(): void` — initialize the UI system
- `reset(): void` — reset state (for page refreshes)
- `dispose(): void` — dispose and remove everything

#### Element Creation
- `createHUD(id, content, position, options?): UIElement`
- `createResponsiveHUD(id, content, anchor, offset?, options?): UIElement`
- `createButton(id, text, position, onClick): UIElement`
- `createModal(id, content, options?): UIElement`
- `createInteractionPrompt(id, text, position): UIElement`
- `createProgressBar(id, position, size, progress?): UIProgressBar`
- `createWorldSpaceUI(id, content, worldPosition, camera, options?): UIWorldElement`

#### Element Management
- `getElement(id): UIElement | undefined`
- `removeElement(id): void`
- `clear(): void`
- `setVisible(visible): void`

#### Display Updates
- `updateMoneyDisplay(amount): void`
- `updateWorldSpaceElements(camera): void`

#### Scaling
- `configureScaling(refWidth?, refHeight?, matchWidthOrHeight?, minScale?, maxScale?): void`
- `updateResponsiveScale(): void`
- `getUIScale(): number`
- `getReferenceWidth(): number`

#### Safe Areas
- `setInsets(insets): void`

### UILoadingScreen (Static Class)
- `showLoadingScreen(message?, backgroundColor?): void`
- `hideLoadingScreen(fadeOut?): void`

### UIUtils (Static Class)
- `createWorldUI(worldWidth, worldHeight, options?): { plane, canvas, ctx, texture, worldSize, pixelsPerUnit }`
- `drawRoundedRect(ctx, x, y, width, height, radius): void`
- `initializeCSSVariables(): void`
- `COLORS` — color constants object
- `FONT_FAMILY` — default font family string

### Interfaces

```typescript
interface UIElement {
  id: string
  type: string
  element: HTMLElement
  show(): void
  hide(): void
  remove(): void
}

interface UIProgressBar extends UIElement {
  fillElement: HTMLElement
  setProgress(value: number): void
}

interface UIWorldElement extends UIElement {
  worldPosition: THREE.Vector3
  update(camera: THREE.Camera): void
}
```

## Related Systems

- [VenusGame](../core/VenusGame.md) - Initializes UISystem
- [Component](../core/Component.md) - Use UISystem in component lifecycle
