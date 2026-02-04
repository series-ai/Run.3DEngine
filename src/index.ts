export * from "./engine"

// Platform abstraction layer - recommended for new code
export * from "./platform"
export { Platform } from "./platform"

// Legacy: Direct RundotGameAPI exports for backward compatibility
// New code should use Platform instead
export * from "@series-inc/rundot-game-sdk"
export { default as RundotGameAPI } from "@series-inc/rundot-game-sdk/api"