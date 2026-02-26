export * from "./engine"

// Do NOT re-export @series-inc/rundot-game-sdk here. Capacitor builds bundle this
// index and would leave a bare specifier the WebView can't resolve. RunDot apps
// should import RundotGameAPI from "@series-inc/rundot-game-sdk/api" directly.
// RundotPlatform loads the SDK via dynamic import when needed.

// Platform abstraction (Rundot vs Capacitor) - used by VenusGame for web + Android
export * from "./platform"
export { Platform } from "./platform"
