/**
 * Rundot Platform Implementation
 * 
 * Wraps the RundotGameAPI SDK to implement the PlatformService interface.
 * Used when running on the Rundot platform (web builds deployed to Rundot).
 */

import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
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

/**
 * RundotPlatform - Implementation using @series-inc/rundot-game-sdk
 */
export class RundotPlatform implements PlatformService {
  readonly platformId = "rundot" as const

  // Storage implementation
  readonly storage: PlatformStorage = {
    getItem: (key: string) => RundotGameAPI.appStorage.getItem(key),
    setItem: (key: string, value: string) => RundotGameAPI.appStorage.setItem(key, value),
    removeItem: (key: string) => RundotGameAPI.appStorage.removeItem(key),
    length: () => RundotGameAPI.appStorage.length(),
    key: (index: number) => RundotGameAPI.appStorage.key(index),
  }

  // Cache implementation
  readonly cache: PlatformCache = {
    getItem: (key: string) => RundotGameAPI.deviceCache.getItem(key),
    setItem: (key: string, value: string) => RundotGameAPI.deviceCache.setItem(key, value),
    removeItem: (key: string) => RundotGameAPI.deviceCache.removeItem(key),
  }

  // Analytics implementation
  readonly analytics: PlatformAnalytics = {
    trackFunnelStep: (step: number, name: string) => {
      RundotGameAPI.analytics.trackFunnelStep(step, name)
    },
    recordCustomEvent: (eventName: string, params?: Record<string, unknown>) => {
      RundotGameAPI.analytics.recordCustomEvent(eventName, params ?? {})
    },
  }

  // Ads implementation
  readonly ads: PlatformAds = {
    showRewardedAdAsync: () => RundotGameAPI.ads.showRewardedAdAsync(),
    showInterstitialAd: () => RundotGameAPI.ads.showInterstitialAd(),
  }

  // IAP implementation
  readonly iap: PlatformIAP = {
    getHardCurrencyBalance: () => RundotGameAPI.iap.getHardCurrencyBalance(),
    spendCurrency: (productId: string, amount: number) => 
      RundotGameAPI.iap.spendCurrency(productId, amount),
    openStore: () => RundotGameAPI.iap.openStore(),
  }

  // CDN implementation
  readonly cdn: PlatformCDN = {
    fetchAsset: (path: string) => RundotGameAPI.cdn.fetchAsset(path),
    fetchBlob: (path: string) => RundotGameAPI.cdn.fetchAsset(path),
  }

  // Notifications implementation
  readonly notifications: PlatformNotifications = {
    scheduleAsync: async (
      title: string,
      body: string,
      delaySeconds: number,
      notificationId?: string
    ) => {
      await RundotGameAPI.notifications.scheduleAsync(
        title,
        body,
        delaySeconds,
        notificationId
      )
    },
    cancelNotification: async (notificationId: string): Promise<void> => {
      await RundotGameAPI.notifications.cancelNotification(notificationId)
    },
  }

  // Lifecycles implementation
  readonly lifecycles: PlatformLifecycles = {
    onResume: (callback: () => void) => {
      RundotGameAPI.lifecycles.onResume(callback)
    },
    onPause: (callback: () => void) => {
      RundotGameAPI.lifecycles.onPause(callback)
    },
  }

  // Preloader implementation
  readonly preloader: PlatformPreloader = {
    hideLoadScreen: () => RundotGameAPI.preloader.hideLoadScreen(),
  }

  // Initialize
  async initializeAsync(options?: { usePreloader?: boolean }): Promise<PlatformContext> {
    const context = await RundotGameAPI.initializeAsync({
      usePreloader: options?.usePreloader ?? true,
    })
    return {
      initialized: true,
      data: context,
    }
  }

  // Logging
  log(message: string, ...args: unknown[]): void {
    RundotGameAPI.log(message, ...args)
  }
}
