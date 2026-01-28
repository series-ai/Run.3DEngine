import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import { AnimationLibrary } from "./animation-library"
import { SharedAnimationManager, CharacterAnimationController } from "./SharedAnimationManager"
import Animatrix, { ParameterType } from "./animatrix"
import AnimatrixVisualizer from "./visualizer"

export interface ParameterConfig {
  type: "bool" | "float" | "int" 
  default: any
}

export interface AnimationTreeChild {
  animation: string
  threshold: number
}

export interface AnimationTree {
  parameter: string
  children: AnimationTreeChild[]
}

export interface StateConfig {
  animation?: string
  tree?: AnimationTree
  randomizeStartTime?: boolean
}

export interface TransitionConfig {
  from: string
  to: string
  when?: Record<string, any>
  /** Exit time as a normalized value (0-1). If true, defaults to 1.0 (end of animation) */
  exitTime?: number | boolean
}

export interface AnimationGraphConfig {
  parameters?: Record<string, ParameterConfig>
  states: Record<string, StateConfig>
  transitions?: TransitionConfig[]
  initialState: string
  debug?: boolean
}

export interface StoredTreeConfig {
  stateName: string
  tree: AnimationTree | null
  simpleAnimation: string | null
}

export class AnimationGraphComponent extends Component {
  private static instances: Set<AnimationGraphComponent> = new Set()
  private static sharedVisualizer: AnimatrixVisualizer | null = null
  private static debugViewEnabled: boolean = false
  private static treeConfigs: Map<string, Map<string, StoredTreeConfig>> = new Map()

  private config: AnimationGraphConfig
  private readonly model: THREE.Object3D
  private controller: CharacterAnimationController | null = null
  private sharedManager: SharedAnimationManager
  private animator: Animatrix | null = null
  private animatorName: string | null = null
  
  private parameters: Map<string, any> = new Map()
  private currentState: string | null = null
  private currentAnimation: string | null = null
  private stateElapsedTime: number = 0
  private currentStateDuration: number = 1
  
  constructor(model: THREE.Object3D, config: AnimationGraphConfig) {
    super()
    this.model = model
    this.config = config
    this.sharedManager = SharedAnimationManager.getInstance()
    
    if (config.parameters) {
      for (const [name, paramConfig] of Object.entries(config.parameters)) {
        this.parameters.set(name, paramConfig.default)
      }
    }
  }

  public static setDebugViewEnabled(enabled: boolean): void {
    AnimationGraphComponent.debugViewEnabled = enabled

    if (enabled) {
      if (!AnimationGraphComponent.sharedVisualizer) {
        AnimationGraphComponent.sharedVisualizer = new AnimatrixVisualizer()
        AnimationGraphComponent.sharedVisualizer.hide()
      }

      for (const instance of AnimationGraphComponent.instances) {
        if (instance.animator && instance.animatorName) {
          AnimationGraphComponent.sharedVisualizer.add_animator(instance.animatorName, instance.animator)
        }
      }

      AnimationGraphComponent.sharedVisualizer.show()
    } else {
      if (AnimationGraphComponent.sharedVisualizer) {
        AnimationGraphComponent.sharedVisualizer.hide()
      }
    }
  }

  public static isDebugViewEnabled(): boolean {
    return AnimationGraphComponent.debugViewEnabled
  }

  public static getTreeConfig(animatorName: string, stateName: string): StoredTreeConfig | null {
    const animatorConfigs = AnimationGraphComponent.treeConfigs.get(animatorName)
    if (!animatorConfigs) return null
    return animatorConfigs.get(stateName) || null
  }

  public static getStateConfigs(animatorName: string): Map<string, StoredTreeConfig> | null {
    return AnimationGraphComponent.treeConfigs.get(animatorName) || null
  }

  public static getParameterValue(animatorName: string, paramName: string): any {
    for (const instance of AnimationGraphComponent.instances) {
      if (instance.animatorName === animatorName) {
        return instance.parameters.get(paramName)
      }
    }
    return null
  }

  public static getCurrentAnimation(animatorName: string): string | null {
    for (const instance of AnimationGraphComponent.instances) {
      if (instance.animatorName === animatorName) {
        return instance.currentAnimation
      }
    }
    return null
  }

