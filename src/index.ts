export * from "./engine"

// Platform abstraction layer - recommended for new code
export * from "./platform"
export { Platform } from "./platform"

// Note: RundotGameAPI is no longer exported directly to prevent loading in Capacitor builds.
// Use Platform instead, which auto-detects the correct implementation.
// For Rundot builds that need direct RundotGameAPI access, import from "@series-inc/rundot-game-sdk/api" directly.