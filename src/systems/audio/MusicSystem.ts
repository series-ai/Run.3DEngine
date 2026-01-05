import * as THREE from "three"
import { AudioSystem, AudioSystemInstance } from "./AudioSystem"

export const MusicBank: MusicBankType = {}

export type MusicBankType = {
  [key: string]: THREE.Audio
}

export interface MusicSystemState {
  currentTrack: string | null
  isPlaying: boolean
  isPaused: boolean
  volume: number
  loop: boolean
}

export const MusicSystem: MusicSystemState = {
  currentTrack: null,
  isPlaying: false,
  isPaused: false,
  volume: 0.5, // Default to 50% volume for background music
  loop: true,
}

/**
 * Populate the music bank with audio files
 * @param systemInstance - The audio system instance
 * @param musicBank - The music bank to populate
 * @param musicList - Array of music file paths
 */
export async function PopulateMusicBank(
  systemInstance: AudioSystemInstance,
  musicBank: MusicBankType,
  musicList: string[],
): Promise<void> {
  const loadPromises = musicList.map((musicFile) => {
    return new Promise<void>((resolve, reject) => {
      if (systemInstance.mainListener) {
        musicBank[musicFile] = new THREE.Audio(systemInstance.mainListener)
      } else {
        console.error("Main listener is not set in AudioSystemInstance")
        reject(new Error(`Main listener is not set for ${musicFile}`))
        return
      }

      const audioLoader = new THREE.AudioLoader()
      audioLoader.load(
        musicFile,
        function (buffer) {
          musicBank[musicFile].setBuffer(buffer)
          musicBank[musicFile].setLoop(true) // Music should loop by default
          musicBank[musicFile].setVolume(MusicSystem.volume)
          console.log(`✅ Music loaded: ${musicFile}`)
          resolve()
        },
        undefined, // progress callback
        function (error) {
          console.error(`Failed to load music file: ${musicFile}`, error)
          reject(error)
        },
      )
    })
  })

  await Promise.all(loadPromises)
}

/**
 * Play a music track
 * @param musicBank - The music bank
 * @param trackName - Name/path of the music track
 * @param loop - Whether to loop the track (default: true)
 */
export function PlayMusic(
  musicBank: MusicBankType,
  trackName: string,
  loop: boolean = true,
): void {
  if (!musicBank[trackName]) {
    throw new Error(`Music track not found in bank: ${trackName}`)
  }

  if (!musicBank[trackName].buffer) {
    throw new Error(`Music track not loaded yet: ${trackName}`)
  }

  // Stop current track if playing
  if (MusicSystem.currentTrack && MusicSystem.isPlaying) {
    StopMusic(musicBank)
  }

  // Set up new track
  const track = musicBank[trackName]
  track.setLoop(loop)
  track.setVolume(MusicSystem.volume)

  // Play the track
  track.play()

  // Update system state
  MusicSystem.currentTrack = trackName
  MusicSystem.isPlaying = true
  MusicSystem.isPaused = false
  MusicSystem.loop = loop

  console.log(`🎵 Playing music: ${trackName}`)
}

/**
 * Pause the currently playing music
 * @param musicBank - The music bank
 */
export function PauseMusic(musicBank: MusicBankType): void {
  if (
    MusicSystem.currentTrack &&
    MusicSystem.isPlaying &&
    !MusicSystem.isPaused
  ) {
    const track = musicBank[MusicSystem.currentTrack]
    if (track) {
      track.pause()
      MusicSystem.isPaused = true
      console.log(`⏸️ Music paused: ${MusicSystem.currentTrack}`)
    }
  }
}

/**
 * Resume the currently paused music
 * @param musicBank - The music bank
 */
export function ResumeMusic(musicBank: MusicBankType): void {
  if (
    MusicSystem.currentTrack &&
    MusicSystem.isPlaying &&
    MusicSystem.isPaused
  ) {
    const track = musicBank[MusicSystem.currentTrack]
    if (track) {
      track.play()
      MusicSystem.isPaused = false
      console.log(`▶️ Music resumed: ${MusicSystem.currentTrack}`)
    }
  }
}

/**
 * Stop the currently playing music
 * @param musicBank - The music bank
 */
export function StopMusic(musicBank: MusicBankType): void {
  if (MusicSystem.currentTrack && MusicSystem.isPlaying) {
    const track = musicBank[MusicSystem.currentTrack]
    if (track) {
      track.stop()
      console.log(`⏹️ Music stopped: ${MusicSystem.currentTrack}`)
    }
  }

  // Reset system state
  MusicSystem.currentTrack = null
  MusicSystem.isPlaying = false
  MusicSystem.isPaused = false
}

/**
 * Set the volume for music playback
 * @param volume - Volume level (0.0 to 1.0)
 * @param musicBank - The music bank
 */
