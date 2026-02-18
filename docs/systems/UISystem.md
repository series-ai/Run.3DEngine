# UISystem

UI utilities and loading screen management.

## Quick Start

```typescript
import { UISystem } from "@series-inc/rundot-3d-engine/systems"

// Show loading screen
UISystem.showLoadingScreen()

// Hide loading screen
UISystem.hideLoadingScreen()

// Create UI elements (use standard HTML/CSS)
const button = document.createElement("button")
button.textContent = "Click Me"
button.style.position = "absolute"
button.style.top = "50%"
button.style.left = "50%"
document.body.appendChild(button)
```

## Common Use Cases

### Loading Screen

```typescript
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        UISystem.showLoadingScreen()
        
        // Load assets
        await this.loadAssets()
        
        UISystem.hideLoadingScreen()
    }
}
```

### HUD Elements

```typescript
class ScoreDisplay {
    private scoreElement: HTMLDivElement
    
    constructor() {
        this.scoreElement = document.createElement("div")
        this.scoreElement.style.position = "absolute"
        this.scoreElement.style.top = "20px"
        this.scoreElement.style.right = "20px"
        this.scoreElement.style.color = "white"
        this.scoreElement.style.fontSize = "24px"
        document.body.appendChild(this.scoreElement)
    }
    
    updateScore(score: number): void {
        this.scoreElement.textContent = `Score: ${score}`
    }
}
```

## API Overview

- `showLoadingScreen()` - Show loading overlay
- `hideLoadingScreen()` - Hide loading overlay
- Use standard DOM APIs for custom UI

## Related Systems

- [VenusGame](../core/VenusGame.md) - Game initialization

