import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { AnimationLibrary } from "./animation-library"
import { AnimationPerformance } from "./AnimationPerformance"

export enum ParameterType {
  BOOL = "bool",
  FLOAT = "float",
  INT = "int",
  TRIGGER = "trigger",
}

export enum ComparisonOperator {
  EQUALS = "==",
  NOT_EQUALS = "!=",
  GREATER = ">",
  LESS = "<",
  GREATER_EQUALS = ">=",
  LESS_EQUALS = "<=",
}

export enum TransitionMode {
  IMMEDIATE = 0,
  EXIT_TIME = 1,
  BLEND = 2,
}

export enum BlendType {
  LINEAR = "linear",
  EASE_IN_OUT = "ease_in_out",
  EASE_IN_OUT_QUINT = "ease_in_out_quint",
  EASE_IN_OUT_SINE = "ease_in_out_sine",
}

export enum AnimationEvent {
  STATE_CHANGED = "state_changed",
  TRANSITION_START = "transition_start",
  TRANSITION_END = "transition_end",
}

// Marker fired when a clip's local time crosses a normalized time threshold
export interface ClipEventMarker {
  // Normalized time in [0,1] within the trimmed clip window (start_time..end_time)
  time: number
  // Event name to emit via emit_event
  event: string
  // Optional payload included with the event
  payload?: any
}

// 1D Blend Tree types
export interface BlendTreeChild1D {
  state_id: string
  threshold: number
}

export interface BlendTree1DConfig {
  id: string // state id used to reference this blend tree
  parameter: string // float parameter name driving the blending
  children: BlendTreeChild1D[] // references to existing clip state ids
}

export interface Parameter {
  type: ParameterType
  value: any
}

export interface TransitionCondition {
  parameter: string
  operator: ComparisonOperator
  value: any
}

export interface TransitionConfig {
  from: string
  to: string
  conditions: TransitionCondition[]
  exit_time?: number
  duration?: number
  mode?: TransitionMode
  priority?: number
  blend_type?: BlendType
}

export interface ClipConfig {
  animation: THREE.AnimationClip
  speed?: number
  loop?: boolean
  start_time?: number // Optional start time in seconds (trims from beginning)
  end_time?: number // Optional end time in seconds (trims from end)
}

export interface AnimationClip {
  id: string
  animation: THREE.AnimationClip
  speed: number
  loop: boolean
  weight: number
  action: THREE.AnimationAction | null
  is_playing: boolean
  start_time: number // Start time in seconds (0 = beginning)
  end_time: number // End time in seconds (animation.duration = full length)
}

export interface ActiveTransition {
  from_state: string
  to_state: string
  duration: number
  progress: number
  blend_type: BlendType
}

// Library configuration helpers for configure_clips_from_library
export interface LibraryClipFromIdConfig {
  library_id: string
  speed?: number
  loop?: boolean
  start_time?: number
  end_time?: number
  event_markers?: ClipEventMarker[]
}

export interface LibraryBlendTreeChildConfig {
  state_id?: string // optional explicit state id for the child clip
  library_id?: string // optional library id to auto-add the child clip if not already added
  threshold: number
  speed?: number
  loop?: boolean
  start_time?: number
  end_time?: number
  event_markers?: ClipEventMarker[]
}

export interface LibraryBlendTree1DWrapper {
  blend_tree_1d: {
    parameter: string
    children: LibraryBlendTreeChildConfig[]
  }
}

export default class Animatrix {
  private clips: Map<string, AnimationClip>
  private parameters: Map<string, Parameter>
  private transitions: TransitionConfig[]
  private mixer: THREE.AnimationMixer | null
  private current_state: string | null
  private active_transition: ActiveTransition | null
  private event_listeners: Map<string, Array<(data?: any) => void>>
  private loader: FBXLoader
  private debug_mode: boolean
  private any_state_transitions: TransitionConfig[]
  private blend_trees: Map<string, BlendTree1DConfig>
  private clip_event_markers: Map<string, ClipEventMarker[]>
  private clip_event_cursors: Map<string, number>
  private model: THREE.Object3D
  private externalMixer: boolean = false

