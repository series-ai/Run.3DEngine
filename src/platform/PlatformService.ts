/**
 * Platform Service Interface
 * 
 * Abstracts platform-specific APIs (RundotGameAPI, Capacitor, etc.)
 * to allow the game to run on different platforms without code changes.
 * 
 * Usage:
 *   import { Platform } from "@series-ai/venus-three/platform"
 *   await Platform.storage.setItem("key", "value")
 */

/**
 * Initialization context returned when the platform is initialized
 */
export interface PlatformContext {
  /** Whether the platform was successfully initialized */
  initialized: boolean
  /** Platform-specific context data */
  data?: unknown
}

/**
 * Storage API for persistent data (survives app uninstall on some platforms)
 */
export interface PlatformStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  length(): Promise<number>
  key(index: number): Promise<string | null>
}

/**
 * Cache API for device-local data (cleared on app uninstall)
 */
export interface PlatformCache {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/**
 * Analytics API for tracking user events and funnels
 */
export interface PlatformAnalytics {
  trackFunnelStep(step: number, name: string): void
  recordCustomEvent(eventName: string, params?: Record<string, unknown>): void
}

/**
 * Ads API for showing rewarded and interstitial ads
 */
export interface PlatformAds {
  /** Show a rewarded ad, returns true if user watched to completion */
  showRewardedAdAsync(): Promise<boolean>
  /** Show an interstitial ad, returns true if shown successfully */
  showInterstitialAd(): Promise<boolean>
}

/**
 * In-App Purchase API
 */
export interface PlatformIAP {
  /** Get the user's current premium currency balance */
  getHardCurrencyBalance(): Promise<number>
  /** Spend premium currency */
  spendCurrency(productId: string, amount: number): Promise<void>
  /** Open the store/purchase UI */
  openStore(): Promise<void>
}

/**
 * CDN API for fetching assets
 */
export interface PlatformCDN {
  /** Fetch an asset as a Blob */
  fetchAsset(path: string): Promise<Blob>
  /** Fetch an asset as a Blob (alias for fetchAsset) */
  fetchBlob(path: string): Promise<Blob>
}

/**
 * Local Notifications API
 */
export interface PlatformNotifications {
  /** Schedule a local notification */
  scheduleAsync(
    title: string,
    body: string,
    delaySeconds: number,
    notificationId?: string
  ): Promise<void>
  /** Cancel a scheduled notification */
  cancelNotification(notificationId: string): Promise<void>
}

/**
 * App Lifecycle callbacks
 */
export interface PlatformLifecycles {
  /** Called when app resumes from background */
  onResume(callback: () => void): void
  /** Called when app goes to background */
  onPause(callback: () => void): void
}

/**
 * Preloader/Loading screen API
 */
export interface PlatformPreloader {
  /** Hide the loading/splash screen */
  hideLoadScreen(): Promise<void>
}

/**
 * Complete Platform Service interface
 */
export interface PlatformService {
  /** Platform identifier */
  readonly platformId: "rundot" | "capacitor" | "web" | "mock"

  /** Initialize the platform, must be called before using other APIs */
  initializeAsync(options?: { usePreloader?: boolean }): Promise<PlatformContext>

  /** Persistent storage API */
  readonly storage: PlatformStorage

  /** Device-local cache API */
  readonly cache: PlatformCache

  /** Analytics API */
  readonly analytics: PlatformAnalytics

  /** Ads API */
  readonly ads: PlatformAds

  /** In-App Purchases API */
  readonly iap: PlatformIAP

  /** CDN/Asset fetching API */
  readonly cdn: PlatformCDN

  /** Local notifications API */
  readonly notifications: PlatformNotifications

  /** App lifecycle callbacks */
  readonly lifecycles: PlatformLifecycles

  /** Preloader/loading screen API */
  readonly preloader: PlatformPreloader

  /** Platform-aware logging */
  log(message: string, ...args: unknown[]): void
}
