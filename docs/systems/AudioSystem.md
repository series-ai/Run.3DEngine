# AudioSystem

2D and 3D audio playback with music management and volume control.

## Quick Start

```typescript
import { AudioSystem, Audio2D } from "@series-ai/rundot-3d-engine/systems"

// Play 2D sound effect
const sfx = new Audio2D("SFX/click.ogg")
sfx.play()

// Play music
AudioSystem.playMusic("Music/track_01.ogg", { loop: true, volume: 0.5 })
```

## Common Use Cases

### Sound Effects

```typescript
class Button extends Component {
    private clickSound?: Audio2D
    
    protected onCreate(): void {
        this.clickSound = new Audio2D("SFX/click.ogg")
        this.gameObject.addComponent(this.clickSound)
    }
    
    private onClick(): void {
        this.clickSound?.play()
    }
}
```

### Background Music

```typescript
class MyGame extends VenusGame {
    protected async onStart(): Promise<void> {
        // Play looping music
        AudioSystem.playMusic("Music/track_01.ogg", {
            loop: true,
            volume: 0.7,
            fadeInDuration: 2.0
        })
    }
}
```

### Volume Control

```typescript
// Master volume
AudioSystem.mainListener?.setMasterVolume(0.5)

// Individual sound volume
sfx.setVolume(0.8)
```

## API Overview

### AudioSystem
- `playMusic(path, options?)` - Play background music
- `stopMusic(fadeOutDuration?)` - Stop music
- `mainListener` - Global audio listener

### Audio2D Component
- `play()` - Play sound
- `stop()` - Stop sound
- `setVolume(volume)` - Set volume (0-1)
- `setLoop(loop)` - Enable/disable looping

## Related Systems

- [VenusGame](../core/VenusGame.md) - Creates audio listener
- [Component](../core/Component.md) - Audio2D is a component

