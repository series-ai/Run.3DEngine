import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import { AnimationLibrary } from "./animation-library"
import { SharedAnimationManager, CharacterAnimationController } from "./SharedAnimationManager"
import { AnimationPerformance } from "./AnimationPerformance"
import Animatrix, { ParameterType, ComparisonOperator, BlendType } from "./animatrix"
import AnimatrixVisualizer from "./visualizer"

// Config interfaces - trees for CONTROL FLOW, not blending
export interface ParameterConfig {
  type: "bool" | "float" | "int" 
  default: any
}

export interface AnimationTreeChild {
  animation: string
  threshold: number  // When param >= threshold, use this animation
}

export interface AnimationTree {
  parameter: string
  children: AnimationTreeChild[]
}

export interface StateConfig {
  animation?: string  // Simple state - one animation
  tree?: AnimationTree  // Decision tree based on parameter
}

export interface TransitionConfig {
  from: string
  to: string
  when: Record<string, any>  // Simple conditions
}

export interface AnimationGraphConfig {
  parameters?: Record<string, ParameterConfig>
  states: Record<string, StateConfig>
  transitions?: TransitionConfig[]
  initialState: string
  debug?: boolean
}

/**
 * Tree config stored for visualization drill-down
 */
export interface StoredTreeConfig {
  stateName: string
  tree: AnimationTree | null
  simpleAnimation: string | null
}

