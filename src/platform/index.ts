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

// Note: We don't export RundotPlatform directly to avoid loading RundotGameAPI
// in Capacitor builds. Use dynamic import if you need RundotPlatform explicitly.
export { CapacitorPlatform } from "./CapacitorPlatform"

import type { PlatformService } from "./PlatformService"
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
  // When running on Run dot (e.g. getreel.com), we must use RundotPlatform so
  // cdn.fetchAsset() goes through RundotGameAPI.cdn (correct CDN URLs). If we
  // used Capacitor here, fetch would hit relative ./cdn-assets/ and 404.
  if (typeof window !== "undefined" && typeof window.location?.hostname === "string") {
    const host = window.location.hostname.toLowerCase()
    if (host.includes("getreel.com") || host.includes("h5-apps.getreel.com")) {
      return "rundot"
    }
  }

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
 * Uses dynamic import for RundotPlatform to avoid loading RundotGameAPI in Capacitor builds
 */
async function createPlatformAsync(type: PlatformType): Promise<PlatformService> {
  const resolvedType = type === "auto" ? detectPlatform() : type
  
  switch (resolvedType) {
    case "capacitor":
      console.log("[Platform] Using CapacitorPlatform")
      return new CapacitorPlatform()
    case "rundot":
    default:
      console.log("[Platform] Using RundotPlatform (dynamic import)")
      // Dynamic import to avoid loading RundotGameAPI in Capacitor builds
      const { RundotPlatform } = await import("./RundotPlatform")
      return new RundotPlatform()
  }
}

/**
 * Create a platform instance synchronously (for backwards compatibility)
 * Only works for Capacitor - Rundot requires async initialization
 */
function createPlatformSync(type: PlatformType): PlatformService {
  const resolvedType = type === "auto" ? detectPlatform() : type
  
  if (resolvedType === "capacitor") {
    console.log("[Platform] Using CapacitorPlatform")
    return new CapacitorPlatform()
  }
  
  // For Rundot, we need async loading - throw helpful error
  throw new Error(
    "[Platform] RundotPlatform requires async initialization. " +
    "Use initializePlatformAsync() instead, or set VITE_PLATFORM=capacitor for Capacitor builds."
  )
}

/**
 * Initialize and get the platform instance (async)
 * 
 * @param type - Platform type to use ("rundot", "capacitor", or "auto")
 * @returns The platform service instance
 */
export async function initializePlatformAsync(type: PlatformType = "auto"): Promise<PlatformService> {
  if (platformInstance) {
    console.warn("[Platform] Already initialized, returning existing instance")
    return platformInstance
  }
  
  platformInstance = await createPlatformAsync(type)
  return platformInstance
}

/**
 * Initialize and get the platform instance (sync - Capacitor only)
 * For backwards compatibility. Use initializePlatformAsync() for Rundot.
 * 
 * @param type - Platform type to use ("rundot", "capacitor", or "auto")
 * @returns The platform service instance
 */
export function initializePlatform(type: PlatformType = "auto"): PlatformService {
  if (platformInstance) {
    console.warn("[Platform] Already initialized, returning existing instance")
    return platformInstance
  }
  
  // For Capacitor, we can initialize synchronously
  const resolvedType = type === "auto" ? detectPlatform() : type
  if (resolvedType === "capacitor") {
    platformInstance = new CapacitorPlatform()
    return platformInstance
  }
  
  // For Rundot, warn and throw - must use async
  throw new Error(
    "[Platform] RundotPlatform requires async initialization in this build. " +
    "The RundotGameAPI is loaded dynamically to prevent it from loading in Capacitor builds. " +
    "Use initializePlatformAsync() for Rundot platform, or set VITE_PLATFORM=capacitor."
  )
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
 * For Capacitor builds: Works synchronously, auto-initializes on first access.
 * For Rundot builds: Requires calling initializePlatformAsync() before first access.
 * 
 * Usage:
 *   import { Platform } from "@series-ai/venus-three/platform"
 *   await Platform.storage.setItem("key", "value")
 */
export const Platform: PlatformService = new Proxy({} as PlatformService, {
  get(_target, prop: keyof PlatformService) {
    if (!platformInstance) {
      // Auto-initialize on first access - only works for Capacitor
      const detectedType = detectPlatform()
      if (detectedType === "capacitor") {
        console.log("[Platform] Auto-initializing CapacitorPlatform on first access")
        platformInstance = new CapacitorPlatform()
      } else {
        throw new Error(
          "[Platform] Platform not initialized. For Rundot builds, call initializePlatformAsync() before accessing Platform. " +
          "For Capacitor builds, set VITE_PLATFORM=capacitor in your .env file."
        )
      }
    }
    return platformInstance[prop]
  },
})