  constructor(model: THREE.Object3D, debug: boolean = false, externalMixer?: THREE.AnimationMixer) {
    this.clips = new Map()
    this.parameters = new Map()
    this.transitions = []
    this.any_state_transitions = []
    
    // Use external mixer if provided, otherwise create our own
    if (externalMixer) {
      this.mixer = externalMixer
      this.externalMixer = true
    } else {
      this.mixer = new THREE.AnimationMixer(model)
      this.externalMixer = false
    }
    
    this.model = model
    this.current_state = null
    this.active_transition = null
    this.event_listeners = new Map()
    this.loader = new FBXLoader()
    // Use recommended settings for platform
    const settings = AnimationPerformance.getRecommendedSettings()
    this.debug_mode = debug && settings.enableDebugLogs
    this.blend_trees = new Map()
    this.clip_event_markers = new Map()
    this.clip_event_cursors = new Map()

    // Optimize model for mobile if needed
    if (AnimationPerformance.isMobile()) {
      AnimationPerformance.optimizeModelForMobile(model, settings.maxSkinInfluences)
    }
    
    if (this.debug_mode) {
      console.log("[Animatrix] Initialized with model")
    }
  }

  public add_parameter(
    name: string,
    type: ParameterType,
    initial_value: any = null,
  ): void {
    const default_values = {
      [ParameterType.BOOL]: false,
      [ParameterType.FLOAT]: 0.0,
      [ParameterType.INT]: 0,
      [ParameterType.TRIGGER]: false,
    }

    this.parameters.set(name, {
      type: type,
      value: initial_value !== null ? initial_value : default_values[type],
    })

    if (this.debug_mode) {
      console.log(
        `[Animatrix] Added parameter: ${name} (${type}) = ${initial_value !== null ? initial_value : default_values[type]}`,
      )
    }
  }

  public set_bool(name: string, value: boolean): void {
    const param = this.parameters.get(name)
    if (param && param.type === ParameterType.BOOL) {
      param.value = value
    }
  }

  public set_float(name: string, value: number): void {
    const param = this.parameters.get(name)
    if (param && param.type === ParameterType.FLOAT) {
      param.value = value
    }
  }

  public set_int(name: string, value: number): void {
    const param = this.parameters.get(name)
    if (param && param.type === ParameterType.INT) {
      param.value = Math.floor(value)
    }
  }

  public set_trigger(name: string): void {
    const param = this.parameters.get(name)
    if (param && param.type === ParameterType.TRIGGER) {
      param.value = true
    }
  }

  public get_bool(name: string): boolean {
    const param = this.parameters.get(name)
    return param && param.type === ParameterType.BOOL ? param.value : false
  }

  public get_float(name: string): number {
    const param = this.parameters.get(name)
    return param && param.type === ParameterType.FLOAT ? param.value : 0.0
  }

  public get_int(name: string): number {
    const param = this.parameters.get(name)
    return param && param.type === ParameterType.INT ? param.value : 0
  }

  public add_clip(
    state_id: string,
    animation: THREE.AnimationClip,
    speed: number = 1.0,
    loop: boolean = true,
    start_time: number = 0,
    end_time?: number,
  ): void {
    // Clean the animation clip to remove missing bone tracks
    animation = AnimationPerformance.cleanAnimationClip(animation, this.model, true)
    let actual_end_time = end_time !== undefined ? end_time : animation.duration

    // Validate times
    if (start_time < 0) start_time = 0
    if (actual_end_time > animation.duration)
      actual_end_time = animation.duration
    if (start_time >= actual_end_time) {
      console.warn(
        `[Animatrix] Invalid start/end times for clip ${state_id}: start=${start_time}, end=${actual_end_time}`,
      )
      start_time = 0
    }

    const clip: AnimationClip = {
      id: state_id,
      animation: animation,
      speed: speed,
      loop: loop,
      weight: 0.0,
      action: null,
      is_playing: false,
      start_time: start_time,
      end_time: actual_end_time,
    }

    if (this.mixer) {
      clip.action = this.mixer.clipAction(animation)
      clip.action.setLoop(
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
        loop ? Infinity : 1,
      )
      clip.action.clampWhenFinished = !loop
      clip.action.timeScale = speed
      clip.action.weight = 0.0
      clip.action.enabled = true
    }

    this.clips.set(state_id, clip)

    if (this.debug_mode) {
      const trimInfo =
        start_time > 0 || actual_end_time < animation.duration
          ? `, trimmed: ${start_time.toFixed(2)}s-${actual_end_time.toFixed(2)}s`
          : ""
      console.log(
        `[Animatrix] Added clip: ${state_id} (speed: ${speed}, loop: ${loop}${trimInfo})`,
      )
    }
  }

  public configure_clips(configs: { [key: string]: ClipConfig }): void {
    for (const [state_id, config] of Object.entries(configs)) {
      this.add_clip(
        state_id,
        config.animation,
        config.speed || 1.0,
        config.loop !== false,
        config.start_time || 0,
        config.end_time,
      )
    }
  }

