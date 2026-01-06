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

export enum BlendType {
  LINEAR = "linear",
  EASE_IN_OUT = "ease_in_out",
}

export enum AnimationEvent {
  STATE_CHANGED = "state_changed",
  TRANSITION_START = "transition_start",
  TRANSITION_END = "transition_end",
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
  duration?: number
  priority?: number
  blend_type?: BlendType
}

export interface ClipInfo {
  id: string
  is_playing: boolean
  weight: number
  loop: boolean
}

export interface BlendTreeConfig {
  parameter: string
  children: { state_id: string; threshold: number }[]
}

export interface ActiveTransition {
  from_state: string
  to_state: string
  progress: number
}

interface StateInfo {
  name: string
  isTree: boolean
  duration: number
}

type EventCallback = () => void

/**
 * Lightweight animation state machine for visualization
 * No actual animation playback - SharedAnimationManager handles that
 */
export default class Animatrix {
  private states: Map<string, StateInfo> = new Map()
  private transitions: TransitionConfig[] = []
  private parameters: Map<string, Parameter> = new Map()
  private treeStates: Set<string> = new Set()
  private blendTreeConfigs: Map<string, BlendTreeConfig> = new Map()
  private currentState: string | null = null
  private activeTransition: ActiveTransition | null = null
  private listeners: Map<AnimationEvent, Set<EventCallback>> = new Map()

  constructor() {
    for (const event of Object.values(AnimationEvent)) {
      this.listeners.set(event, new Set())
    }
  }

  add_parameter(name: string, type: ParameterType, defaultValue: any): void {
    this.parameters.set(name, { type, value: defaultValue })
  }

  add_clip(name: string, clipInfo: { duration: number }): void {
    this.states.set(name, {
      name,
      isTree: false,
      duration: clipInfo.duration || 1,
    })
  }

  add_blend_tree_1d(id: string, parameter: string, children: { state_id: string; threshold: number }[]): void {
    this.states.set(id, { name: id, isTree: true, duration: 1 })
    this.treeStates.add(id)
    this.blendTreeConfigs.set(id, { parameter, children })
  }

  add_transition(config: TransitionConfig): void {
    this.transitions.push(config)
  }

  set_state(name: string): void {
    if (this.currentState === name) return
    
    if (!this.states.has(name)) {
      console.warn(`[Animatrix] set_state: State '${name}' not registered! Available: ${[...this.states.keys()].join(', ')}`)
    }
    
    this.currentState = name
    this.emit_event(AnimationEvent.STATE_CHANGED)
  }

  set_bool(name: string, value: boolean): void {
    const param = this.parameters.get(name)
    if (param) param.value = value
  }

  set_float(name: string, value: number): void {
    const param = this.parameters.get(name)
    if (param) param.value = value
  }

  set_int(name: string, value: number): void {
    const param = this.parameters.get(name)
    if (param) param.value = Math.floor(value)
  }

  get_float(name: string): number {
    const param = this.parameters.get(name)
    return param?.value ?? 0
  }

  get_bool(name: string): boolean {
    const param = this.parameters.get(name)
    return param?.value ?? false
  }

  get_int(name: string): number {
    const param = this.parameters.get(name)
    return Math.floor(param?.value ?? 0)
  }

  update(_deltaTime: number): void {
    // No-op - SharedAnimationManager handles actual playback
  }

  stop_all(): void {
    this.currentState = null
  }

  get_current_state(): string | null {
    return this.currentState
  }

  get_clips(): Map<string, ClipInfo> {
    const result = new Map<string, ClipInfo>()
    for (const [id] of this.states) {
      result.set(id, {
        id,
        is_playing: this.currentState === id,
        weight: this.currentState === id ? 1 : 0,
        loop: true,
      })
    }
    return result
  }

  get_transitions(): TransitionConfig[] {
    return this.transitions
  }

  get_active_transition(): ActiveTransition | null {
    return this.activeTransition
  }

  get_blend_tree_ids(): Set<string> {
    return this.treeStates
  }

  is_blend_tree_state(id: string): boolean {
    return this.treeStates.has(id)
  }

  get_blend_tree_config(id: string): BlendTreeConfig | null {
    return this.blendTreeConfigs.get(id) ?? null
  }

  get_clip_progress(_stateId: string): number {
    return 0
  }

  get_parameters_map(): Map<string, Parameter> {
    return this.parameters
  }

  add_listener(event: AnimationEvent, callback: EventCallback): void {
    this.listeners.get(event)?.add(callback)
  }

  remove_listener(event: AnimationEvent, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit_event(event: AnimationEvent): void {
    this.listeners.get(event)?.forEach((cb) => cb())
  }
}
