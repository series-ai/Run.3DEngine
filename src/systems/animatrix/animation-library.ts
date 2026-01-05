import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"

export class AnimationLibrary {
  private static clips: Map<string, THREE.AnimationClip> = new Map()
  private static loader: FBXLoader = new FBXLoader()
  private static debug: boolean = false
  
  // List of track name prefixes that are known to be non-bone objects
  // These are mesh/accessory names that shouldn't have animation tracks
  private static readonly ACCESSORY_PREFIXES = [
    'hair_',
    'hat_',
    'face_accessory_',
    'fullBody_Toes',
    'fullBody_'  // Seems to be mesh names, not bones
  ]

  public static setDebug(enabled: boolean): void {
    AnimationLibrary.debug = enabled
  }

  public static async loadAnimation(
    id: string,
    path: string,
  ): Promise<THREE.AnimationClip> {
    let clip = AnimationLibrary.clips.get(id)
    if (clip) {
      console.warn(`[Animatrix] Loading an already loaded clip: ${id}`)
      return clip
    }

    const object = await AnimationLibrary.loader.loadAsync(path)
    if (object.animations && object.animations.length > 0) {
      clip = object.animations[0]
      
      // Pre-clean the animation by removing accessory/mesh tracks
      const originalTrackCount = clip.tracks.length
      const validTracks = clip.tracks.filter(track => {
        const trackName = track.name.split('.')[0]
        // Remove tracks for known accessory/mesh prefixes
        return !AnimationLibrary.ACCESSORY_PREFIXES.some(prefix => 
          trackName.startsWith(prefix) || trackName === prefix
        )
      })
      
      if (validTracks.length < originalTrackCount) {
        const removed = originalTrackCount - validTracks.length
        if (AnimationLibrary.debug) {
          console.log(`[AnimationLibrary] Pre-cleaned ${removed} accessory tracks from animation: ${id}`)
        }
        clip.tracks = validTracks
      }
      
      clip.optimize()
      clip.trim()
      clip.resetDuration()

      AnimationLibrary.clips.set(id, clip)

      if (AnimationLibrary.debug) {
        console.log(`[AnimationLibrary] Loaded animation: ${id} from ${path} (${clip.tracks.length} tracks)`)
      }

      return clip
    }

    throw new Error("Failed to load animation")
  }

  public static async loadAnimations(paths: {
    [id: string]: string
  }): Promise<void> {
    const promises = Object.entries(paths).map(([id, path]) =>
      AnimationLibrary.loadAnimation(id, path),
    )
    await Promise.all(promises)
  }

  public static registerClip(id: string, clip: THREE.AnimationClip): void {
    if (AnimationLibrary.clips.has(id)) {
      console.warn(`[AnimationLibrary] Clip '${id}' already registered, skipping...`)
      return
    }

    AnimationLibrary.clips.set(id, clip)

    if (AnimationLibrary.debug) {
      console.log(`[AnimationLibrary] Registered animation clip: ${id} (${clip.tracks.length} tracks)`)
    }
  }

  public static getClip(id: string): THREE.AnimationClip | undefined {
    return AnimationLibrary.clips.get(id)
  }

  public static cloneClip(id: string): THREE.AnimationClip | undefined {
    const clip = AnimationLibrary.clips.get(id)
    return clip ? clip.clone() : undefined
  }

  public static getAllClips(): Map<string, THREE.AnimationClip> {
    return new Map(AnimationLibrary.clips)
  }

  public static hasClip(id: string): boolean {
    return AnimationLibrary.clips.has(id)
  }
}
