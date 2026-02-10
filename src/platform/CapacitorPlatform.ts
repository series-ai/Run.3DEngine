/**
 * Capacitor Platform Implementation
 *
 * Implements the PlatformService interface using Capacitor plugins.
 * Used for standalone APK/iOS builds.
 * Includes AppsFlyer for retention/analytics on native (Android/iOS).
 */

import { Capacitor } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"
import { LocalNotifications } from "@capacitor/local-notifications"
import { App } from "@capacitor/app"
import { SplashScreen } from "@capacitor/splash-screen"

import type {
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

// Logging prefix for all Capacitor platform calls
const LOG_PREFIX = "[Capacitor]"

// Helper to generate numeric notification IDs from string IDs
function stringToNotificationId(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * CapacitorPlatform - Implementation using real Capacitor plugins
 */
export class CapacitorPlatform implements PlatformService {
  readonly platformId = "capacitor" as const

  // Storage implementation using @capacitor/preferences
  readonly storage: PlatformStorage = {
    getItem: async (key: string): Promise<string | null> => {
      console.log(`${LOG_PREFIX} storage.getItem("${key}")`)
      const { value } = await Preferences.get({ key })
      console.log(`${LOG_PREFIX} storage.getItem("${key}") =>`, value ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` : 'null')
      return value
    },
    setItem: async (key: string, value: string): Promise<void> => {
      console.log(`${LOG_PREFIX} storage.setItem("${key}", "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}")`)
      await Preferences.set({ key, value })
    },
    removeItem: async (key: string): Promise<void> => {
      console.log(`${LOG_PREFIX} storage.removeItem("${key}")`)
      await Preferences.remove({ key })
    },
    length: async (): Promise<number> => {
      // Preferences doesn't have a length method, so we get all keys
      const { keys } = await Preferences.keys()
      console.log(`${LOG_PREFIX} storage.length() => ${keys.length}`)
      return keys.length
    },
    key: async (index: number): Promise<string | null> => {
      const { keys } = await Preferences.keys()
      const key = keys[index] ?? null
      console.log(`${LOG_PREFIX} storage.key(${index}) => "${key}"`)
      return key
    },
  }

  // Cache implementation (same as storage for Capacitor, but with prefix)
  readonly cache: PlatformCache = {
    getItem: async (key: string): Promise<string | null> => {
      console.log(`${LOG_PREFIX} cache.getItem("${key}")`)
      const { value } = await Preferences.get({ key: `cache_${key}` })
      console.log(`${LOG_PREFIX} cache.getItem("${key}") =>`, value ? `"${value.substring(0, 50)}..."` : 'null')
      return value
    },
    setItem: async (key: string, value: string): Promise<void> => {
      console.log(`${LOG_PREFIX} cache.setItem("${key}", "${value.substring(0, 50)}...")`)
      await Preferences.set({ key: `cache_${key}`, value })
    },
    removeItem: async (key: string): Promise<void> => {
      console.log(`${LOG_PREFIX} cache.removeItem("${key}")`)
      await Preferences.remove({ key: `cache_${key}` })
    },
  }

  // AppsFlyer module (lazy-loaded, only on native)
  private appsFlyerModule: { AppsFlyer: { initSDK: (config: any) => Promise<unknown>; logEvent: (event: { eventName: string; eventValue?: Record<string, unknown> }) => Promise<unknown> } } | null = null

  // Analytics implementation - AppsFlyer on native, console fallback otherwise
  readonly analytics: PlatformAnalytics = {
    trackFunnelStep: (step: number, name: string) => {
      console.log(`${LOG_PREFIX} analytics.trackFunnelStep(${step}, "${name}")`)
      this.sendAppsFlyerEvent(`funnel_step_${step}`, { af_content: name })
    },
    recordCustomEvent: (eventName: string, params?: Record<string, unknown>) => {
      console.log(`${LOG_PREFIX} analytics.recordCustomEvent("${eventName}")`, params)
      this.sendAppsFlyerEvent(eventName, params ?? {})
    },
  }

  private sendAppsFlyerEvent(eventName: string, eventValue: Record<string, unknown>): void {
    if (!this.appsFlyerModule) return
    this.appsFlyerModule.AppsFlyer.logEvent({ eventName, eventValue }).catch(() => {})
  }

  // Ads implementation
  // TODO: Add @capacitor-community/admob when ready for monetization
  readonly ads: PlatformAds = {
    showRewardedAdAsync: async (): Promise<boolean> => {
      console.log(`${LOG_PREFIX} ads.showRewardedAdAsync() - returning true (no ads configured)`)
      // Return true for testing so the game flow continues
      return true
    },
    showInterstitialAd: async (): Promise<boolean> => {
      console.log(`${LOG_PREFIX} ads.showInterstitialAd() - returning true (no ads configured)`)
      return true
    },
  }

  // IAP implementation using Preferences for local currency storage
  // TODO: Add real IAP plugin when ready for monetization
  readonly iap: PlatformIAP = {
    getHardCurrencyBalance: async (): Promise<number> => {
      const { value } = await Preferences.get({ key: "premium_currency" })
      const balance = value ? parseInt(value, 10) : 0
      console.log(`${LOG_PREFIX} iap.getHardCurrencyBalance() => ${balance}`)
      return balance
    },
    spendCurrency: async (productId: string, amount: number): Promise<void> => {
      console.log(`${LOG_PREFIX} iap.spendCurrency("${productId}", ${amount})`)
      const current = await this.iap.getHardCurrencyBalance()
      if (current < amount) {
        throw new Error("Insufficient currency")
      }
      await Preferences.set({ key: "premium_currency", value: (current - amount).toString() })
    },
    openStore: async (): Promise<void> => {
      console.log(`${LOG_PREFIX} iap.openStore() - not implemented yet`)
      // TODO: Show custom store UI or integrate with native purchase flow
    },
  }

  // CDN implementation - for standalone, assets are bundled with the app
  // Assets like .stow files are in public/cdn-assets/ folder
  readonly cdn: PlatformCDN = {
    fetchAsset: async (path: string): Promise<Blob> => {
      // For standalone builds, assets should be in the app bundle
      let fetchPath = path
      
      // Handle different path formats:
      // 1. Already absolute URL (http/https) - use as-is
      // 2. Absolute path from root (/) - use as-is
      // 3. Already relative (./) - use as-is
      // 4. Already prefixed with cdn-assets/ - just add ./
      // 5. Other relative paths - prepend ./cdn-assets/
      if (path.startsWith('http://') || path.startsWith('https://')) {
        fetchPath = path
      } else if (path.startsWith('/')) {
        fetchPath = path
      } else if (path.startsWith('./')) {
        fetchPath = path
      } else if (path.startsWith('cdn-assets/')) {
        fetchPath = `./${path}`
      } else {
        // Relative path (like "Core.stow" or "shared3d/VFX/VFX_Core.stow")
        // All CDN assets are stored in public/cdn-assets/
        fetchPath = `./cdn-assets/${path}`
      }
      
      console.log(`${LOG_PREFIX} cdn.fetchAsset("${path}") => fetching from "${fetchPath}"`)
      
      try {
        const response = await fetch(fetchPath)
        if (!response.ok) {
          console.error(`${LOG_PREFIX} cdn.fetchAsset("${path}") => HTTP ${response.status} ${response.statusText}`)
          throw new Error(`Failed to fetch asset: ${path} (HTTP ${response.status})`)
        }
        const blob = await response.blob()
        console.log(`${LOG_PREFIX} cdn.fetchAsset("${path}") => success (${blob.size} bytes, type: ${blob.type})`)
        return blob
      } catch (error) {
        console.error(`${LOG_PREFIX} cdn.fetchAsset("${path}") => error:`, error)
        throw error
      }
    },
    fetchBlob: async (path: string): Promise<Blob> => {
      return this.cdn.fetchAsset(path)
    },
  }

  // Notification channel for Android 8+
  private notificationChannelCreated = false

  private async ensureNotificationChannel(): Promise<void> {
    if (this.notificationChannelCreated) return
    
    try {
      // Create notification channel for Android 8+ (API 26+)
      await LocalNotifications.createChannel({
        id: 'game_notifications',
        name: 'Game Notifications',
        description: 'Notifications from Burger Shop Rush',
        importance: 4, // High importance
        visibility: 1, // Public
        sound: 'default',
        vibration: true,
      })
      this.notificationChannelCreated = true
      console.log(`${LOG_PREFIX} notifications: channel created`)
    } catch (error) {
      // Channel creation might fail on iOS or older Android, that's OK
      console.log(`${LOG_PREFIX} notifications: channel creation skipped (not needed on this platform)`)
      this.notificationChannelCreated = true
    }
  }

  // Notifications implementation using @capacitor/local-notifications
  readonly notifications: PlatformNotifications = {
    scheduleAsync: async (
      title: string,
      body: string,
      delaySeconds: number,
      notificationId?: string
    ): Promise<void> => {
      const id = notificationId ? stringToNotificationId(notificationId) : Date.now()
      console.log(`${LOG_PREFIX} notifications.scheduleAsync("${title}", "${body}", ${delaySeconds}s, id=${id})`)
      
      try {
        // Request permission first
        const permission = await LocalNotifications.requestPermissions()
        console.log(`${LOG_PREFIX} notifications: permission status =`, permission.display)
        
        if (permission.display !== 'granted') {
          console.warn(`${LOG_PREFIX} notifications: permission not granted (${permission.display})`)
          return
        }

        // Ensure notification channel exists (Android 8+)
        await this.ensureNotificationChannel()

        const scheduledTime = new Date(Date.now() + delaySeconds * 1000)
        console.log(`${LOG_PREFIX} notifications: scheduling for ${scheduledTime.toISOString()}`)

        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title,
              body,
              schedule: { at: scheduledTime },
              channelId: 'game_notifications', // Required for Android 8+
              smallIcon: 'ic_launcher_background', // Must exist in res/drawable (avoids Invalid resource ID)
              largeIcon: 'ic_launcher',
            },
          ],
        })
        
        // Verify it was scheduled
        const pending = await LocalNotifications.getPending()
        console.log(`${LOG_PREFIX} notifications.scheduleAsync() => scheduled successfully, pending count: ${pending.notifications.length}`)
      } catch (error) {
        console.error(`${LOG_PREFIX} notifications.scheduleAsync() => error:`, error)
      }
    },
    cancelNotification: async (notificationId: string): Promise<void> => {
      const id = stringToNotificationId(notificationId)
      console.log(`${LOG_PREFIX} notifications.cancelNotification("${notificationId}") => id=${id}`)
      
      try {
        await LocalNotifications.cancel({
          notifications: [{ id }],
        })
        console.log(`${LOG_PREFIX} notifications.cancelNotification() => cancelled successfully`)
      } catch (error) {
        console.error(`${LOG_PREFIX} notifications.cancelNotification() => error:`, error)
      }
    },
  }

  // Lifecycles implementation using @capacitor/app
  private resumeCallbacks: (() => void)[] = []
  private pauseCallbacks: (() => void)[] = []
  private appListenerSetup = false

  readonly lifecycles: PlatformLifecycles = {
    onResume: (callback: () => void) => {
      console.log(`${LOG_PREFIX} lifecycles.onResume() - registered callback`)
      this.resumeCallbacks.push(callback)
    },
    onPause: (callback: () => void) => {
      console.log(`${LOG_PREFIX} lifecycles.onPause() - registered callback`)
      this.pauseCallbacks.push(callback)
    },
  }

  private async initAppsFlyerAsync(): Promise<void> {
    console.log(`${LOG_PREFIX} AppsFlyer: initAppsFlyerAsync() called (native platform)`)

    const devKey = (import.meta as any).env?.VITE_APPSFLYER_DEV_KEY as string | undefined
    if (!devKey || devKey === "your_dev_key_here") {
      console.warn(`${LOG_PREFIX} AppsFlyer: VITE_APPSFLYER_DEV_KEY not set or placeholder, skipping init`)
      return
    }
    console.log(`${LOG_PREFIX} AppsFlyer: dev key present (length ${devKey.length})`)

    try {
      const { AppsFlyer } = await import("appsflyer-capacitor-plugin")
      this.appsFlyerModule = { AppsFlyer }
      console.log(`${LOG_PREFIX} AppsFlyer: plugin loaded`)

      const appID = (import.meta as any).env?.VITE_APPSFLYER_APP_ID as string | undefined
      const isDebug = (import.meta as any).env?.VITE_APPSFLYER_DEBUG === "true" || (import.meta as any).env?.DEV === true

      await AppsFlyer.initSDK({
        devKey,
        appID: appID || "",
        isDebug,
        waitForATTUserAuthorization: 10,
        registerConversionListener: true,
        registerOnDeepLink: true,
      })
      console.log(`${LOG_PREFIX} AppsFlyer: initSDK() completed`)

      // Send login event to verify AppsFlyer is working (visible in In-app events)
      await AppsFlyer.logEvent({ eventName: "af_login", eventValue: { af_timestamp: Date.now().toString() } })
      console.log(`${LOG_PREFIX} AppsFlyer: af_login event sent`)
    } catch (err) {
      console.error(`${LOG_PREFIX} AppsFlyer init failed:`, err)
    }
  }

  // Preloader implementation using @capacitor/splash-screen
  readonly preloader: PlatformPreloader = {
    hideLoadScreen: async (): Promise<void> => {
      console.log(`${LOG_PREFIX} preloader.hideLoadScreen()`)
      try {
        await SplashScreen.hide()
        console.log(`${LOG_PREFIX} preloader.hideLoadScreen() => splash screen hidden`)
      } catch (error) {
        console.log(`${LOG_PREFIX} preloader.hideLoadScreen() => no splash screen to hide (web mode)`)
      }
      
      // Also hide any custom loading element
      const loader = document.getElementById("loading-screen")
      if (loader) {
        loader.style.display = "none"
        console.log(`${LOG_PREFIX} preloader.hideLoadScreen() - hid #loading-screen element`)
      }
    },
  }

  // Initialize
  async initializeAsync(options?: { usePreloader?: boolean }): Promise<PlatformContext> {
    console.log(`${LOG_PREFIX} initializeAsync()`, options)

    // Init AppsFlyer on native only (Android/iOS) - enables retention, installs, sessions
    if (Capacitor.isNativePlatform()) {
      await this.initAppsFlyerAsync()
    }

    // Set up lifecycle listeners using Capacitor App plugin
    if (!this.appListenerSetup) {
      this.appListenerSetup = true
      
      try {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            console.log(`${LOG_PREFIX} app state: active - calling ${this.resumeCallbacks.length} resume callbacks`)
            this.resumeCallbacks.forEach(cb => cb())
          } else {
            console.log(`${LOG_PREFIX} app state: inactive - calling ${this.pauseCallbacks.length} pause callbacks`)
            this.pauseCallbacks.forEach(cb => cb())
          }
        })
        console.log(`${LOG_PREFIX} App lifecycle listener registered`)
      } catch (error) {
        console.log(`${LOG_PREFIX} App plugin not available (web mode), using visibility API fallback`)
        // Fallback using visibility API for web testing
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) {
            console.log(`${LOG_PREFIX} visibility: hidden - calling pause callbacks`)
            this.pauseCallbacks.forEach(cb => cb())
          } else {
            console.log(`${LOG_PREFIX} visibility: visible - calling resume callbacks`)
            this.resumeCallbacks.forEach(cb => cb())
          }
        })
      }
    }

    console.log(`${LOG_PREFIX} ✅ Platform initialized successfully`)
    
    return {
      initialized: true,
      data: { platform: "capacitor" },
    }
  }

  // Logging
  log(message: string, ...args: unknown[]): void {
    console.log(`${LOG_PREFIX} log:`, message, ...args)
  }
}
