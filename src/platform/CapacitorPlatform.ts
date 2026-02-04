/**
 * Capacitor Platform Implementation
 * 
 * Implements the PlatformService interface using Capacitor plugins.
 * Used for standalone APK/iOS builds.
 * 
 * Required Capacitor plugins (install when ready):
 *   npm install @capacitor/core @capacitor/cli
 *   npm install @capacitor/preferences        # For storage
 *   npm install @capacitor/app                # For lifecycle
 *   npm install @capacitor/local-notifications # For notifications
 *   npm install @capacitor-community/admob    # For ads (optional)
 *   
 * Then:
 *   npx cap init
 *   npx cap add android
 */

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

/**
 * CapacitorPlatform - Implementation using Capacitor plugins
 * 
 * This is a stub implementation. Uncomment and implement sections
 * as you add the corresponding Capacitor plugins.
 */
export class CapacitorPlatform implements PlatformService {
  readonly platformId = "capacitor" as const

  // Storage implementation using @capacitor/preferences
  readonly storage: PlatformStorage = {
    getItem: async (key: string): Promise<string | null> => {
      console.log(`${LOG_PREFIX} storage.getItem("${key}")`)
      // Uncomment when @capacitor/preferences is installed:
      // import { Preferences } from "@capacitor/preferences"
      // const { value } = await Preferences.get({ key })
      // return value
      
      // Fallback to localStorage for now
      const value = localStorage.getItem(key)
      console.log(`${LOG_PREFIX} storage.getItem("${key}") =>`, value ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` : 'null')
      return value
    },
    setItem: async (key: string, value: string): Promise<void> => {
      console.log(`${LOG_PREFIX} storage.setItem("${key}", "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}")`)
      // Uncomment when @capacitor/preferences is installed:
      // import { Preferences } from "@capacitor/preferences"
      // await Preferences.set({ key, value })
      
      localStorage.setItem(key, value)
    },
    removeItem: async (key: string): Promise<void> => {
      console.log(`${LOG_PREFIX} storage.removeItem("${key}")`)
      // Uncomment when @capacitor/preferences is installed:
      // import { Preferences } from "@capacitor/preferences"
      // await Preferences.remove({ key })
      
      localStorage.removeItem(key)
    },
    length: async (): Promise<number> => {
      const len = localStorage.length
      console.log(`${LOG_PREFIX} storage.length() => ${len}`)
      return len
    },
    key: async (index: number): Promise<string | null> => {
      const key = localStorage.key(index)
      console.log(`${LOG_PREFIX} storage.key(${index}) => "${key}"`)
      return key
    },
  }

  // Cache implementation (same as storage for Capacitor)
  readonly cache: PlatformCache = {
    getItem: async (key: string): Promise<string | null> => {
      console.log(`${LOG_PREFIX} cache.getItem("${key}")`)
      const value = localStorage.getItem(`cache_${key}`)
      console.log(`${LOG_PREFIX} cache.getItem("${key}") =>`, value ? `"${value.substring(0, 50)}..."` : 'null')
      return value
    },
    setItem: async (key: string, value: string): Promise<void> => {
      console.log(`${LOG_PREFIX} cache.setItem("${key}", "${value.substring(0, 50)}...")`)
      localStorage.setItem(`cache_${key}`, value)
    },
    removeItem: async (key: string): Promise<void> => {
      console.log(`${LOG_PREFIX} cache.removeItem("${key}")`)
      localStorage.removeItem(`cache_${key}`)
    },
  }

  // Analytics implementation
  // For production, integrate with Firebase Analytics or similar
  readonly analytics: PlatformAnalytics = {
    trackFunnelStep: (step: number, name: string) => {
      console.log(`${LOG_PREFIX} analytics.trackFunnelStep(${step}, "${name}")`)
      // Uncomment when @capacitor-community/firebase-analytics is installed:
      // import { FirebaseAnalytics } from "@capacitor-community/firebase-analytics"
      // FirebaseAnalytics.logEvent({ name: "funnel_step", params: { step, name } })
    },
    recordCustomEvent: (eventName: string, params?: Record<string, unknown>) => {
      console.log(`${LOG_PREFIX} analytics.recordCustomEvent("${eventName}")`, params)
      // Uncomment when @capacitor-community/firebase-analytics is installed:
      // import { FirebaseAnalytics } from "@capacitor-community/firebase-analytics"
      // FirebaseAnalytics.logEvent({ name: eventName, params })
    },
  }

  // Ads implementation
  // Requires @capacitor-community/admob
  readonly ads: PlatformAds = {
    showRewardedAdAsync: async (): Promise<boolean> => {
      console.log(`${LOG_PREFIX} ads.showRewardedAdAsync() - returning true (stub)`)
      // Uncomment when @capacitor-community/admob is installed:
      // import { AdMob, RewardAdOptions } from "@capacitor-community/admob"
      // const options: RewardAdOptions = {
      //   adId: "YOUR_REWARDED_AD_ID",
      // }
      // try {
      //   await AdMob.prepareRewardVideoAd(options)
      //   const result = await AdMob.showRewardVideoAd()
      //   return result.type === "earned"
      // } catch (e) {
      //   console.error("Failed to show rewarded ad:", e)
      //   return false
      // }
      
      // Return true for testing so the game flow continues
      return true
    },
    showInterstitialAd: async (): Promise<boolean> => {
      console.log(`${LOG_PREFIX} ads.showInterstitialAd() - returning true (stub)`)
      // Uncomment when @capacitor-community/admob is installed:
      // import { AdMob, InterstitialAdOptions } from "@capacitor-community/admob"
      // const options: InterstitialAdOptions = {
      //   adId: "YOUR_INTERSTITIAL_AD_ID",
      // }
      // try {
      //   await AdMob.prepareInterstitial(options)
      //   await AdMob.showInterstitial()
      //   return true
      // } catch (e) {
      //   console.error("Failed to show interstitial ad:", e)
      //   return false
      // }
      
      return true
    },
  }

  // IAP implementation
  // Requires @capacitor-community/in-app-purchases or similar
  readonly iap: PlatformIAP = {
    getHardCurrencyBalance: async (): Promise<number> => {
      // For standalone builds, you might store currency locally
      // or integrate with a backend service
      const stored = localStorage.getItem("premium_currency")
      const balance = stored ? parseInt(stored, 10) : 0
      console.log(`${LOG_PREFIX} iap.getHardCurrencyBalance() => ${balance}`)
      return balance
    },
    spendCurrency: async (productId: string, amount: number): Promise<void> => {
      console.log(`${LOG_PREFIX} iap.spendCurrency("${productId}", ${amount})`)
      const current = await this.iap.getHardCurrencyBalance()
      if (current < amount) {
        throw new Error("Insufficient currency")
      }
      localStorage.setItem("premium_currency", (current - amount).toString())
    },
    openStore: async (): Promise<void> => {
      console.log(`${LOG_PREFIX} iap.openStore() - not implemented (stub)`)
      // Uncomment when @capacitor-community/in-app-purchases is installed:
      // Show your custom store UI or open native purchase flow
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
        // Absolute URL, use as-is
        fetchPath = path
      } else if (path.startsWith('/')) {
        // Absolute path from root
        fetchPath = path
      } else if (path.startsWith('./')) {
        // Already relative, use as-is
        fetchPath = path
      } else if (path.startsWith('cdn-assets/')) {
        // Already has cdn-assets prefix, just add ./
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

  // Notifications implementation
  // Requires @capacitor/local-notifications
  readonly notifications: PlatformNotifications = {
    scheduleAsync: async (
      title: string,
      body: string,
      delaySeconds: number,
      notificationId?: string
    ): Promise<void> => {
      console.log(`${LOG_PREFIX} notifications.scheduleAsync("${title}", "${body}", ${delaySeconds}s, id=${notificationId || 'auto'})`)
      // Uncomment when @capacitor/local-notifications is installed:
      // import { LocalNotifications } from "@capacitor/local-notifications"
      // await LocalNotifications.schedule({
      //   notifications: [
      //     {
      //       id: notificationId ? parseInt(notificationId) : Date.now(),
      //       title,
      //       body,
      //       schedule: { at: new Date(Date.now() + delaySeconds * 1000) },
      //     },
      //   ],
      // })
    },
    cancelNotification: async (notificationId: string): Promise<void> => {
      console.log(`${LOG_PREFIX} notifications.cancelNotification("${notificationId}")`)
      // Uncomment when @capacitor/local-notifications is installed:
      // import { LocalNotifications } from "@capacitor/local-notifications"
      // await LocalNotifications.cancel({
      //   notifications: [{ id: parseInt(notificationId) }],
      // })
    },
  }

  // Lifecycles implementation
  // Uses @capacitor/app
  private resumeCallbacks: (() => void)[] = []
  private pauseCallbacks: (() => void)[] = []

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

  // Preloader implementation
  readonly preloader: PlatformPreloader = {
    hideLoadScreen: async (): Promise<void> => {
      console.log(`${LOG_PREFIX} preloader.hideLoadScreen()`)
      // For Capacitor, you might use @capacitor/splash-screen
      // Uncomment when @capacitor/splash-screen is installed:
      // import { SplashScreen } from "@capacitor/splash-screen"
      // await SplashScreen.hide()
      
      // Or just hide a custom loading element
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
    
    // Set up lifecycle listeners using Capacitor App plugin
    // Uncomment when @capacitor/app is installed:
    // import { App } from "@capacitor/app"
    // App.addListener("appStateChange", ({ isActive }) => {
    //   if (isActive) {
    //     this.resumeCallbacks.forEach(cb => cb())
    //   } else {
    //     this.pauseCallbacks.forEach(cb => cb())
    //   }
    // })

    // Fallback using visibility API
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        console.log(`${LOG_PREFIX} visibility: hidden - calling pause callbacks`)
        this.pauseCallbacks.forEach(cb => cb())
      } else {
        console.log(`${LOG_PREFIX} visibility: visible - calling resume callbacks`)
        this.resumeCallbacks.forEach(cb => cb())
      }
    })

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
