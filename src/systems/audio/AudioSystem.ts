import * as THREE from "three"

export const AudioSystem: AudioSystemInstance = {
  mainListener: null,
  
  /**
   * Initialize the audio system with proper browser autoplay handling
   * Call this after setting up mainListener to ensure all audio works correctly
   */
  initialize(): void {
    let audioUnlocked = false
    
    const unlockAudioOnInteraction = async () => {
      if (audioUnlocked) return
      
      try {
        // Resume main AudioSystem context (used by Audio2D components)
        const mainContext = (AudioSystem.mainListener as any)?.context
        if (mainContext && mainContext.state === "suspended") {
          await mainContext.resume()
          console.log("🔊 Audio context resumed")
        }

        audioUnlocked = true

        // Remove event listeners after first successful interaction
        document.removeEventListener("click", unlockAudioOnInteraction)
        document.removeEventListener("keydown", unlockAudioOnInteraction)
        document.removeEventListener("touchstart", unlockAudioOnInteraction)
        
        console.log("🎵 Audio system initialized")
      } catch (error) {
        console.warn("Failed to initialize audio:", error)
      }
    }

    // Add event listeners for user interaction to unlock audio
    document.addEventListener("click", unlockAudioOnInteraction)
    document.addEventListener("keydown", unlockAudioOnInteraction) 
    document.addEventListener("touchstart", unlockAudioOnInteraction)
    
    console.log("🎵 Audio system ready - waiting for user interaction")
  }
}

export const Main2DAudioBank: AudioBank2D = {}
export const Main3DAudioBank: AudioBank3D = {}

export type AudioSystemInstance = {
  mainListener: THREE.AudioListener | null
  initialize(): void
}

// Internal master volume state for mute/unmute
let __masterVolume: number = 1.0
let __masterMuted: boolean = false

export type AudioBank2D = {
  [key: string]: THREE.Audio
}

export type AudioBank3D = {
  [key: string]: THREE.PositionalAudio
}

// New config type for loading 2D/3D audio with properties (volume first)
export type AudioClip2DConfig = {
  path: string
  volume?: number
}
export type AudioClip3DConfig = {
  path: string
  volume?: number
}

export async function PopulateAudioBank2D(
  systemInstance: AudioSystemInstance,
  audioBank: AudioBank2D,
  clips: AudioClip2DConfig[],
): Promise<void> {
  const loadPromises = clips.map((cfg) => {
    return new Promise<void>((resolve, reject) => {
      if (systemInstance.mainListener) {
        audioBank[cfg.path] = new THREE.Audio(systemInstance.mainListener)
      } else {
        console.error("Main listener is not set in AudioSystemInstance")
        reject(new Error(`Main listener is not set for ${cfg.path}`))
        return
      }
      const audioLoader = new THREE.AudioLoader()
      audioLoader.load(
        cfg.path,
        function (buffer) {
          audioBank[cfg.path].setBuffer(buffer)
          audioBank[cfg.path].setLoop(false)
          const clipVolume = typeof cfg.volume === "number" ? cfg.volume : 1.0
          audioBank[cfg.path].setVolume(clipVolume)
          resolve()
        },
        undefined, // progress callback
        function (error) {
          console.error(`Failed to load audio file: ${cfg.path}`, error)
          reject(error)
        },
      )
    })
  })

  await Promise.all(loadPromises)
}

export async function PopulateAudioBank3D(
  systemInstance: AudioSystemInstance,
  audioBank: AudioBank3D,
  clips: AudioClip3DConfig[],
): Promise<void> {
  const loadPromises = clips.map((cfg) => {
    return new Promise<void>((resolve, reject) => {
      if (systemInstance.mainListener) {
        audioBank[cfg.path] = new THREE.PositionalAudio(
          systemInstance.mainListener,
        )
      } else {
        console.error("Main listener is not set in AudioSystemInstance")
        reject(new Error(`Main listener is not set for ${cfg.path}`))
        return
      }
      const audioLoader = new THREE.AudioLoader()
      audioLoader.load(
        cfg.path,
        function (buffer) {
          audioBank[cfg.path].setBuffer(buffer)
          audioBank[cfg.path].setRefDistance(20)
          audioBank[cfg.path].setLoop(false)
          const clipVolume = typeof cfg.volume === "number" ? cfg.volume : 1.0
          audioBank[cfg.path].setVolume(clipVolume)
          resolve()
        },
        undefined, // progress callback
        function (error) {
          console.error(`Failed to load audio file: ${cfg.path}`, error)
          reject(error)
        },
      )
    })
  })

  await Promise.all(loadPromises)
}

export function PlayAudioOneShot2D(audioBank: AudioBank2D, audioClip: string) {
  if (!audioBank[audioClip]) {
    throw new Error(`Audio clip not found in bank: ${audioClip}`)
  }

  if (!audioBank[audioClip].buffer) {
    throw new Error(`Audio clip not loaded yet: ${audioClip}`)
  }

  audioBank[audioClip].play()
}

/**
 * Play a random 2D audio clip from the provided list.
 * Only clips that exist and are loaded in the provided bank will be considered.
 * Returns the clip name that was played.
 */
export function PlayAudioRandom2D(
  audioBank: AudioBank2D,
  clipNames: string[],
): string {
  if (!Array.isArray(clipNames) || clipNames.length === 0) {
    throw new Error("No audio clip names provided to PlayAudioRandom2D")
  }

  // Filter to clips that exist in the bank and are loaded
  const candidates = clipNames.filter((name) => {
    const audio = audioBank[name]
    return !!(audio && audio.buffer)
  })

  if (candidates.length === 0) {
    throw new Error(
      "None of the provided audio clips are loaded in the audio bank",
    )
  }

  const index = Math.floor(Math.random() * candidates.length)
  const chosen = candidates[index]
  PlayAudioOneShot2D(audioBank, chosen)
  return chosen
}

export function PlayAudioOneShot3D(
  audioBank: AudioBank3D,
  audioClip: string,
  parentObject: THREE.Object3D,
) {
  if (!audioBank[audioClip]) {
    throw new Error(`Audio clip not found in bank: ${audioClip}`)
  }

  if (!audioBank[audioClip].buffer) {
    throw new Error(`Audio clip not loaded yet: ${audioClip}`)
  }

  parentObject.add(audioBank[audioClip])
  audioBank[audioClip].play()
}

/** Set global master volume using Three.js AudioListener */
export function SetMasterVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume))
  __masterVolume = v
  
  if (AudioSystem.mainListener) {
    AudioSystem.mainListener.setMasterVolume(__masterMuted ? 0 : v)
  }
}

/** Get the last set (intended) master volume [0..1]. */
export function GetMasterVolume(): number {
  return __masterVolume
}

/** Toggle global mute using Three.js AudioListener */
export function SetAudioMuted(muted: boolean): void {
  __masterMuted = !!muted
  
  if (AudioSystem.mainListener) {
    AudioSystem.mainListener.setMasterVolume(__masterMuted ? 0 : __masterVolume)
  }
}

/** Check if audio is currently muted globally. */
export function IsAudioMuted(): boolean {
  return __masterMuted
}
