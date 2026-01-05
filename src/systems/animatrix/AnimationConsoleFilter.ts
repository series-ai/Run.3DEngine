/**
 * Console filter stub - kept for backwards compatibility
 * Filtering is no longer needed as animations are pre-cleaned
 */
export class AnimationConsoleFilter {
  private static isFilterActive = false

  /**
   * Enable filtering of PropertyBinding warnings for missing animation targets
   * NOTE: This is no longer needed as we're pre-cleaning animations
   */
  public static enable(): void {
    if (this.isFilterActive) return
    this.isFilterActive = true
  }

  /**
   * Disable the console filter
   */
  public static disable(): void {
    this.isFilterActive = false
  }

  /**
   * Check if the filter is currently active
   */
  public static isActive(): boolean {
    return this.isFilterActive
  }

}