export function SetMusicVolume(volume: number, musicBank: MusicBankType): void {
  // Clamp volume between 0 and 1
  volume = Math.max(0, Math.min(1, volume))
  MusicSystem.volume = volume

  // Update current playing track if any
  if (MusicSystem.currentTrack && MusicSystem.isPlaying) {
    const track = musicBank[MusicSystem.currentTrack]
    if (track) {
      track.setVolume(volume)
    }
  }

  console.log(`🔊 Music volume set to: ${Math.round(volume * 100)}%`)
}

/**
 * Toggle music playback (play/pause)
 * @param musicBank - The music bank
 */
export function ToggleMusic(musicBank: MusicBankType): void {
  if (MusicSystem.isPlaying && !MusicSystem.isPaused) {
    PauseMusic(musicBank)
  } else if (MusicSystem.isPlaying && MusicSystem.isPaused) {
    ResumeMusic(musicBank)
  }
}

/**
 * Check if a music track is ready to play
 * @param musicBank - The music bank
 * @param trackName - Name/path of the music track
 */
export function IsMusicReady(
  musicBank: MusicBankType,
  trackName: string,
): boolean {
  const track = musicBank[trackName]
  return track && !!track.buffer
}

/**
 * Get the current music system state
 */
export function GetMusicSystemState(): MusicSystemState {
  return { ...MusicSystem }
}

/**
 * Crossfade to a new music track
 * @param musicBank - The music bank
 * @param newTrackName - Name/path of the new music track
 * @param fadeDuration - Duration of the crossfade in milliseconds (default: 2000ms)
 * @param loop - Whether to loop the new track (default: true)
 */
export function CrossfadeToMusic(
  musicBank: MusicBankType,
  newTrackName: string,
  fadeDuration: number = 2000,
  loop: boolean = true,
): void {
  if (!musicBank[newTrackName]) {
    throw new Error(`Music track not found in bank: ${newTrackName}`)
  }

  if (!musicBank[newTrackName].buffer) {
    throw new Error(`Music track not loaded yet: ${newTrackName}`)
  }

  const oldTrack = MusicSystem.currentTrack
    ? musicBank[MusicSystem.currentTrack]
    : null
  const newTrack = musicBank[newTrackName]

  // Set up new track
  newTrack.setLoop(loop)
  newTrack.setVolume(0) // Start at 0 volume
  newTrack.play()

  // Update system state
  MusicSystem.currentTrack = newTrackName
  MusicSystem.isPlaying = true
  MusicSystem.isPaused = false
  MusicSystem.loop = loop

  // Perform crossfade
  const steps = 60 // 60 steps for smooth transition
  const stepDuration = fadeDuration / steps
  const volumeStep = MusicSystem.volume / steps

  let currentStep = 0

  const fadeInterval = setInterval(() => {
    currentStep++
    const progress = currentStep / steps

    // Fade out old track
    if (oldTrack) {
      oldTrack.setVolume(MusicSystem.volume * (1 - progress))
    }

    // Fade in new track
    newTrack.setVolume(MusicSystem.volume * progress)

    if (currentStep >= steps) {
      // Crossfade complete
      clearInterval(fadeInterval)

      // Stop old track
      if (oldTrack) {
        oldTrack.stop()
      }

      console.log(`🎵 Crossfade complete to: ${newTrackName}`)
    }
  }, stepDuration)
}

/**
 * Start music with automatic handling of browser autoplay policies
 * This utility function tries to play music immediately, and if blocked by autoplay policy,
 * it sets up event listeners to start music on first user interaction.
 *
 * @param musicBank - The music bank
 * @param trackName - Name/path of the music track to play
 * @param loop - Whether to loop the track (default: true)
 */
export function StartMusicWithAutoplayHandling(
  musicBank: MusicBankType,
  trackName: string,
  loop: boolean = true,
): void {
  // Try to start playing background music immediately
  try {
    PlayMusic(musicBank, trackName, loop)
    console.log("🎵 Background music started immediately")
    return
  } catch (error) {
    console.log(
      "🎵 Music blocked by autoplay policy, will start on user interaction",
    )
  }

  // Handle browser autoplay policy - start music on first user interaction
  const startMusicOnInteraction = () => {
    try {
      // Resume audio context if suspended
      const context = (AudioSystem.mainListener as any)?.context
      if (context && context.state === "suspended") {
        context.resume()
      }

      // Try to play music if not already playing
      if (!MusicSystem.isPlaying) {
        PlayMusic(musicBank, trackName, loop)
        console.log("🎵 Background music started after user interaction")
      }

      // Remove event listeners after first successful interaction
      document.removeEventListener("click", startMusicOnInteraction)
      document.removeEventListener("keydown", startMusicOnInteraction)
      document.removeEventListener("touchstart", startMusicOnInteraction)
    } catch (error) {
      console.warn("Failed to start music on interaction:", error)
    }
  }

  // Add event listeners for user interaction
  document.addEventListener("click", startMusicOnInteraction)
  document.addEventListener("keydown", startMusicOnInteraction)
  document.addEventListener("touchstart", startMusicOnInteraction) // For mobile devices

  console.log(
    "🎵 Music queued to start on user interaction (click, keypress, or touch)",
  )
}
