/**
 * Easing functions for smooth animations
 */
export class Easing {
  static linear(t: number): number {
    return t
  }

  static easeInQuad(t: number): number {
    return t * t
  }

  static easeOutQuad(t: number): number {
    return t * (2 - t)
  }

  static easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }

  static easeInCubic(t: number): number {
    return t * t * t
  }

  static easeOutCubic(t: number): number {
    return (--t) * t * t + 1
  }

  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  }

  // Spring physics-based easing
  static spring(t: number, damping: number = 0.8, stiffness: number = 0.15): number {
    return 1 - Math.exp(-damping * t) * Math.cos(stiffness * t * Math.PI * 2)
  }

  // Elastic easing - perfect for bounce/spring effects
  static easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3
    return t === 0
      ? 0
      : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  }

  // Back easings and anticipate/overshoot combo
  static easeInBack(t: number, s: number = 1.70158): number {
    return t * t * ((s + 1) * t - s)
  }

  static easeOutBack(t: number, s: number = 1.70158): number {
    t = t - 1
    return 1 + t * t * ((s + 1) * t + s)
  }

  // Anticipate (goes slightly negative) then overshoot (>1) in a single curve
  static anticipateOvershoot(t: number, s: number = 2.2): number {
    if (t < 0.5) {
      return 0.5 * Easing.easeInBack(t * 2, s)
    }
    return 0.5 * Easing.easeOutBack(t * 2 - 1, s) + 0.5
  }
}

/**
 * Individual tween instance
 */
export class Tween {
  private target: any
  private property: string
  private startValue: number
  private endValue: number
  private duration: number
  private elapsed: number = 0
  private easingFunction: (t: number) => number
  private onComplete?: () => void
  private onUpdate?: (value: number) => void
  private active: boolean = true

  constructor(
    target: any,
    property: string,
    endValue: number,
    duration: number,
    easingFunction: (t: number) => number = Easing.linear
  ) {
    this.target = target
    this.property = property
    this.startValue = target[property]
    this.endValue = endValue
    this.duration = duration
    this.easingFunction = easingFunction
    
    if (TweenSystem.debugLogging) {
      console.log(`[Tween] Created: property=${property}, start=${this.startValue}, end=${endValue}, duration=${duration}`)
    }
  }

  /**
   * Set completion callback
   */
  public onCompleted(callback: () => void): Tween {
    this.onComplete = callback
    return this
  }

  /**
   * Set update callback
   */
  public onUpdated(callback: (value: number) => void): Tween {
    this.onUpdate = callback
    return this
  }

  /**
   * Update the tween (optimized for performance)
   */
  public update(deltaTime: number): boolean {
    // Fast path for inactive tweens
    if (!this.active) return false

    this.elapsed += deltaTime
    
    // Fast path for incomplete tweens
    if (this.elapsed < this.duration) {
      const t = this.elapsed / this.duration
      const easedT = this.easingFunction(t)
      const currentValue = this.startValue + (this.endValue - this.startValue) * easedT
      this.target[this.property] = currentValue
      
      // Only call update callback if it exists
      if (this.onUpdate) {
        this.onUpdate(currentValue)
      }
      
      // Debug logging with reduced frequency
      if (TweenSystem.debugLogging && Math.random() < 0.02) {
        console.log(`[Tween] Progress: ${this.property}=${currentValue.toFixed(2)} (${(t * 100).toFixed(0)}%)`)
      }
      
      return true
    }
    
    // Tween completed
    this.target[this.property] = this.endValue
    this.active = false
    
    if (TweenSystem.debugLogging) {
      console.log(`[Tween] Completed: ${this.property}=${this.endValue}`)
    }
    
    // Call completion callback if it exists
    if (this.onComplete) {
      this.onComplete()
    }
    
    return false
  }

  /**
   * Stop the tween
   */
  public stop(): void {
    this.active = false
  }

  /**
   * Check if tween is active
   */
  public isActive(): boolean {
    return this.active
  }
}

/**
 * Global tween manager with performance optimizations
 */
export class TweenSystem {
  private static tweens: Tween[] = []
  private static pendingTweens: Tween[] = [] // Tweens created during update
  public static debugLogging: boolean = false // Disabled by default
  private static lastActiveFrame: number = 0
  private static frameCount: number = 0

  /**
   * Create and register a new tween
   */
  static tween(
    target: any,
    property: string,
    endValue: number,
    duration: number,
    easingFunction?: (t: number) => number
  ): Tween {
    const tween = new Tween(target, property, endValue, duration, easingFunction)
    
    // If we're currently updating, add to pending list to avoid modification during iteration
    if (this.pendingTweens.length > 0 || this.frameCount - this.lastActiveFrame < 2) {
      this.pendingTweens.push(tween)
    } else {
      this.tweens.push(tween)
    }
    
    return tween
  }

  /**
   * Update all active tweens (optimized to skip when empty)
   */
  static update(deltaTime: number): void {
    this.frameCount++
    
    // Early exit if no tweens to process
    if (this.tweens.length === 0 && this.pendingTweens.length === 0) {
      // System is sleeping - no tweens active
      return
    }
    
    this.lastActiveFrame = this.frameCount
    
    // Debug: log deltaTime occasionally
    if (this.debugLogging && Math.random() < 0.01 && this.tweens.length > 0) {
      console.log(`[TweenSystem] Updating ${this.tweens.length} tweens with deltaTime=${deltaTime}`)
    }

    // Process existing tweens
    const activeTweens: Tween[] = []
    for (const tween of this.tweens) {
      const isActive = tween.update(deltaTime)
      if (isActive) {
        activeTweens.push(tween)
      }
    }
    
    // Add any pending tweens that were created during update
    if (this.pendingTweens.length > 0) {
      activeTweens.push(...this.pendingTweens)
      this.pendingTweens = []
    }
    
    this.tweens = activeTweens
  }

  /**
   * Stop all tweens
   */
  static stopAll(): void {
    this.tweens.forEach(tween => tween.stop())
    this.tweens = []
    this.pendingTweens = []
  }

  /**
   * Get number of active tweens
   */
  static getActiveCount(): number {
    return this.tweens.length + this.pendingTweens.length
  }
  
  /**
   * Check if the tween system is currently active
   */
  static isActive(): boolean {
    return this.tweens.length > 0 || this.pendingTweens.length > 0
  }
  
  /**
   * Get performance stats for debugging
   */
  static getStats(): { active: number, pending: number, lastActiveFrame: number, currentFrame: number } {
    return {
      active: this.tweens.length,
      pending: this.pendingTweens.length,
      lastActiveFrame: this.lastActiveFrame,
      currentFrame: this.frameCount
    }
  }
}