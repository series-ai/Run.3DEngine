import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import { AnimationLibrary } from "./animation-library"
import { SharedAnimationManager, CharacterAnimationController } from "./SharedAnimationManager"
import { AnimationPerformance } from "./AnimationPerformance"

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
 * Animation component with state machine and decision trees
 * NO BLENDING - trees are just for control flow/organization
 */
export class AnimationGraphComponent extends Component {
  private config: AnimationGraphConfig
  private readonly model: THREE.Object3D
  private controller: CharacterAnimationController | null = null
  private sharedManager: SharedAnimationManager
  
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

  protected onCreate(): void {
    this.setupAnimationGraph()
  }

  private async setupAnimationGraph(): Promise<void> {
    // Create controller
    this.controller = new CharacterAnimationController(this.model, this.sharedManager)
    
    // Register all clips
    await this.registerAnimationClips()
    
    // Set initial state
    this.setState(this.config.initialState)
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
    
    // Register each clip
    for (const clipId of clipIds) {
      const clip = AnimationLibrary.getClip(clipId)
      if (clip) {
        const cleanedClip = AnimationPerformance.cleanAnimationClip(clip, this.model!, true)
        this.sharedManager.registerClip(clipId, cleanedClip)
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
  }
  
  public getParameter(name: string): any {
    return this.parameters.get(name)
  }
  
  public setState(stateName: string): void {
    if (this.currentState === stateName) return
    
    this.currentState = stateName
    this.currentAnimation = null  // Force re-evaluation
    this.updateAnimation()
  }
  
  public getCurrentState(): string | null {
    return this.currentState
  }
  
  public addEventListener(event: string, callback: (data?: any) => void): void {
    // Not implemented
  }
  
  protected onCleanup(): void {
    if (this.controller) {
      this.controller.dispose()
    }
  }
}