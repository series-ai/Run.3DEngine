# AudioSystem

Bank-based 2D and 3D audio playback with music management, volume control, and playlist support.

## Quick Start

```typescript
import {
  AudioSystem,
  Audio2D,
  Main2DAudioBank,
  PopulateAudioBank2D,
  PlayAudioOneShot2D,
  SetMasterVolume,
} from "@series-inc/rundot-3d-engine/systems"

// 1. Initialize the audio system
AudioSystem.initialize()

// 2. Populate an audio bank with clips
await PopulateAudioBank2D(AudioSystem, Main2DAudioBank, [
  { path: "SFX/click.ogg" },
  { path: "SFX/jump.ogg", volume: 0.8 },
])

// 3. Play a one-shot sound
PlayAudioOneShot2D(Main2DAudioBank, "SFX/click.ogg")
```

## Architecture

The audio system uses an **audio bank** pattern. Clips are loaded into bank objects (`AudioBank2D` / `AudioBank3D`), then played via standalone functions or components.

### Audio Banks

```typescript
import {
  Main2DAudioBank,
  Main3DAudioBank,
  PopulateAudioBank2D,
  PopulateAudioBank3D,
} from "@series-inc/rundot-3d-engine/systems"

// Populate 2D audio bank
await PopulateAudioBank2D(AudioSystem, Main2DAudioBank, [
  { path: "SFX/click.ogg" },
  { path: "SFX/jump.ogg", volume: 0.5 },
])

// Populate 3D positional audio bank
await PopulateAudioBank3D(AudioSystem, Main3DAudioBank, [
  { path: "SFX/footstep.ogg" },
  { path: "SFX/explosion.ogg", volume: 0.9 },
])
```

### Playing Sounds

```typescript
import {
  PlayAudioOneShot2D,
  PlayAudioOneShot3D,
  PlayAudioRandom2D,
} from "@series-inc/rundot-3d-engine/systems"

// Play a 2D sound (non-positional)
PlayAudioOneShot2D(Main2DAudioBank, "SFX/click.ogg")

// Play a random 2D sound from a list
const chosen = PlayAudioRandom2D(Main2DAudioBank, [
  "SFX/hit_01.ogg",
  "SFX/hit_02.ogg",
  "SFX/hit_03.ogg",
])

// Play a 3D positional sound at an object's position
PlayAudioOneShot3D(Main3DAudioBank, "SFX/explosion.ogg", myGameObject.threeObject)
```

## Components

### Audio2D

A component for playing 2D audio clips with an optional allow-list of clip names.

```typescript
import { Audio2D } from "@series-inc/rundot-3d-engine/systems"

class Button extends Component {
  private clickSound?: Audio2D

  protected onCreate(): void {
    // Optional: restrict to specific clips
    this.clickSound = new Audio2D(["SFX/click.ogg", "SFX/hover.ogg"])
    this.gameObject.addComponent(this.clickSound)
  }

  private onClick(): void {
    this.clickSound?.play("SFX/click.ogg")
  }
}
```

#### Constructor

```typescript
new Audio2D(availableClips?: string[])
```

- `availableClips` — optional array of clip names this component is allowed to play

#### Methods

- `play(clipName: string): void` — play a clip (validates against available clips if set)
- `isClipReady(clipName: string): boolean` — check if a clip is loaded in the bank
- `getAvailableClips(): string[]` — get the list of available clips
- `addAvailableClip(clipName: string): void` — add a clip to the available list
- `removeAvailableClip(clipName: string): void` — remove a clip from the available list

### RandomAudio2D

A component that plays a random clip from a list, with optional repeat avoidance.

```typescript
import { RandomAudio2D } from "@series-inc/rundot-3d-engine/systems"

class Enemy extends Component {
  private hitSounds?: RandomAudio2D

  protected onCreate(): void {
    this.hitSounds = new RandomAudio2D(
      ["SFX/hit_01.ogg", "SFX/hit_02.ogg", "SFX/hit_03.ogg"],
      true // avoid immediate repeats
    )
    this.gameObject.addComponent(this.hitSounds)
  }

  private onHit(): void {
    this.hitSounds?.play() // plays a random clip
  }
}
```

#### Constructor

```typescript
new RandomAudio2D(clipNames: string[], avoidImmediateRepeat?: boolean)
```

- `clipNames` — array of clip names to randomly choose from
- `avoidImmediateRepeat` — if `true`, won't play the same clip twice in a row (default: `true`)

#### Methods