  public add_clip_from_library(
    state_id: string,
    library_id: string,
    speed: number = 1.0,
    loop: boolean = true,
    start_time: number = 0,
    end_time?: number,
  ): boolean {
    const clip = AnimationLibrary.getClip(library_id)
    if (!clip) {
      if (this.debug_mode) {
        console.warn(
          `[Animatrix] Animation '${library_id}' not found in library`,
        )
      }
      return false
    }

    this.add_clip(state_id, clip, speed, loop, start_time, end_time)
    return true
  }

  public configure_clips_from_library(configs: {
    [state_id: string]: LibraryClipFromIdConfig | LibraryBlendTree1DWrapper
  }): void {
    for (const [state_id, cfg] of Object.entries(configs)) {
      const maybeTree = (cfg as any).blend_tree_1d as
        | LibraryBlendTree1DWrapper["blend_tree_1d"]
        | undefined
      if (maybeTree) {
        // Ensure child clips exist; allow specifying either existing state_id or library_id
        const childrenResolved: BlendTreeChild1D[] = []
        for (const child of maybeTree.children) {
          let childStateId = child.state_id
          if (!childStateId && child.library_id) {
            // Create a deterministic child state id from parent and threshold if not provided
            childStateId = `${state_id}_child_${child.library_id}_${child.threshold}`
            if (!this.has_clip(childStateId)) {
              const ok = this.add_clip_from_library(
                childStateId,
                child.library_id,
                child.speed ?? 1.0,
                child.loop !== false,
                child.start_time ?? 0,
                child.end_time,
              )
              if (!ok && this.debug_mode) {
                console.warn(
                  `[Animatrix] Failed to add child clip '${child.library_id}' for blend tree '${state_id}'.`,
                )
              }
            }
          }
          
          // Add event markers if specified
          if (childStateId && child.event_markers) {
            this.add_clip_event_markers(childStateId, child.event_markers)
            if (this.debug_mode) {
              console.log(`[Animatrix] Added ${child.event_markers.length} event markers to clip '${childStateId}'`)
            }
          }

          if (!childStateId) {
            console.warn(
              `[Animatrix] Blend tree '${state_id}' child missing state_id/library_id; skipping.`,
            )
            continue
          }

          // If explicit state_id is provided and clip options are included, honor them if the state exists
          if (child.state_id && this.has_clip(child.state_id)) {
            if (typeof child.speed === "number")
              this.set_clip_speed(child.state_id, child.speed)
            if (typeof child.loop === "boolean")
              this.set_clip_loop(child.state_id, child.loop)
            // start/end trim requires re-adding; omit for simplicity in this branch
          }

          childrenResolved.push({
            state_id: childStateId,
            threshold: child.threshold,
          })
        }

        this.add_blend_tree_1d({
          id: state_id,
          parameter: maybeTree.parameter,
          children: childrenResolved,
        })
      } else {
        const clipCfg = cfg as LibraryClipFromIdConfig
        this.add_clip_from_library(
          state_id,
          clipCfg.library_id,
          clipCfg.speed || 1.0,
          clipCfg.loop !== false,
          clipCfg.start_time || 0,
          clipCfg.end_time,
        )
        
        // Add event markers if specified
        if (clipCfg.event_markers) {
          this.add_clip_event_markers(state_id, clipCfg.event_markers)
        }
      }
    }
  }

  public swap_model(new_model: THREE.Object3D): void {
    if (this.mixer) {
      this.stop_all()
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.mixer.getRoot())
    }

    this.mixer = new THREE.AnimationMixer(new_model)
    this.model = new_model
    
    // Optimize the new model for mobile if needed
    const settings = AnimationPerformance.getRecommendedSettings()
    if (AnimationPerformance.isMobile()) {
      AnimationPerformance.optimizeModelForMobile(new_model, settings.maxSkinInfluences)
    }

    this.clips.forEach((clip, state_id) => {
      if (clip.animation) {
        clip.action = this.mixer!.clipAction(clip.animation)
        clip.action.setLoop(
          clip.loop ? THREE.LoopRepeat : THREE.LoopOnce,
          clip.loop ? Infinity : 1,
        )
        clip.action.clampWhenFinished = !clip.loop
        clip.action.timeScale = clip.speed
        clip.action.weight = 0.0
        clip.action.enabled = true
      }
    })

