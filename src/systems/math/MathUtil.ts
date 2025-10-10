/**
 * Math utilities for game development
 */
export class MathUtil {
  /**
   * Linear interpolation - exponential approach, never quite reaches target
   * @param current Current value
   * @param target Target value
   * @param factor Interpolation factor (0-1)
   * @returns Interpolated value
   */
  static lerp(current: number, target: number, factor: number): number {
    return current + (target - current) * factor
  }

  /**
   * Move towards - linear approach with max speed, reaches target exactly
   * @param current Current value
   * @param target Target value
   * @param maxDelta Maximum change per call
   * @returns New value moved towards target
   */
  static moveTowards(
    current: number,
    target: number,
    maxDelta: number,
  ): number {
    const diff = target - current
    if (Math.abs(diff) <= maxDelta) {
      return target
    }
    return current + Math.sign(diff) * maxDelta
  }

  /**
   * Clamp a value between min and max
   * @param value Value to clamp
   * @param min Minimum value
   * @param max Maximum value
   * @returns Clamped value
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  /**
   * Check if two values are approximately equal
   * @param a First value
   * @param b Second value
   * @param epsilon Tolerance (default: 0.001)
   * @returns True if values are approximately equal
   */
  static approximately(a: number, b: number, epsilon: number = 0.001): boolean {
    return Math.abs(a - b) < epsilon
  }
}