- `play(): string` — play a random clip, returns the chosen clip name
- `setClips(clipNames: string[]): void` — replace the clip list
- `getClips(): string[]` — get a copy of the clip list
- `addClip(clipName: string): void` — add a clip (no duplicates)
- `removeClip(clipName: string): void` — remove a clip
- `isReady(): boolean` — check if at least one clip is loaded

## Music System

A dedicated module for background music with crossfading and playlist support.

```typescript
import {
  MusicBank,
  PopulateMusicBank,
  PlayMusic,
  StopMusic,
  CrossfadeToMusic,
  StartPlaylist,
} from "@series-inc/rundot-3d-engine/systems"

// Load music tracks
await PopulateMusicBank(AudioSystem, MusicBank, [
  "Music/track_01.ogg",
  "Music/track_02.ogg",
  "Music/boss_theme.ogg",
])

// Play a track
PlayMusic(MusicBank, "Music/track_01.ogg")

// Crossfade to another track (2 second fade)
CrossfadeToMusic(MusicBank, "Music/boss_theme.ogg", 2000)

// Start a playlist
StartPlaylist(MusicBank, ["Music/track_01.ogg", "Music/track_02.ogg"])
```

### Music Functions

- `PopulateMusicBank(systemInstance, musicBank, musicList): Promise<void>` — load music tracks into a bank
- `PlayMusic(musicBank, trackName, loop?): void` — play a track (default: loops)
- `PauseMusic(musicBank): void` — pause current music
- `ResumeMusic(musicBank): void` — resume paused music
- `StopMusic(musicBank): void` — stop current music
- `SetMusicVolume(volume, musicBank): void` — set music volume (0–1)
- `ToggleMusic(musicBank): void` — toggle play/pause
- `IsMusicReady(musicBank, trackName): boolean` — check if a track is loaded
- `GetMusicSystemState(): MusicSystemState` — get current state snapshot
- `CrossfadeToMusic(musicBank, newTrackName, fadeDuration?, loop?): void` — crossfade to a new track (default: 2000ms)
- `StartPlaylist(musicBank, trackNames, startIndex?): void` — start a playlist
- `StopPlaylist(musicBank): void` — stop the playlist
- `StartMusicWithAutoplayHandling(musicBank, trackName, loop?): void` — play music with browser autoplay handling
- `StartPlaylistWithAutoplayHandling(musicBank, trackNames): void` — start playlist with browser autoplay handling

### MusicSystemState

```typescript
interface MusicSystemState {
  currentTrack: string | null
  isPlaying: boolean
  isPaused: boolean
  volume: number
  loop: boolean
  playlist: string[]
  playlistIndex: number
  playlistActive: boolean
}
```

## Volume Control

```typescript
import {
  SetMasterVolume,
  GetMasterVolume,
  SetAudioMuted,
  IsAudioMuted,
} from "@series-inc/rundot-3d-engine/systems"

// Master volume (0-1)
SetMasterVolume(0.5)
const vol = GetMasterVolume()

// Mute/unmute all audio
SetAudioMuted(true)
const muted = IsAudioMuted()
```

## API Reference

### AudioSystem Object

- `mainListener: THREE.AudioListener | null` — the global audio listener
- `initialize(): void` — initialize the audio system

### Standalone Functions

| Function | Description |
|---|---|
| `PopulateAudioBank2D(system, bank, clips)` | Load 2D audio clips into a bank |
| `PopulateAudioBank3D(system, bank, clips)` | Load 3D positional audio clips into a bank |
| `PlayAudioOneShot2D(bank, clipName)` | Play a 2D clip |
| `PlayAudioOneShot3D(bank, clipName, parentObject)` | Play a 3D clip at an object's position |
| `PlayAudioRandom2D(bank, clipNames)` | Play a random 2D clip from a list |
| `SetMasterVolume(volume)` | Set master volume (0–1) |
| `GetMasterVolume()` | Get current master volume |
| `SetAudioMuted(muted)` | Mute/unmute all audio |
| `IsAudioMuted()` | Check if audio is muted |

### Type Definitions

```typescript
type AudioBank2D = { [key: string]: THREE.Audio }
type AudioBank3D = { [key: string]: THREE.PositionalAudio }

interface AudioClip2DConfig {
  path: string
  volume?: number
}

interface AudioClip3DConfig {
  path: string
  volume?: number
}
```

## Related Systems

- [VenusGame](../core/VenusGame.md) - Creates audio listener
- [Component](../core/Component.md) - Audio2D and RandomAudio2D are components
- [StowKitSystem](StowKitSystem.md) - Can load audio assets
