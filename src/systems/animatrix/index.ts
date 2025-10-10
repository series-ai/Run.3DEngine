// Legacy exports - still available for backwards compatibility
export { default } from "./animatrix"
export { default as AnimatrixVisualizer } from "./visualizer"
export { AnimationLibrary } from "./animation-library"
export {
  ParameterType,
  ComparisonOperator,
  TransitionMode,
  BlendType,
  AnimationEvent,
  type Parameter,
  type TransitionCondition,
  type TransitionConfig,
  type ClipConfig,
  type AnimationClip,
  type ActiveTransition,
  type BlendTreeChild1D,
  type BlendTree1DConfig,
  type LibraryClipFromIdConfig,
  type LibraryBlendTreeChildConfig,
  type LibraryBlendTree1DWrapper,
  type ClipEventMarker,
} from "./animatrix"

// Component-Based Exports - All use shared animation system internally
export { AnimationControllerComponent } from "./AnimationControllerComponent"
export { AnimationLibraryComponent } from "./AnimationLibraryComponent"
export { AnimationVisualizerComponent } from "./AnimationVisualizerComponent"
export { AnimationGraphComponent } from "./AnimationGraphComponent"

// Shared Animation System - Used internally by all animation components
export { SharedAnimationManager, CharacterAnimationController } from "./SharedAnimationManager"

// Utility exports
export { AnimationConsoleFilter } from "./AnimationConsoleFilter"
export { AnimationPerformance } from "./AnimationPerformance"

// Re-export the core Animatrix class for advanced usage
export { default as Animatrix } from "./animatrix"