    if (this.debug_mode) {
      console.log(
        "[Animatrix] Swapped to new model, re-initialized all animation actions",
      )
    }
  }

  public add_transition(config: TransitionConfig): void {
    config.duration = config.duration || 0.3
    config.mode = config.mode || TransitionMode.BLEND
    config.priority = config.priority || 0
    config.exit_time = config.exit_time || 0
    config.blend_type = config.blend_type || BlendType.LINEAR

    if (config.from === "*") {
      this.any_state_transitions.push(config)
    } else {
      this.transitions.push(config)
    }

    if (this.debug_mode) {
      const conditions_str = config.conditions
        .map((c) => `${c.parameter} ${c.operator} ${c.value}`)
        .join(" && ")
      console.log(
        `[Animatrix] Added transition: ${config.from} -> ${config.to} when [${conditions_str}]`,
      )
    }
  }

  public configure_graph(transitions: TransitionConfig[]): void {
    transitions.forEach((t) => this.add_transition(t))
  }

  // Blend Tree (1D) internal builder (configured via configure_clips_from_library)
  private add_blend_tree_1d(config: BlendTree1DConfig): void {
    const param = this.parameters.get(config.parameter)
    if (!param || param.type !== ParameterType.FLOAT) {
      this.add_parameter(config.parameter, ParameterType.FLOAT, 0.0)
    }

    const sortedChildren = [...config.children].sort(
      (a, b) => a.threshold - b.threshold,
    )
    for (const child of sortedChildren) {
      if (!this.clips.has(child.state_id)) {
        console.warn(
          `[Animatrix] BlendTree '${config.id}' references missing clip '${child.state_id}'.`,
        )
      }
    }
    this.blend_trees.set(config.id, {
      id: config.id,
      parameter: config.parameter,
      children: sortedChildren,
    })

    if (this.debug_mode) {
      console.log(
        `[Animatrix] Added BlendTree1D: ${config.id} (param: ${config.parameter}, children: ${sortedChildren.length})`,
      )
    }
  }

  public has_blend_tree(state_id: string): boolean {
    return this.blend_trees.has(state_id)
  }

  private get_blend_tree(state_id: string): BlendTree1DConfig | undefined {
    return this.blend_trees.get(state_id)
  }

  private compute_blend_weights_1d(
    children: BlendTreeChild1D[],
    value: number,
  ): Map<string, number> {
    const weights = new Map<string, number>()
    if (children.length === 0) return weights

    if (value <= children[0].threshold) {
      weights.set(children[0].state_id, 1.0)
      return weights
    }
    if (value >= children[children.length - 1].threshold) {
      const last = children[children.length - 1]
      weights.set(last.state_id, 1.0)
      return weights
    }

    for (let i = 0; i < children.length - 1; i++) {
      const a = children[i]
      const b = children[i + 1]
      if (value >= a.threshold && value <= b.threshold) {
        const range = b.threshold - a.threshold
        const t = range > 0 ? (value - a.threshold) / range : 0.0
        weights.set(a.state_id, 1.0 - t)
        weights.set(b.state_id, t)
        break
      }
    }
    return weights
  }

  private evaluate_condition(condition: TransitionCondition): boolean {
    const param = this.parameters.get(condition.parameter)
    if (!param) return false

    const param_value = param.value
    const target_value = condition.value

    switch (condition.operator) {
      case ComparisonOperator.EQUALS:
        return param_value === target_value
      case ComparisonOperator.NOT_EQUALS:
        return param_value !== target_value
      case ComparisonOperator.GREATER:
        return param_value > target_value
      case ComparisonOperator.LESS:
        return param_value < target_value
      case ComparisonOperator.GREATER_EQUALS:
        return param_value >= target_value
      case ComparisonOperator.LESS_EQUALS:
        return param_value <= target_value
      default:
        return false
    }
  }

  private evaluate_transitions(): void {
    if (!this.current_state || this.active_transition) return

    const all_transitions = [...this.any_state_transitions, ...this.transitions]
    all_transitions.sort((a, b) => (b.priority || 0) - (a.priority || 0))

    for (const transition of all_transitions) {
      if (transition.from !== this.current_state && transition.from !== "*")
        continue
      if (transition.to === this.current_state) continue

      if (
        transition.mode === TransitionMode.EXIT_TIME &&
        transition.exit_time
      ) {
        const clip = this.clips.get(this.current_state)
        if (clip && clip.action && !clip.loop) {
          const trimmed_duration = clip.end_time - clip.start_time
          const current_time = clip.action.time - clip.start_time
          const normalized_time = current_time / trimmed_duration
          if (normalized_time < transition.exit_time) continue
        }
      }

      const all_conditions_met = transition.conditions.every((c) =>
        this.evaluate_condition(c),
      )

      if (all_conditions_met) {
        this.start_transition(
          transition.to,
          transition.duration || 0.3,
          transition.blend_type || BlendType.LINEAR,
        )

        transition.conditions.forEach((c) => {
          const param = this.parameters.get(c.parameter)
          if (param && param.type === ParameterType.TRIGGER) {
            param.value = false
          }
        })

        if (this.debug_mode) {
          const conditions_str = transition.conditions
            .map((c) => `${c.parameter} ${c.operator} ${c.value}`)
            .join(" && ")
          // Transition triggered: ${this.current_state} -> ${transition.to}
        }
        break
      }
    }
  }

  private start_transition(
    to_state: string,
    duration: number,
    blend_type: BlendType = BlendType.LINEAR,
  ): void {
    const to_is_blend = this.has_blend_tree(to_state)
    const to_clip = this.clips.get(to_state)
    if (!to_is_blend && (!to_clip || !to_clip.action)) return

    this.active_transition = {
      from_state: this.current_state || "",
      to_state: to_state,
      duration: duration,
      progress: 0.0,
      blend_type: blend_type,
    }

    if (to_is_blend) {
      const tree = this.get_blend_tree(to_state)!
      for (const child of tree.children) {
        const childClip = this.clips.get(child.state_id)
        if (childClip && childClip.action) {
          childClip.action.reset()
          if (childClip.start_time > 0) {
            childClip.action.time = childClip.start_time
          }
          childClip.action.play()
          childClip.is_playing = true
          childClip.action.weight = 0.0
          childClip.weight = 0.0
        }
      }
    } else if (to_clip && to_clip.action) {
      to_clip.action.reset()
      if (to_clip.start_time > 0) {
        to_clip.action.time = to_clip.start_time
      }
      to_clip.action.play()
      to_clip.is_playing = true
    }

    this.emit_event(AnimationEvent.TRANSITION_START, {
      from: this.current_state,
      to: to_state,
      duration: duration,
      blend_type: blend_type,
    })
  }

  public set_state(state_id: string): boolean {
    const is_blend = this.has_blend_tree(state_id)
    const clip = this.clips.get(state_id)
    if (!is_blend && (!clip || !clip.action)) {
      console.error(`[Animatrix] State '${state_id}' not found`)
      return false
    }

    if (this.current_state === state_id) {
      return true
    }

    if (this.current_state) {
      if (this.has_blend_tree(this.current_state)) {
        const prevTree = this.get_blend_tree(this.current_state)!
        for (const child of prevTree.children) {
          const c = this.clips.get(child.state_id)
          if (c && c.action) {
            c.action.stop()
            c.is_playing = false
            c.weight = 0.0
            c.action.weight = 0.0
          }
        }
      } else {
        const prev = this.clips.get(this.current_state)
        if (prev && prev.action) {
          prev.action.stop()
          prev.is_playing = false
          prev.weight = 0.0
          prev.action.weight = 0.0
        }
      }
    }

    this.current_state = state_id

    if (is_blend) {
      const tree = this.get_blend_tree(state_id)!
      for (const child of tree.children) {
        const c = this.clips.get(child.state_id)
        if (c && c.action) {
          c.action.reset()
          if (c.start_time > 0) {
            c.action.time = c.start_time
          }
          c.action.play()
          c.is_playing = true
        }
      }
      this.apply_blend_tree_weights(state_id, 1.0)
    } else if (clip && clip.action) {
      clip.action.reset()
      if (clip.start_time > 0) {
        clip.action.time = clip.start_time
      }
      clip.action.play()
      clip.action.weight = 1.0
      clip.is_playing = true
    }

    this.emit_event(AnimationEvent.STATE_CHANGED, { state: state_id })

    if (this.debug_mode) {
      console.log(`[Animatrix] Set state: ${state_id}`)
    }

    return true
  }

  private ease_in_out_cubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  private ease_in_out_quint(t: number): number {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
  }

  private ease_in_out_sine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2
  }

  private get_blend_value(progress: number, blend_type: BlendType): number {
    switch (blend_type) {
      case BlendType.EASE_IN_OUT:
        return this.ease_in_out_cubic(progress)
      case BlendType.EASE_IN_OUT_QUINT:
        return this.ease_in_out_quint(progress)
      case BlendType.EASE_IN_OUT_SINE:
        return this.ease_in_out_sine(progress)
      case BlendType.LINEAR:
      default:
        return progress
    }
  }

  public update(delta_time: number): void {
    if (!this.mixer) return

    this.evaluate_transitions()

    if (this.active_transition) {
      this.update_transition(delta_time)
    }

    this.mixer.update(delta_time)

    // Check for clips that have reached their end_time
    this.check_clip_end_times()

    // If current state is a blend tree and not transitioning, update its internal weights each frame
    if (
      !this.active_transition &&
      this.current_state &&
      this.has_blend_tree(this.current_state)
    ) {
      this.apply_blend_tree_weights(this.current_state, 1.0)
    }

    // Process custom clip event markers after mixer update and weights application
    this.process_clip_event_markers()
  }

  /** Register event markers for a specific clip state id. Times are normalized 0..1. */
  public add_clip_event_markers(
    state_id: string,
    markers: ClipEventMarker[],
  ): void {
    const normalized = markers
      .map((m) => ({ ...m, time: Math.max(0, Math.min(1, m.time)) }))
      .sort((a, b) => a.time - b.time)
    this.clip_event_markers.set(state_id, normalized)
    // Initialize cursor to avoid firing immediately
    const clip = this.clips.get(state_id)
    if (clip && clip.action) {
      const trimmed_duration = Math.max(0.0001, clip.end_time - clip.start_time)
      const current_time = clip.action.time - clip.start_time
      const normalized_time = ((current_time / trimmed_duration) % 1 + 1) % 1
      this.clip_event_cursors.set(state_id, normalized_time)
    } else {
      this.clip_event_cursors.set(state_id, 0)
    }
  }

  /** Remove event markers for a specific clip state id. */
  public clear_clip_event_markers(state_id: string): void {
    this.clip_event_markers.delete(state_id)
    this.clip_event_cursors.delete(state_id)
  }

  private process_clip_event_markers(): void {
    if (!this.current_state) return

    // Collect active clips to evaluate
    const active: { id: string; clip: AnimationClip }[] = []

    if (this.has_blend_tree(this.current_state)) {
      const tree = this.get_blend_tree(this.current_state)!
      for (const child of tree.children) {
        const c = this.clips.get(child.state_id)
        if (!c || !c.action || !c.is_playing) continue
        // Only consider clips that meaningfully contribute
        if (c.weight <= 0.3) continue
        active.push({ id: child.state_id, clip: c })
      }
    } else {
      const c = this.clips.get(this.current_state)
      if (c && c.action && c.is_playing) {
        active.push({ id: this.current_state, clip: c })
      }
    }

    for (const { id, clip } of active) {
      const markers = this.clip_event_markers.get(id)
      if (!markers || markers.length === 0) continue

      const trimmed_duration = Math.max(0.0001, clip.end_time - clip.start_time)
      const current_time = clip.action!.time - clip.start_time
      let curr = ((current_time / trimmed_duration) % 1 + 1) % 1
      const prev = this.clip_event_cursors.has(id)
        ? (this.clip_event_cursors.get(id) as number)
        : curr

      // On first evaluation, initialize and skip firing
      if (!this.clip_event_cursors.has(id)) {
        this.clip_event_cursors.set(id, curr)
        continue
      }

      const wrapped = curr < prev

      for (const m of markers) {
        if (!wrapped) {
          if (m.time > prev && m.time <= curr) {
            this.emit_event(m.event, { clip: id, time: curr, payload: m.payload })
          }
        } else {
          // Loop wrap: fire markers after prev..1 and 0..curr
          if (m.time > prev || m.time <= curr) {
            this.emit_event(m.event, { clip: id, time: curr, payload: m.payload })
          }
        }
      }

      this.clip_event_cursors.set(id, curr)
    }
  }

  private update_transition(delta_time: number): void {
    if (!this.active_transition) return

    const from_is_blend = this.has_blend_tree(this.active_transition.from_state)
    const to_is_blend = this.has_blend_tree(this.active_transition.to_state)
    const from_clip = this.clips.get(this.active_transition.from_state)
    const to_clip = this.clips.get(this.active_transition.to_state)
    if (!from_is_blend && (!from_clip || !from_clip.action)) return
    if (!to_is_blend && (!to_clip || !to_clip.action)) return

    this.active_transition.progress +=
      delta_time / this.active_transition.duration

    if (this.active_transition.progress >= 1.0) {
      if (from_is_blend) {
        const tree = this.get_blend_tree(this.active_transition.from_state)!
        for (const child of tree.children) {
          const childClip = this.clips.get(child.state_id)
          if (childClip && childClip.action) {
            childClip.action.weight = 0.0
            childClip.weight = 0.0
            childClip.action.stop()
            childClip.is_playing = false
          }
        }
      } else if (from_clip && from_clip.action) {
        from_clip.action.weight = 0.0
        from_clip.action.stop()
        from_clip.is_playing = false
      }

      if (to_is_blend) {
        this.apply_blend_tree_weights(this.active_transition.to_state, 1.0)
      } else if (to_clip && to_clip.action) {
        to_clip.action.weight = 1.0
        to_clip.is_playing = true
      }

      const previous_state = this.current_state
      this.current_state = this.active_transition.to_state
      this.active_transition = null

      this.emit_event(AnimationEvent.TRANSITION_END, {
        from: previous_state,
        to: this.current_state,
      })

      this.emit_event(AnimationEvent.STATE_CHANGED, {
        state: this.current_state,
        previous: previous_state,
      })

      if (this.debug_mode) {
        // Transition complete: ${previous_state} -> ${this.current_state}
      }
    } else {
      const blended_progress = this.get_blend_value(
        this.active_transition.progress,
        this.active_transition.blend_type,
      )
      const weight_from = 1.0 - blended_progress
      const weight_to = blended_progress

      if (from_is_blend) {
        this.apply_blend_tree_weights(
          this.active_transition.from_state,
          weight_from,
        )
      } else if (from_clip && from_clip.action) {
        from_clip.action.weight = weight_from
        from_clip.weight = weight_from
      }

      if (to_is_blend) {
        this.apply_blend_tree_weights(
          this.active_transition.to_state,
          weight_to,
        )
      } else if (to_clip && to_clip.action) {
        to_clip.action.weight = weight_to
        to_clip.weight = weight_to
      }
    }
  }

  private apply_blend_tree_weights(
    state_id: string,
    global_weight: number,
  ): void {
    const tree = this.get_blend_tree(state_id)
    if (!tree) return

    const paramValue = this.get_float(tree.parameter)
    const weights = this.compute_blend_weights_1d(tree.children, paramValue)

    for (const child of tree.children) {
      const childClip = this.clips.get(child.state_id)
      if (childClip && childClip.action) {
        childClip.action.weight = 0.0
        childClip.weight = 0.0
        if (!childClip.is_playing) {
          childClip.action.play()
          childClip.is_playing = true
        }
      }
    }

    weights.forEach((w, id) => {
      const childClip = this.clips.get(id)
      if (childClip && childClip.action) {
        const finalWeight = Math.max(0, Math.min(1, w * global_weight))
        childClip.action.weight = finalWeight
        childClip.weight = finalWeight
      }
    })
  }

  private check_clip_end_times(): void {
    if (!this.current_state || this.active_transition) return

    // If current state is a blend tree, enforce end_time on all child clips
    if (this.has_blend_tree(this.current_state)) {
      const tree = this.get_blend_tree(this.current_state)!
      for (const child of tree.children) {
        const c = this.clips.get(child.state_id)
        if (!c || !c.action || !c.is_playing) continue

        // Only enforce when trimmed (end_time < full clip duration)
        if (c.end_time < c.animation.duration) {
          if (c.action.time >= c.end_time) {
            if (c.loop) {
              c.action.time = c.start_time
            } else {
              c.action.time = c.end_time
              c.action.paused = true
            }
          }
        }
      }
      return
    }

    // Otherwise enforce for the single current clip state
    const clip = this.clips.get(this.current_state)
    if (!clip || !clip.action || !clip.is_playing) return

    if (clip.end_time < clip.animation.duration) {
      if (clip.action.time >= clip.end_time) {
        if (clip.loop) {
          clip.action.time = clip.start_time
        } else {
          clip.action.time = clip.end_time
          clip.action.paused = true
        }
      }
    }
  }

  public is_state(state_id: string): boolean {
    return this.current_state === state_id
  }

  public is_transitioning(): boolean {
    return this.active_transition !== null
  }

  public get_current_state(): string | null {
    return this.current_state
  }

  public get_active_transition(): ActiveTransition | null {
    return this.active_transition
  }

  public get_clips(): Map<string, AnimationClip> {
    return this.clips
  }

  public get_clip_progress(state_id: string): number {
    if (this.has_blend_tree(state_id)) {
      const tree = this.get_blend_tree(state_id)!
      const paramValue = this.get_float(tree.parameter)
      const weights = this.compute_blend_weights_1d(tree.children, paramValue)
      let accum = 0
      let weightSum = 0
      weights.forEach((w, id) => {
        const clip = this.clips.get(id)
        if (clip && clip.action && clip.is_playing) {
          const trimmed_duration = clip.end_time - clip.start_time
          const current_time = clip.action.time - clip.start_time
          const normalized_time =
            trimmed_duration > 0 ? current_time / trimmed_duration : 0
          const progress = clip.loop
            ? normalized_time % 1
            : Math.min(normalized_time, 1)
          accum += progress * w
          weightSum += w
        }
      })
      return weightSum > 0 ? accum / weightSum : 0
    } else {
      const clip = this.clips.get(state_id)
      if (!clip || !clip.action || !clip.is_playing) return 0

      const trimmed_duration = clip.end_time - clip.start_time
      const current_time = clip.action.time - clip.start_time
      const normalized_time = current_time / trimmed_duration

      return clip.loop ? normalized_time % 1 : Math.min(normalized_time, 1)
    }
  }

  public get_transitions(): TransitionConfig[] {
    return [...this.transitions, ...this.any_state_transitions]
  }

  public has_clip(state_id: string): boolean {
    return this.clips.has(state_id)
  }

  public get_blend_tree_ids(): string[] {
    return Array.from(this.blend_trees.keys())
  }

  public is_blend_tree_state(state_id: string): boolean {
    return this.has_blend_tree(state_id)
  }

  public get_blend_tree_config(
    state_id: string,
  ): BlendTree1DConfig | undefined {
    const cfg = this.blend_trees.get(state_id)
    if (!cfg) return undefined
    // Return a shallow copy to avoid external mutation
    return {
      id: cfg.id,
      parameter: cfg.parameter,
      children: [...cfg.children],
    }
  }

  public get_parameter_value(name: string): any {
    const param = this.parameters.get(name)
    return param ? param.value : null
  }

  public get_all_parameters(): { [key: string]: any } {
    const result: { [key: string]: any } = {}
    this.parameters.forEach((param, name) => {
      result[name] = param.value
    })
    return result
  }

  public get_parameters_map(): Map<string, Parameter> {
    return this.parameters
  }

  public add_listener(
    event: AnimationEvent | string,
    callback: (data?: any) => void,
  ): void {
    if (!this.event_listeners.has(event)) {
      this.event_listeners.set(event, [])
    }
    this.event_listeners.get(event)!.push(callback)
  }

  public remove_listener(
    event: AnimationEvent | string,
    callback: (data?: any) => void,
  ): void {
    const listeners = this.event_listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  public emit_event(event: AnimationEvent | string, data?: any): void {
    const listeners = this.event_listeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  public async load_animations(paths: {
    [state_id: string]: string
  }): Promise<void> {
    const load_promises: Promise<void>[] = []

    for (const [state_id, path] of Object.entries(paths)) {
      const promise = new Promise<void>((resolve, reject) => {
        this.loader.load(
          path,
          (object) => {
            if (object.animations && object.animations.length > 0) {
              this.add_clip(state_id, object.animations[0])
              if (this.debug_mode) {
                console.log(
                  `[Animatrix] Loaded animation: ${state_id} from ${path}`,
                )
              }
              resolve()
            } else {
              reject(new Error(`No animations found in ${path}`))
            }
          },
          undefined,
          (error) => reject(error),
        )
      })
      load_promises.push(promise)
    }

    await Promise.all(load_promises)
  }

  public set_clip_speed(state_id: string, speed: number): void {
    const clip = this.clips.get(state_id)
    if (clip && clip.action) {
      clip.speed = speed
      clip.action.timeScale = speed
    }
  }

  public set_clip_loop(state_id: string, loop: boolean): void {
    const clip = this.clips.get(state_id)
    if (clip && clip.action) {
      clip.loop = loop
      clip.action.setLoop(
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
        loop ? Infinity : 1,
      )
      clip.action.clampWhenFinished = !loop
    }
  }

  public set_debug(enabled: boolean): void {
    this.debug_mode = enabled
  }

  public stop_all(): void {
    this.clips.forEach((clip) => {
      if (clip.action) {
        clip.action.stop()
        clip.is_playing = false
        clip.weight = 0.0
      }
    })
    this.current_state = null
    this.active_transition = null
  }

  public destroy(): void {
    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer = null
    }
    this.clips.clear()
    this.parameters.clear()
    this.transitions = []
    this.any_state_transitions = []
    this.event_listeners.clear()
    this.blend_trees.clear()
    this.clip_event_markers.clear()
    this.clip_event_cursors.clear()
  }
}
