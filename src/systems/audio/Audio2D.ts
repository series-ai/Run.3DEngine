import { Component } from "@engine/core"
import {
  PlayAudioOneShot2D,
  PlayAudioRandom2D,
  AudioSystem,
  Main2DAudioBank,
  AudioBank2D,
  AudioOverlapMode,
} from "./AudioSystem"

/**
 * A simple 2D audio component that can be attached to any GameObject.
 * Provides easy access to play 2D audio clips from a configured bank.
 */
export class Audio2D extends Component {
  private audioBank: AudioBank2D
  private availableClips: Set<string>

  /**
   * Creates a new Audio2D component
   * @param availableClips - Array of clip names this component can play (optional - if not provided, can play any clip in the bank)
   */
  constructor(availableClips?: string[]) {
    super()
    this.audioBank = Main2DAudioBank
    this.availableClips = availableClips ? new Set(availableClips) : new Set()
  }

  /**
   * Play a 2D audio clip
   * @param clipName - Name/path of the audio clip to play
   * @param overlapMode - How to handle overlapping audio (default: OVERLAP)
   */
  public play(clipName: string, overlapMode: AudioOverlapMode = AudioOverlapMode.OVERLAP): void {
    // If availableClips is specified, check if the clip is allowed
    if (this.availableClips.size > 0 && !this.availableClips.has(clipName)) {
      throw new Error(
        `Audio clip '${clipName}' is not available in this Audio2D component`,
      )
    }

    PlayAudioOneShot2D(this.audioBank, clipName, overlapMode)
  }

  /**
   * Check if a clip is available and loaded
   * @param clipName - Name/path of the audio clip to check
   */
  public isClipReady(clipName: string): boolean {
    const audio = this.audioBank[clipName]
    return audio && !!audio.buffer
  }

  /**
   * Get list of available clips (if configured)
   */
  public getAvailableClips(): string[] {
    return Array.from(this.availableClips)
  }

  /**
   * Add a clip to the available clips list
   * @param clipName - Name/path of the audio clip to add
   */
  public addAvailableClip(clipName: string): void {
    this.availableClips.add(clipName)
  }

  /**
   * Remove a clip from the available clips list
   * @param clipName - Name/path of the audio clip to remove
   */
  public removeAvailableClip(clipName: string): void {
    this.availableClips.delete(clipName)
  }

  protected onCreate(): void {
    // Nothing special needed for creation
  }

  protected onCleanup(): void {
    // Clear references
    this.availableClips.clear()
  }
}

/**
 * A 2D audio component that plays a random clip from a provided list.
 * Uses the main 2D audio bank.
 */
export class RandomAudio2D extends Component {
  private audioBank: AudioBank2D
  private clipNames: string[]
  private avoidImmediateRepeat: boolean
  private lastPlayed: string | null

  /**
   * @param clipNames - List of clip paths to randomly play (must be in Main2DAudioBank)
   * @param avoidImmediateRepeat - If true, avoids choosing the same clip twice in a row when possible
   */
  constructor(clipNames: string[], avoidImmediateRepeat: boolean = true) {
    super()
    this.audioBank = Main2DAudioBank
    this.clipNames = clipNames.slice()
    this.avoidImmediateRepeat = avoidImmediateRepeat
    this.lastPlayed = null
  }

  /**
   * Play a random clip from the list. Returns the chosen clip name.
   */
  public play(): string {
    const candidates =
      this.avoidImmediateRepeat && this.lastPlayed && this.clipNames.length > 1
        ? this.clipNames.filter((n) => n !== this.lastPlayed)
        : this.clipNames

    const chosen = PlayAudioRandom2D(this.audioBank, candidates)
    this.lastPlayed = chosen
    return chosen
  }

  /** Replace the internal clip list. */
  public setClips(clipNames: string[]): void {
    this.clipNames = clipNames.slice()
    this.lastPlayed = null
  }

  /** Get the internal clip list. */
  public getClips(): string[] {
    return this.clipNames.slice()
  }

  /** Add a single clip to the list. */
  public addClip(clipName: string): void {
    if (!this.clipNames.includes(clipName)) this.clipNames.push(clipName)
  }

  /** Remove a single clip from the list. */
  public removeClip(clipName: string): void {
    this.clipNames = this.clipNames.filter((n) => n !== clipName)
    if (this.lastPlayed === clipName) this.lastPlayed = null
  }

  /** Check if all clips are present (and at least one is loaded) in the bank. */
  public isReady(): boolean {
    if (this.clipNames.length === 0) return false
    return this.clipNames.some((n) => {
      const audio = this.audioBank[n]
      return !!(audio && audio.buffer)
    })
  }

  protected onCreate(): void {}
  protected onCleanup(): void {}
}