  public getAnimator(): Animatrix | null {
    return this.animator
  }

  protected onCreate(): void {
    AnimationGraphComponent.instances.add(this)
    this.setupAnimationGraph()
  }

  private setupAnimationGraph(): void {
    this.controller = new CharacterAnimationController(this.model, this.sharedManager)
    this.animator = new Animatrix()
    this.animatorName = this.gameObject?.name || `graph_${AnimationGraphComponent.instances.size}`
    
    this.registerAnimationClips()
    this.setupAnimatrix()
    this.storeTreeConfigs()
    
    if (AnimationGraphComponent.debugViewEnabled && AnimationGraphComponent.sharedVisualizer) {
      AnimationGraphComponent.sharedVisualizer.add_animator(this.animatorName, this.animator)
    }
    
    this.setState(this.config.initialState)
  }

  private storeTreeConfigs(): void {
    if (!this.animatorName) return

    const stateConfigs = new Map<string, StoredTreeConfig>()
    
    for (const [stateName, stateConfig] of Object.entries(this.config.states)) {
      stateConfigs.set(stateName, {
        stateName,
        tree: stateConfig.tree || null,
        simpleAnimation: stateConfig.animation || null
      })
    }
    
    AnimationGraphComponent.treeConfigs.set(this.animatorName, stateConfigs)
  }
  
  private registerAnimationClips(): void {
    const clipIds = new Set<string>()
    
    for (const stateConfig of Object.values(this.config.states)) {
      if (stateConfig.animation) {
        clipIds.add(stateConfig.animation)
      } else if (stateConfig.tree) {
        for (const child of stateConfig.tree.children) {
          clipIds.add(child.animation)
        }
      }
    }
    
    for (const clipId of clipIds) {
      const clip = AnimationLibrary.getClip(clipId)
      if (clip) {
        this.sharedManager.registerClip(clipId, clip)
      }
    }
  }

  private setupAnimatrix(): void {
    if (!this.animator) return

    if (this.config.parameters) {
      for (const [name, paramConfig] of Object.entries(this.config.parameters)) {
        let paramType: ParameterType
        switch (paramConfig.type) {
          case "bool": paramType = ParameterType.BOOL; break
          case "float": paramType = ParameterType.FLOAT; break
          case "int": paramType = ParameterType.INT; break
          default: paramType = ParameterType.BOOL
        }
        this.animator.add_parameter(name, paramType, paramConfig.default)
      }
    }

    for (const [stateName, stateConfig] of Object.entries(this.config.states)) {
      let clipDuration = 1
      if (stateConfig.animation) {
        const clip = AnimationLibrary.getClip(stateConfig.animation)
        if (clip) clipDuration = clip.duration
      } else if (stateConfig.tree && stateConfig.tree.children.length > 0) {
        const clip = AnimationLibrary.getClip(stateConfig.tree.children[0].animation)
        if (clip) clipDuration = clip.duration
      }
      this.animator.add_clip(stateName, { duration: clipDuration })
    }

    if (this.config.transitions) {
      for (const transition of this.config.transitions) {
        this.animator.add_transition({
          from: transition.from,
          to: transition.to,
          conditions: transition.when 
            ? Object.entries(transition.when).map(([param, value]) => ({
                parameter: param,
                operator: "==" as any,
                value: value
              }))
            : []
        })
      }
    }
  }
  
  public update(deltaTime: number): void {
    if (!this.controller || !this.gameObject.isEnabled()) return
    
    this.animator?.update(deltaTime)
    this.controller.update(deltaTime)
    this.stateElapsedTime += deltaTime
    
    if (this.config.transitions) {
      for (const transition of this.config.transitions) {
        if (transition.from !== this.currentState) continue
        
        // Check exit time condition if specified
        if (transition.exitTime !== undefined) {
          const exitThreshold = typeof transition.exitTime === 'boolean' ? 1.0 : transition.exitTime
          const normalizedTime = this.stateElapsedTime / this.currentStateDuration
          if (normalizedTime < exitThreshold) continue
        }
        
        // Check parameter conditions if specified
        let allConditionsMet = true
        if (transition.when) {
          for (const [param, value] of Object.entries(transition.when)) {
            if (this.parameters.get(param) !== value) {
              allConditionsMet = false
              break
            }
          }
        }
        
        if (allConditionsMet) {
          this.setState(transition.to)
          break
        }
      }
    }
    
    this.updateAnimation()
  }
  
