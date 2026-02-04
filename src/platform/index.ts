/**
 * Platform Abstraction Layer
 * 
 * Provides a unified API for platform-specific features.
 * Automatically selects the appropriate platform implementation
 * based on build configuration or runtime detection.
 * 
 * Usage:
 *   import { Platform } from "@series-ai/venus-three/platform"
 *   
 *   // Initialize (call once at startup)
 *   await Platform.initializeAsync()
 *   
 *   // Use platform APIs
 *   await Platform.storage.setItem("key", "value")
 *   Platform.analytics.trackFunnelStep(1, "Started")
 */

export type { 
  PlatformService,
  PlatformContext,
  PlatformStorage,
  PlatformCache,
  PlatformAnalytics,
  PlatformAds,
  PlatformIAP,
  PlatformCDN,
  PlatformNotifications,
  PlatformLifecycles,
  PlatformPreloader,
} from "./PlatformService"

export { RundotPlatform } from "./RundotPlatform"
export { CapacitorPlatform } from "./CapacitorPlatform"

import type { PlatformService } from "./PlatformService"
import { RundotPlatform } from "./RundotPlatform"
import { CapacitorPlatform } from "./CapacitorPlatform"

/**
 * Platform type for build configuration
 */
export type PlatformType = "rundot" | "capacitor" | "auto"

/**
 * Singleton platform instance
 */
let platformInstance: PlatformService | null = null

/**
 * Detect which platform to use based on environment
 */
function detectPlatform(): PlatformType {
  // Check for Capacitor
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    return "capacitor"
  }
  
  // Check for build-time environment variable
  // Set VITE_PLATFORM=capacitor in your .env for Capacitor builds
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PLATFORM === "capacitor") {
    return "capacitor"
  }
  
  // Default to Rundot
  return "rundot"
}

/**
 * Create a platform instance based on type
 */
function createPlatform(type: PlatformType): PlatformService {
  const resolvedType = type === "auto" ? detectPlatform() : type
  
  switch (resolvedType) {
    case "capacitor":
      console.log("[Platform] Using CapacitorPlatform")
      return new CapacitorPlatform()
    case "rundot":
    default:
      console.log("[Platform] Using RundotPlatform")
      return new RundotPlatform()
  }
}

/**
 * Initialize and get the platform instance
 * 
 * @param type - Platform type to use ("rundot", "capacitor", or "auto")
 * @returns The platform service instance
 */
export function initializePlatform(type: PlatformType = "auto"): PlatformService {
  if (platformInstance) {
    console.warn("[Platform] Already initialized, returning existing instance")
    return platformInstance
  }
  
  platformInstance = createPlatform(type)
  return platformInstance
}

/**
 * Get the current platform instance
 * Throws if platform has not been initialized
 */
export function getPlatform(): PlatformService {
  if (!platformInstance) {
    throw new Error(
      "[Platform] Platform not initialized. Call initializePlatform() first, " +
      "or use Platform singleton which auto-initializes."
    )
  }
  return platformInstance
}

/**
 * Check if platform has been initialized
 */
export function isPlatformInitialized(): boolean {
  return platformInstance !== null
}

/**
 * Reset the platform instance (mainly for testing)
 */
export function resetPlatform(): void {
  platformInstance = null
}

/**
 * Platform singleton with lazy initialization
 * 
 * This is the primary way to access platform APIs throughout the codebase.
 * It auto-initializes on first access using auto-detection.
 * 
 * Usage:
 *   import { Platform } from "@series-ai/venus-three/platform"
 *   await Platform.storage.setItem("key", "value")
 */
export const Platform: PlatformService = new Proxy({} as PlatformService, {
  get(_target, prop: keyof PlatformService) {
    if (!platformInstance) {
      // Auto-initialize on first access
      platformInstance = createPlatform("auto")
    }
    return platformInstance[prop]
  },
})
