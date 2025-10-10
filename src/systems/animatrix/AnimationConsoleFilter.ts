/**
 * Console filter to suppress Three.js PropertyBinding warnings for missing animation targets
 * These warnings should be fixed by cleaning animation tracks, but this acts as a fallback
 * Only active in production to avoid hiding issues during development
 */
export class AnimationConsoleFilter {
  private static originalConsoleWarn: typeof console.warn
  private static isFilterActive = false
  private static suppressedCount = 0

  /**
   * Enable filtering of PropertyBinding warnings for missing animation targets
   * NOTE: This should no longer be needed as we're pre-cleaning animations
   * Kept for backwards compatibility but disabled by default
   */
  public static enable(): void {
    if (this.isFilterActive) return
    
    // Disabled by default since we're now pre-cleaning animations
    console.log('[AnimationConsoleFilter] Warning filter not needed - animations are pre-cleaned')
    return
    
    // Original code kept but unreachable
    this.originalConsoleWarn = console.warn
    this.isFilterActive = true
    this.suppressedCount = 0

    console.warn = (...args: any[]) => {
      // Check if this is a Three.js PropertyBinding warning for missing targets
      const firstArg = args[0]
      if (typeof firstArg === 'string' && 
          firstArg.includes('THREE.PropertyBinding: No target node found for track:')) {
        // Count suppressed warnings for debugging
        this.suppressedCount++
        return
      }

      // Allow all other warnings through
      this.originalConsoleWarn(...args)
    }

    console.log('[AnimationConsoleFilter] PropertyBinding warnings suppressed')
  }

  /**
   * Disable the console filter and restore original console.warn
   */
  public static disable(): void {
    if (!this.isFilterActive || !this.originalConsoleWarn) return

    console.warn = this.originalConsoleWarn
    this.isFilterActive = false
    
    console.log('[AnimationConsoleFilter] Console filter disabled - all warnings will show')
  }

  /**
   * Check if the filter is currently active
   */
  public static isActive(): boolean {
    return this.isFilterActive
  }

  /**
   * Temporarily enable the filter for a specific duration (useful for testing)
   */
  public static enableTemporarily(durationMs: number = 10000): void {
    this.enable()
    setTimeout(() => {
      this.disable()
    }, durationMs)
  }
}