  private updateAnimation(): void {
    if (!this.currentState || !this.controller) return
    
    const stateConfig = this.config.states[this.currentState]
    if (!stateConfig) return
    
    let targetAnimation: string | null = null
    
    if (stateConfig.animation) {
      targetAnimation = stateConfig.animation
    } else if (stateConfig.tree) {
      const paramValue = this.parameters.get(stateConfig.tree.parameter) || 0
      
      for (let i = stateConfig.tree.children.length - 1; i >= 0; i--) {
        const child = stateConfig.tree.children[i]
        if (paramValue >= child.threshold) {
          targetAnimation = child.animation
          break
        }
      }
      
      if (!targetAnimation && stateConfig.tree.children.length > 0) {
        targetAnimation = stateConfig.tree.children[0].animation
      }
    }
    
    if (targetAnimation && targetAnimation !== this.currentAnimation) {
      if (this.config.debug) {
        console.log(`[AnimGraph] ${this.animatorName}: ${this.currentAnimation} -> ${targetAnimation} (model: ${this.model?.name || 'unnamed'})`)
      }
      const startTime = this.getStateRandomizeTime(this.currentState) ? Math.random() * this.currentStateDuration : 0
      this.controller.playAnimation(targetAnimation, startTime)
      this.currentAnimation = targetAnimation
    }
  }
  
  public setParameter(name: string, value: any): void {
    this.parameters.set(name, value)
    
    if (this.animator) {
      if (typeof value === "boolean") {
        this.animator.set_bool(name, value)
      } else if (typeof value === "number") {
        if (Number.isInteger(value)) {
          this.animator.set_int(name, value)
        } else {
          this.animator.set_float(name, value)
        }
      }
    }
  }
  
  public getParameter(name: string): any {
    return this.parameters.get(name)
  }
  
  public setState(stateName: string): void {
    if (this.currentState === stateName) return
    
    if (this.config.debug) {
      console.log(`[AnimGraph] ${this.animatorName} setState: ${this.currentState} -> ${stateName}`)
    }
    
    this.currentState = stateName
    this.currentAnimation = null
    this.currentStateDuration = this.getStateDuration(stateName)

    if (this.getStateRandomizeTime(stateName)) {
      this.stateElapsedTime = Math.random() * this.currentStateDuration
    } else {
      this.stateElapsedTime = 0
    }

    this.animator?.set_state(stateName)
    this.updateAnimation()
  }
  
  public getCurrentState(): string | null {
    return this.currentState
  }
  
  private getStateDuration(stateName: string): number {
    const stateConfig = this.config.states[stateName]
    if (!stateConfig) return 1
    
    if (stateConfig.animation) {
      const clip = AnimationLibrary.getClip(stateConfig.animation)
      if (clip) return clip.duration
    } else if (stateConfig.tree && stateConfig.tree.children.length > 0) {
      // Use first child's duration as reference for blend trees
      const clip = AnimationLibrary.getClip(stateConfig.tree.children[0].animation)
      if (clip) return clip.duration
    }
    
    return 1
  }

  private getStateRandomizeTime(stateName: string): boolean {
    const stateConfig = this.config.states[stateName]
    if (!stateConfig) return false
    return stateConfig.randomizeStartTime || false
  }
  
  public addEventListener(_event: string, _callback: (data?: any) => void): void {
    // Not implemented
  }
  
  protected onCleanup(): void {
    AnimationGraphComponent.instances.delete(this)
    
    if (this.animatorName) {
      AnimationGraphComponent.treeConfigs.delete(this.animatorName)
    }
    
    if (AnimationGraphComponent.sharedVisualizer && this.animator && this.animatorName) {
      AnimationGraphComponent.sharedVisualizer.remove_animator(this.animatorName)
    }
    
    if (this.animator) {
      this.animator.stop_all()
    }
    
    if (this.controller) {
      this.controller.dispose()
    }
  }
}
