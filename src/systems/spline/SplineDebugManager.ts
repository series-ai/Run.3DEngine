import * as THREE from "three"
import { GameObject } from "@engine/core/GameObject"
import { SplineThree } from "./SplineThree"
import { SplineDebugRendererThree } from "./SplineDebugRendererThree"

/**
 * Configuration for spline debug visualization
 */
export interface SplineDebugConfig {
  showWaypoints?: boolean
  showCurve?: boolean
  showDirection?: boolean
  waypointSize?: number
  waypointColor?: THREE.Color
  curveColor?: THREE.Color
}

/**
 * Internal registration entry for a spline
 */
interface SplineRegistration {
  spline: SplineThree
  debugGameObject: GameObject | null
  debugRenderer: SplineDebugRendererThree | null
  config: SplineDebugConfig
}

/**
 * Global manager for spline debug visualization
 * Allows centralized control of debug rendering for all splines
 */
export class SplineDebugManager {
  private static instance: SplineDebugManager | null = null
  private registrations: Map<SplineThree, SplineRegistration> = new Map()
  private debugEnabled: boolean = false
  private defaultConfig: SplineDebugConfig = {
    showWaypoints: true,
    showCurve: true,
    showDirection: false,
    waypointSize: 0.4,
    waypointColor: new THREE.Color(0xff0000),
    curveColor: new THREE.Color(0xffff00),
  }

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): SplineDebugManager {
    if (!SplineDebugManager.instance) {
      SplineDebugManager.instance = new SplineDebugManager()
    }
    return SplineDebugManager.instance
  }

  /**
   * Register a spline for debug visualization
   */
  public registerSpline(
    spline: SplineThree,
    config: SplineDebugConfig = {},
  ): void {
    if (this.registrations.has(spline)) {
      return
    }

    const mergedConfig = { ...this.defaultConfig, ...config }

    this.registrations.set(spline, {
      spline,
      debugGameObject: null,
      debugRenderer: null,
      config: mergedConfig,
    })

    // If debug is already enabled, create visualization immediately
    if (this.debugEnabled) {
      this.createDebugVisualization(spline)
    }
  }

  /**
   * Unregister a spline from debug visualization
   */
  public unregisterSpline(spline: SplineThree): void {
    const registration = this.registrations.get(spline)
    if (!registration) {
      return
    }

    this.destroyDebugVisualization(spline)
    this.registrations.delete(spline)
  }

  /**
   * Enable debug visualization for all registered splines
   */
  public setDebugEnabled(enabled: boolean): void {
    if (this.debugEnabled === enabled) {
      return
    }

    this.debugEnabled = enabled

    if (enabled) {
      this.registrations.forEach((_, spline) => {
        this.createDebugVisualization(spline)
      })
    } else {
      this.registrations.forEach((_, spline) => {
        this.destroyDebugVisualization(spline)
      })
    }
  }

  /**
   * Check if debug is currently enabled
   */
  public isDebugEnabled(): boolean {
    return this.debugEnabled
  }

  /**
   * Get the number of registered splines
   */
  public getRegisteredCount(): number {
    return this.registrations.size
  }

  /**
   * Create debug visualization for a specific spline
   */
  private createDebugVisualization(spline: SplineThree): void {
    const registration = this.registrations.get(spline)
    if (!registration || registration.debugGameObject) {
      return
    }

    const debugGameObject = new GameObject("SplineDebug")
    debugGameObject.position.set(0, 0.5, 0) // Slightly elevated

    const debugRenderer = new SplineDebugRendererThree(spline, registration.config)
    debugGameObject.addComponent(debugRenderer)

    registration.debugGameObject = debugGameObject
    registration.debugRenderer = debugRenderer
  }

  /**
   * Destroy debug visualization for a specific spline
   */
  private destroyDebugVisualization(spline: SplineThree): void {
    const registration = this.registrations.get(spline)
    if (!registration || !registration.debugGameObject) {
      return
    }

    registration.debugGameObject.dispose()
    registration.debugGameObject = null
    registration.debugRenderer = null
  }

  /**
   * Update configuration for the default debug visualization
   */
  public setDefaultConfig(config: SplineDebugConfig): void {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  /**
   * Clear all registrations (useful for cleanup/testing)
   */
  public clear(): void {
    this.registrations.forEach((_, spline) => {
      this.destroyDebugVisualization(spline)
    })
    this.registrations.clear()
  }
}

