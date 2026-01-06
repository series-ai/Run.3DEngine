import * as THREE from "three"

/**
 * Simple performance utilities for the animation system
 * Focuses on reducing skin influences and cleaning up animation tracks
 */
export class AnimationPerformance {
  
  /**
   * Reduce the number of bone influences per vertex for better mobile performance
   * @param skinnedMesh The skinned mesh to optimize
   * @param maxInfluences Maximum number of bone influences per vertex (default 2)
   */
  public static reduceSkinInfluences(skinnedMesh: THREE.SkinnedMesh, maxInfluences: number = 2): void {
    const geometry = skinnedMesh.geometry
    
    // Check if this is a BufferGeometry with skinning attributes
    if (!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) {
      return
    }
    
    const skinIndices = geometry.attributes.skinIndex.array as Float32Array
    const skinWeights = geometry.attributes.skinWeight.array as Float32Array
    
    // Process each vertex
    const vertexCount = skinIndices.length / 4 // 4 influences per vertex by default
    
    for (let i = 0; i < vertexCount; i++) {
      const offset = i * 4
      
      // Collect all influences for this vertex
      const influences: { index: number; weight: number }[] = []
      for (let j = 0; j < 4; j++) {
        if (skinWeights[offset + j] > 0) {
          influences.push({
            index: skinIndices[offset + j],
            weight: skinWeights[offset + j]
          })
        }
      }
      
      // Sort by weight (highest first)
      influences.sort((a, b) => b.weight - a.weight)
      
      // Keep only the top N influences and renormalize
      const kept = influences.slice(0, maxInfluences)
      const totalWeight = kept.reduce((sum, inf) => sum + inf.weight, 0)
      
      // Clear all influences first
      for (let j = 0; j < 4; j++) {
        skinIndices[offset + j] = 0
        skinWeights[offset + j] = 0
      }
      
      // Set the kept influences with normalized weights
      kept.forEach((inf, idx) => {
        skinIndices[offset + idx] = inf.index
        skinWeights[offset + idx] = totalWeight > 0 ? inf.weight / totalWeight : 0
      })
    }
    
    // Mark attributes as needing update
    geometry.attributes.skinIndex.needsUpdate = true
    geometry.attributes.skinWeight.needsUpdate = true
  }
  
  /**
   * Clean up animation clip by removing tracks for non-bone objects
   * This prevents PropertyBinding warnings and improves performance
   * Removes tracks for accessories, hair, hats, etc that are mesh names not bones
   * 
   * IMPORTANT: Returns a NEW clip, does not modify the original
   */
  public static cleanAnimationClip(
    clip: THREE.AnimationClip,
    model: THREE.Object3D,
    silent: boolean = true
  ): THREE.AnimationClip {
    const validTracks: THREE.KeyframeTrack[] = []
    const removedTracks: string[] = []
    const originalTrackCount = clip.tracks.length
    
    // Find the skeleton/bones in the model
    let skeleton: THREE.Skeleton | null = null
    let bones: THREE.Bone[] = []
    model.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        skeleton = child.skeleton
        bones = skeleton.bones
      }
    })
    
    // Create a set of valid bone names for fast lookup
    const validBoneNames = new Set<string>()
    bones.forEach(bone => validBoneNames.add(bone.name))
    
    // Also check for objects in the model hierarchy (for non-skeletal animations)
    const validObjectNames = new Set<string>()
    model.traverse((child) => {
      if (child.name) {
        validObjectNames.add(child.name)
      }
    })
    
    for (const track of clip.tracks) {
      // Extract the object name from the track name
      // Track names are like "boneName.position" or "fullBody_Toes.quaternion"
      const parts = track.name.split('.')
      if (parts.length < 2) {
        // Keep tracks without proper naming (shouldn't happen but be safe)
        validTracks.push(track.clone())
        continue
      }
      
      const objectName = parts[0]
      
      // Filter out known non-bone prefixes that are causing issues
      const isAccessory = objectName.includes('hair_') || 
                         objectName.includes('hat_') || 
                         objectName.includes('face_accessory_') ||
                         objectName === 'fullBody_Toes' // This seems to be a mesh name, not a bone
      
      if (isAccessory) {
        removedTracks.push(track.name)
        continue
      }
      
      // Check if this is a valid bone or object in the model
      if (validBoneNames.has(objectName) || validObjectNames.has(objectName)) {
        validTracks.push(track.clone())
      } else {
        removedTracks.push(track.name)
      }
    }
    
    // Log what we're removing in development
    if (!silent && removedTracks.length > 0) {
      console.log(`[AnimationPerformance] Removed ${removedTracks.length}/${originalTrackCount} non-bone tracks from clip "${clip.name || 'unnamed'}"`)
      if (process.env.NODE_ENV !== 'production') {
        const uniqueObjects = [...new Set(removedTracks.map(t => t.split('.')[0]))]
        console.log('[AnimationPerformance] Removed objects:', uniqueObjects)
      }
    }
    
    // Create a NEW clip with the valid tracks - never modify the original
    const cleanedClip = new THREE.AnimationClip(
      clip.name,
      clip.duration,
      validTracks,
      clip.blendMode
    )
    
    return cleanedClip
  }
  
  /**
   * Process all skinned meshes in a model to reduce influences
   */
  public static optimizeModelForMobile(model: THREE.Object3D, maxInfluences: number = 2): void {
    model.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        this.reduceSkinInfluences(child, maxInfluences)
      }
    })
  }
  
  /**
   * Clean all animation clips in a mixer to remove missing bone tracks
   */
  public static cleanMixerAnimations(
    mixer: THREE.AnimationMixer,
    model: THREE.Object3D
  ): void {
    // Get all actions from the mixer
    const actions = (mixer as any)._actions as THREE.AnimationAction[]
    
    if (!actions) return
    
    for (const action of actions) {
      const originalClip = action.getClip()
      const cleanedClip = this.cleanAnimationClip(originalClip, model)
      
      // If the clip was modified, we need to recreate the action
      if (cleanedClip.tracks.length !== originalClip.tracks.length) {
        // Stop the current action
        action.stop()
        
        // Create a new action with the cleaned clip
        const newAction = mixer.clipAction(cleanedClip)
        
        // Copy settings from the original action
        newAction.loop = action.loop
        newAction.repetitions = action.repetitions
        newAction.clampWhenFinished = action.clampWhenFinished
        newAction.timeScale = action.timeScale
        
        // If the original was playing, start the new one
        if (action.isRunning()) {
          newAction.play()
          newAction.time = action.time
        }
      }
    }
  }
  
  /**
   * Check if running on a mobile device
   */
  public static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }
  
  /**
   * Get recommended settings based on platform
   */
  public static getRecommendedSettings(): {
    maxSkinInfluences: number
    enableDebugLogs: boolean
  } {
    const isMobile = this.isMobile()
    
    return {
      maxSkinInfluences: isMobile ? 2 : 4,
      enableDebugLogs: !isMobile && process.env.NODE_ENV !== 'production'
    }
  }
}
