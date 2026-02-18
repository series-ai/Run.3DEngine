import * as THREE from "three"

export class AnimationRetargeter {
  /**
   * Retargets an animation clip to work with a different bone naming convention
   * @param clip The original animation clip
   * @param boneMap Map of original bone names to new bone names
   * @returns A new animation clip with remapped bone names
   */
  public static retargetClip(
    clip: THREE.AnimationClip,
    boneMap: Map<string, string>
  ): THREE.AnimationClip {
    const tracks: THREE.KeyframeTrack[] = []

    for (const track of clip.tracks) {
      // Extract the bone name from the track name (format: "boneName.property")
      const parts = track.name.split(".")
      const originalBoneName = parts[0]
      const property = parts.slice(1).join(".")

      // Check if we have a mapping for this bone
      const newBoneName = boneMap.get(originalBoneName)

      if (newBoneName) {
        // Create a new track with the remapped bone name
        const newTrackName = `${newBoneName}.${property}`

        // Clone the track with the new name
        let newTrack: THREE.KeyframeTrack

        if (track instanceof THREE.VectorKeyframeTrack) {
          newTrack = new THREE.VectorKeyframeTrack(
            newTrackName,
            track.times,
            track.values,
            track.getInterpolation()
          )
        } else if (track instanceof THREE.QuaternionKeyframeTrack) {
          newTrack = new THREE.QuaternionKeyframeTrack(
            newTrackName,
            track.times,
            track.values,
            track.getInterpolation()
          )
        } else if (track instanceof THREE.NumberKeyframeTrack) {
          newTrack = new THREE.NumberKeyframeTrack(
            newTrackName,
            track.times,
            track.values,
            track.getInterpolation()
          )
        } else {
          // Keep original track if type is unknown
          newTrack = track.clone()
        }

        tracks.push(newTrack)
      } else {
        // Keep the original track if no mapping exists
        tracks.push(track.clone())
      }
    }

    return new THREE.AnimationClip(clip.name + "_retargeted", clip.duration, tracks, clip.blendMode)
  }

  /**
   * Auto-detect bone mapping between two skeletons
   * This is a simple implementation that matches bones by similar names
   */
  public static detectBoneMapping(
    sourceSkeleton: THREE.Object3D,
    targetSkeleton: THREE.Object3D
  ): Map<string, string> {
    const boneMap = new Map<string, string>()
    const sourceBones: string[] = []
    const targetBones: string[] = []

    // Collect all bone names
    sourceSkeleton.traverse((child: any) => {
      if (child.isBone) {
        sourceBones.push(child.name)
      }
    })

    targetSkeleton.traverse((child: any) => {
      if (child.isBone) {
        targetBones.push(child.name)
      }
    })

    // Try to match bones by similar names
    for (const sourceBone of sourceBones) {
      // First try exact match
      if (targetBones.includes(sourceBone)) {
        boneMap.set(sourceBone, sourceBone)
        continue
      }

      // Try to find similar names (e.g., "mixamorigHips" -> "Hips")
      const simplifiedSource = sourceBone
        .toLowerCase()
        .replace("mixamorig", "")
        .replace("mixamo:", "")
        .replace("_", "")
        .replace("-", "")

      for (const targetBone of targetBones) {
        const simplifiedTarget = targetBone
          .toLowerCase()
          .replace("mixamorig", "")
          .replace("mixamo:", "")
          .replace("_", "")
          .replace("-", "")

        if (simplifiedSource === simplifiedTarget) {
          boneMap.set(sourceBone, targetBone)
          break
        }
      }
    }

    console.log("Auto-detected bone mapping:", boneMap)
    return boneMap
  }
}