/**
 * Animation component with state machine and decision trees
 * Uses Animatrix internally for state machine logic and visualization
 */
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
  
  constructor(model: THREE.Object3D, config: AnimationGraphConfig) {
    super()
    this.model = model
    this.config = config
    this.sharedManager = SharedAnimationManager.getInstance()
    
    // Initialize parameters
    if (config.parameters) {
      for (const [name, paramConfig] of Object.entries(config.parameters)) {
        this.parameters.set(name, paramConfig.default)
      }
    }
  }

  /**
   * Enable or disable the debug visualizer for all animation graphs
   */
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

  /**
   * Check if debug view is enabled
   */
  public static isDebugViewEnabled(): boolean {
    return AnimationGraphComponent.debugViewEnabled
  }

  /**
   * Get tree config for a specific animator and state (for drill-down visualization)
   */
  public static getTreeConfig(animatorName: string, stateName: string): StoredTreeConfig | null {
    const animatorConfigs = AnimationGraphComponent.treeConfigs.get(animatorName)
    if (!animatorConfigs) return null
    return animatorConfigs.get(stateName) || null
  }

  /**
   * Get all state configs for an animator (for drill-down visualization)
   */
  public static getStateConfigs(animatorName: string): Map<string, StoredTreeConfig> | null {
    return AnimationGraphComponent.treeConfigs.get(animatorName) || null
  }

  /**
   * Get parameter value for a specific animator
   */
  public static getParameterValue(animatorName: string, paramName: string): any {
    for (const instance of AnimationGraphComponent.instances) {
      if (instance.animatorName === animatorName) {
        return instance.parameters.get(paramName)
      }
    }
    return null
  }

  /**
   * Get current animation for a specific animator
   */
  public static getCurrentAnimation(animatorName: string): string | null {
    for (const instance of AnimationGraphComponent.instances) {
      if (instance.animatorName === animatorName) {
        return instance.currentAnimation
      }
    }
    return null
  }

  /**
   * Get the underlying Animatrix instance for visualization
   */
  public getAnimator(): Animatrix | null {
    return this.animator
  }

  protected onCreate(): void {
    AnimationGraphComponent.instances.add(this)
    this.setupAnimationGraph()
  }

  private async setupAnimationGraph(): Promise<void> {
    // Create controller for actual animation playback
    this.controller = new CharacterAnimationController(this.model, this.sharedManager)
    
    // Create Animatrix for state machine logic and visualization
    this.animator = new Animatrix(this.model, this.config.debug || false)
    
    // Store animator name for lookups
    this.animatorName = this.gameObject?.name || `graph_${AnimationGraphComponent.instances.size}`
    
    // Register all clips and set up state machine
    await this.registerAnimationClips()
    this.setupAnimatrixStateMachine()
    
    // Store tree configs for drill-down visualization
    this.storeTreeConfigs()
    
    // Register with visualizer if debug view is enabled
    if (AnimationGraphComponent.debugViewEnabled && AnimationGraphComponent.sharedVisualizer) {
      AnimationGraphComponent.sharedVisualizer.add_animator(this.animatorName, this.animator)
    }
    
    // Set initial state
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
  
  private async registerAnimationClips(): Promise<void> {
    const clipIds = new Set<string>()
    
    // Collect all animation IDs
    for (const stateConfig of Object.values(this.config.states)) {
      if (stateConfig.animation) {
        clipIds.add(stateConfig.animation)
      } else if (stateConfig.tree) {
        for (const child of stateConfig.tree.children) {
          clipIds.add(child.animation)
        }
      }
    }
    
    // Register each clip with SharedAnimationManager
    for (const clipId of clipIds) {
      const clip = AnimationLibrary.getClip(clipId)
      if (clip) {
        const cleanedClip = AnimationPerformance.cleanAnimationClip(clip, this.model!, true)
        this.sharedManager.registerClip(clipId, cleanedClip)
      }
    }
  }

  private setupAnimatrixStateMachine(): void {
    if (!this.animator) return

    // Add parameters to Animatrix
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

    // Register each STATE as a clip in Animatrix (for visualization)
    for (const [stateName, stateConfig] of Object.entries(this.config.states)) {
      // Get the primary animation for this state
      let primaryAnimationId: string | null = null
      if (stateConfig.animation) {
        primaryAnimationId = stateConfig.animation
      } else if (stateConfig.tree && stateConfig.tree.children.length > 0) {
        primaryAnimationId = stateConfig.tree.children[0].animation
      }

      if (primaryAnimationId) {
        const clip = AnimationLibrary.getClip(primaryAnimationId)
        if (clip) {
          const cleanedClip = AnimationPerformance.cleanAnimationClip(clip, this.model!, true)
          this.animator.add_clip(stateName, cleanedClip, 1.0, true)
        }
      }
    }

    // Add transitions to Animatrix
    if (this.config.transitions) {
      for (const transition of this.config.transitions) {
        const conditions = Object.entries(transition.when).map(([param, value]) => ({
          parameter: param,
          operator: ComparisonOperator.EQUALS,
          value: value
        }))

        this.animator.add_transition({
          from: transition.from,
          to: transition.to,
          conditions: conditions,
          duration: 0.15,
          priority: 1,
          blend_type: BlendType.EASE_IN_OUT
        })
      }
    }
  }
  
  private findModel(): THREE.Object3D | null {
    if (this.gameObject.children && this.gameObject.children.length > 0) {
      const model = this.gameObject.children.find(child => {
        let hasBones = false
        child.traverse((c) => {
          if (c instanceof THREE.SkinnedMesh || c instanceof THREE.Bone) {
            hasBones = true
          }
        })
        return hasBones
      })
      return model || null
    }
    return null
  }
  
  public update(deltaTime: number): void {
    if (!this.controller || !this.gameObject.isEnabled()) return
    
    // Update Animatrix for visualization (playback progress)
    this.animator?.update(deltaTime)
    
    // Check transitions
    if (this.config.transitions) {
      for (const transition of this.config.transitions) {
        if (transition.from !== this.currentState) continue
        
        let allConditionsMet = true
        for (const [param, value] of Object.entries(transition.when)) {
          if (this.parameters.get(param) !== value) {
            allConditionsMet = false
            break
          }
        }
        
        if (allConditionsMet) {
          this.setState(transition.to)
          break
        }
      }
    }
    
    // Update animation based on current state
    this.updateAnimation()
  }
  
  private updateAnimation(): void {
    if (!this.currentState || !this.controller) return
    
    const stateConfig = this.config.states[this.currentState]
    if (!stateConfig) return
    
    let targetAnimation: string | null = null
    
    if (stateConfig.animation) {
      // Simple state
      targetAnimation = stateConfig.animation
    } else if (stateConfig.tree) {
      // Decision tree - find which animation based on parameter
      const paramValue = this.parameters.get(stateConfig.tree.parameter) || 0
      
      // Find the right animation for this parameter value
      // Go backwards to find the highest threshold we meet
      for (let i = stateConfig.tree.children.length - 1; i >= 0; i--) {
        const child = stateConfig.tree.children[i]
        if (paramValue >= child.threshold) {
          targetAnimation = child.animation
          break
        }
      }
      
      // Default to first if below all thresholds
      if (!targetAnimation && stateConfig.tree.children.length > 0) {
        targetAnimation = stateConfig.tree.children[0].animation
      }
    }
    
    // Switch animation if different
    if (targetAnimation && targetAnimation !== this.currentAnimation) {
      this.controller.playAnimation(targetAnimation)
      this.currentAnimation = targetAnimation
    }
  }
  
  public setParameter(name: string, value: any): void {
    this.parameters.set(name, value)
    
    // Sync with Animatrix for visualization
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
    
    this.currentState = stateName
    this.currentAnimation = null  // Force re-evaluation
    
    // Sync with Animatrix for visualization
    this.animator?.set_state(stateName)
    
    this.updateAnimation()
  }
  
  public getCurrentState(): string | null {
    return this.currentState
  }
  
  public addEventListener(event: string, callback: (data?: any) => void): void {
    // Not implemented
  }
  
  protected onCleanup(): void {
    AnimationGraphComponent.instances.delete(this)
    
    // Remove tree configs
    if (this.animatorName) {
      AnimationGraphComponent.treeConfigs.delete(this.animatorName)
    }
    
    // Remove from visualizer
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