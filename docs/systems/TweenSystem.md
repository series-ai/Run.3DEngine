# TweenSystem

Property animation system with easing functions for smooth transitions.

## Quick Start

```typescript
import { TweenSystem, Easing } from "@series-ai/rundot-3d-engine/systems"

// Animate object property
TweenSystem.tween(
    this,              // Target object
    "alpha",           // Property name
    1.0,               // End value
    0.5,               // Duration (seconds)
    Easing.easeOutQuad // Easing function
)
```

## Common Use Cases

### Fade In/Out

```typescript
class FadeEffect extends Component {
    private alpha: number = 0
    
    public fadeIn(): void {
        const tween = TweenSystem.tween(this, "alpha", 1.0, 0.5, Easing.easeInOutQuad)
        
        tween.onUpdated((value) => {
            // Apply alpha to material
            this.material.opacity = value
        })
        
        tween.onCompleted(() => {
            console.log("Fade in complete!")
        })
    }
}
```

### Scale Pop Animation

```typescript
class Pickup extends Component {
    private tweenScale: number = 1.0
    
    public quickPop(): void {
        this.tweenScale = 1.0
        
        // Pop up
        const popTween = TweenSystem.tween(this, "tweenScale", 1.35, 0.12, Easing.easeOutQuad)
        popTween.onUpdated((value) => {
            this.gameObject.scale.set(value, value, value)
        })
        
        // Then shrink
        popTween.onCompleted(() => {
            const shrinkTween = TweenSystem.tween(this, "tweenScale", 0, 0.3, Easing.easeInOutQuad)
            shrinkTween.onUpdated((value) => {
                this.gameObject.scale.set(value, value, value)
            })
        })
    }
}
```

### Move Object

```typescript
class Mover extends Component {
    public moveTo(targetPos: THREE.Vector3, duration: number): void {
        TweenSystem.tween(this.gameObject.position, "x", targetPos.x, duration, Easing.easeInOutQuad)
        TweenSystem.tween(this.gameObject.position, "y", targetPos.y, duration, Easing.easeInOutQuad)
        TweenSystem.tween(this.gameObject.position, "z", targetPos.z, duration, Easing.easeInOutQuad)
    }
}
```

## Easing Functions

```typescript
Easing.linear           // No easing
Easing.easeInQuad       // Accelerate
Easing.easeOutQuad      // Decelerate
Easing.easeInOutQuad    // Smooth start and end
Easing.easeInCubic      // Stronger acceleration
Easing.easeOutCubic     // Stronger deceleration
Easing.easeInOutCubic   // Smooth cubic
Easing.spring           // Spring physics
Easing.easeOutElastic   // Elastic bounce
Easing.easeOutBack      // Overshoot
Easing.anticipateOvershoot // Go back then overshoot
```

## API Overview

### TweenSystem
- `tween(target, property, endValue, duration, easing)` - Create tween
- `update(deltaTime)` - Update all tweens (automatic)

### Tween
- `onUpdated(callback)` - Called each frame with current value
- `onCompleted(callback)` - Called when tween finishes
- `cancel()` - Stop tween early

## Patterns

### Chain Tweens

```typescript
const tween1 = TweenSystem.tween(this, "x", 10, 1, Easing.easeInOutQuad)
tween1.onCompleted(() => {
    const tween2 = TweenSystem.tween(this, "y", 5, 1, Easing.easeInOutQuad)
})
```

### Parallel Tweens

```typescript
// Multiple properties at once
TweenSystem.tween(obj.position, "x", 10, 1, Easing.linear)
TweenSystem.tween(obj.position, "y", 5, 1, Easing.linear)
TweenSystem.tween(obj.rotation, "y", Math.PI, 1, Easing.linear)
```

## Related Systems

- [VenusGame](../core/VenusGame.md) - Updates TweenSystem automatically
- [Component](../core/Component.md) - Use tweens in components

