import * as THREE from "three"
import { AssetManager } from "@engine/assets/AssetManager"

/**
 * Debug utility for analyzing rendering performance and GPU instancing
 * Contains all debugging functionality separate from core rendering classes
 */
export class RenderingDebugger {
  /**
   * Get comprehensive rendering statistics from AssetManager
   */
  public static getRenderingStats(): any {
    const globalStats = AssetManager.getGlobalInstanceStats()

    return {
      totalInstances: globalStats.totalInstances,
      gpuInstances: globalStats.gpuInstances,
      gpuBatches: globalStats.gpuBatches,
      sharedInstances: globalStats.sharedInstances,
      clonedInstances: globalStats.clonedInstances,
      brokenInstances: globalStats.brokenInstances,
      geometryReuse: globalStats.geometryReuse,
      materialReuse: globalStats.materialReuse,
    }
  }

  /**
   * Print comprehensive rendering report
   */
  public static printRenderingReport(): void {
    const stats = RenderingDebugger.getRenderingStats()

    console.log("🎬 === RENDERING PERFORMANCE REPORT ===")
    console.log(`📊 Total Instances: ${stats.totalInstances}`)
    console.log(
      `🚀 GPU Instances: ${stats.gpuInstances} in ${stats.gpuBatches} batches (${Math.round((stats.gpuInstances / Math.max(stats.totalInstances, 1)) * 100)}%)`
    )
    console.log(
      `🔗 Shared Instances: ${stats.sharedInstances} (${Math.round((stats.sharedInstances / Math.max(stats.totalInstances, 1)) * 100)}%)`
    )
    console.log(
      `📋 Cloned Instances: ${stats.clonedInstances} (${Math.round((stats.clonedInstances / Math.max(stats.totalInstances, 1)) * 100)}%)`
    )
    console.log(
      `⚠️ Broken Instances: ${stats.brokenInstances} (${Math.round((stats.brokenInstances / Math.max(stats.totalInstances, 1)) * 100)}%)`
    )
    console.log(`♻️ Geometry Reuse: ${stats.geometryReuse}x`)
    console.log(`🎨 Material Reuse: ${stats.materialReuse}x`)

    if (stats.gpuInstances === stats.totalInstances) {
      console.log("✅ PERFECT: 100% GPU instancing - optimal performance!")
    } else if (stats.gpuInstances > stats.totalInstances * 0.8) {
      console.log("🎯 EXCELLENT: >80% GPU instancing - great performance!")
    } else if (stats.gpuInstances > stats.totalInstances * 0.5) {
      console.log("👍 GOOD: >50% GPU instancing - decent performance")
    } else {
      console.log("⚠️ WARNING: Low GPU instancing usage - performance could be improved")
      console.log("💡 Consider using RenderingMode.GPU_INSTANCING for more objects")
    }
  }

  /**
   * Analyze what's causing high draw calls
   */
  public static analyzeDrawCalls(): void {
    console.log("🔍 === DRAW CALL ANALYSIS ===")

    // Get global scene reference
    const scene =
      (window as any).renderer?.scene || (window as any).game?.scene || (window as any).scene
    const renderer = (window as any).renderer

    if (!scene) {
      console.log("❌ No scene found. Try: window.scene = yourScene")
      return
    }

    if (!renderer) {
      console.log("❌ No renderer found. Try: window.renderer = yourRenderer")
      return
    }

    console.log("📊 === RENDERER INFO ===")
    console.log(`Draw calls: ${renderer.info.render.calls}`)
    console.log(`Triangles: ${renderer.info.render.triangles.toLocaleString()}`)
    console.log(`Points: ${renderer.info.render.points}`)
    console.log(`Lines: ${renderer.info.render.lines}`)
    console.log(`Geometries: ${renderer.info.memory.geometries}`)
    console.log(`Textures: ${renderer.info.memory.textures}`)

    console.log("📦 === SCENE BREAKDOWN ===")
    console.log(`Total scene children: ${scene.children.length}`)

    let instancedMeshCount = 0
    let regularMeshCount = 0
    let groupCount = 0
    let lightCount = 0
    let cameraCount = 0
    let helperCount = 0
    let totalMeshes = 0

    scene.children.forEach((child: any, i: number) => {
      if (i < 20) {
        // Log first 20 objects to avoid spam
        console.log(
          `${i}: ${child.type} - "${child.name}" (${child.children?.length || 0} children)`
        )
      }

      // Count meshes in this child
      let meshCount = 0
      child.traverse((obj: any) => {
        if (obj.isMesh) {
          meshCount++
          totalMeshes++

          if (i < 10 && meshCount <= 3) {
            // Log details for first few objects only
            if (obj.isInstancedMesh) {
              console.log(`    ├─ InstancedMesh: "${obj.name}" (${obj.count} instances)`)
            } else {
              console.log(`    ├─ Regular Mesh: "${obj.name}"`)
            }
          }
        }
      })

      // Categorize objects
      if (child.isInstancedMesh) {
        instancedMeshCount++
      } else if (child.isMesh) {
        regularMeshCount++
      } else if (child.isGroup) {
        groupCount++
      } else if (child.isLight) {
        lightCount++
      } else if (child.isCamera) {
        cameraCount++
      } else if (child.name?.includes("Helper") || child.name?.includes("Debug")) {
        helperCount++
      }

      if (i < 20 && meshCount > 0) {
        console.log(`    └─ Contains ${meshCount} total meshes`)
      }
    })

    console.log("📈 === OBJECT SUMMARY ===")
    console.log(`InstancedMesh objects: ${instancedMeshCount}`)
    console.log(`Regular meshes: ${regularMeshCount}`)
    console.log(`Groups: ${groupCount}`)
    console.log(`Lights: ${lightCount}`)
    console.log(`Cameras: ${cameraCount}`)
    console.log(`Helpers/Debug: ${helperCount}`)
    console.log(`Total meshes in scene: ${totalMeshes}`)

    console.log("🔍 === DRAW CALL ANALYSIS ===")
    const expectedDrawCalls = instancedMeshCount + regularMeshCount
    console.log(`Expected draw calls (geometry): ${expectedDrawCalls}`)
    console.log(`Actual draw calls: ${renderer.info.render.calls}`)
    console.log(`Extra draw calls: ${renderer.info.render.calls - expectedDrawCalls}`)

    if (renderer.info.render.calls > expectedDrawCalls) {
      console.log("🤔 POSSIBLE CAUSES OF EXTRA DRAW CALLS:")
      console.log("  • Post-processing effects (SSAA, Bloom, etc.)")
      console.log("  • Shadow mapping passes")
      console.log("  • UI rendering")
      console.log("  • Debug visualization")
      console.log("  • Transparency sorting")
      console.log("  • Material incompatibilities breaking batching")
    }

    // Check for post-processing
    if ((window as any).postProcessing || renderer.domElement?.style?.filter) {
      console.log("📸 Post-processing detected - this adds multiple render passes")
    }

    console.log("💡 Run this function again after toggling post-processing to compare")
  }

  /**
   * Test frustum culling with current camera
   */
  public static testFrustumCulling(): void {
    const camera = (window as any).camera || (window as any).game?.camera

    if (!camera) {
      console.log("❌ No camera found. Try: window.camera = yourCamera")
      return
    }

    console.log("🎯 === TESTING FRUSTUM CULLING ===")

    const renderer = (window as any).renderer
    if (renderer) {
      // Reset renderer info and force a render to get baseline
      renderer.info.reset()
      renderer.render((window as any).scene, camera)
      const trianglesBefore = renderer.info.render.triangles
      console.log(`📊 Triangle count BEFORE frustum culling: ${trianglesBefore.toLocaleString()}`)

      // Apply frustum culling
      console.log("🔄 Applying frustum culling to all GPU batches...")
      AssetManager.updateAllGPUBatches(camera, true) // Enable debug logging

      // Reset and render again to get new count
      renderer.info.reset()
      renderer.render((window as any).scene, camera)
      const trianglesAfter = renderer.info.render.triangles
      const reduction = trianglesBefore - trianglesAfter
      const percentReduction =
        trianglesBefore > 0 ? Math.round((reduction / trianglesBefore) * 100) : 0

      console.log(`📊 Triangle count AFTER frustum culling: ${trianglesAfter.toLocaleString()}`)
      console.log(
        `📉 Triangle reduction: ${reduction.toLocaleString()} triangles (${percentReduction}% reduction)`
      )

      if (reduction > 0) {
        console.log(
          "✅ Frustum culling is working! Try moving the camera to see different results."
        )
      } else {
        console.log("ℹ️ No triangle reduction - all instances are currently visible to the camera.")
      }
    } else {
      console.log("❌ No renderer found for triangle counting")
    }

    console.log(
      "💡 Move the camera around and call testFrustumCulling() again to see the difference!"
    )
  }

  /**
   * Debug frustum culling for a specific asset type
   * @param assetPath Asset to debug (e.g., 'tree.obj')
   */
  public static debugFrustumCullingForAsset(assetPath: string): void {
    const camera = (window as any).camera || (window as any).game?.camera

    if (!camera) {
      console.log("❌ No camera found")
      return
    }

    console.log(`🔍 === DEBUGGING FRUSTUM CULLING FOR '${assetPath}' ===`)

    // Get the GPU batches for this asset
    const batches = (AssetManager as any)._gpuBatches?.get(assetPath)

    if (!batches || batches.length === 0) {
      console.log(`❌ No GPU batches found for '${assetPath}'`)
      return
    }

    const batch = batches[0] // Use first batch
    console.log(`📦 Found batch with ${batch.instances.length} instances`)

    console.log(
      `🔵 Culling radius: ${batch.cullingRadius.toFixed(2)} (encompasses entire geometry)`
    )

    // Test frustum culling for each instance
    const frustum = new THREE.Frustum()
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
    frustum.setFromProjectionMatrix(cameraMatrix)

    let visibleCount = 0
    let culledCount = 0

    batch.instances.forEach((instance: any, index: number) => {
      const position = new THREE.Vector3().setFromMatrixPosition(instance.matrix)
      const scale = new THREE.Vector3().setFromMatrixScale(instance.matrix)
      const maxScale = Math.max(scale.x, scale.y, scale.z)

      const actualRadius = batch.cullingRadius * maxScale
      const paddedRadius = actualRadius * 1.2
      const isVisible = frustum.intersectsSphere(new THREE.Sphere(position, paddedRadius))

      if (index < 5) {
        // Log details for first 5 instances
        console.log(
          `  Instance ${index}: pos(${position.x.toFixed(1)}, ${position.z.toFixed(1)}), radius: ${paddedRadius.toFixed(2)}, visible: ${isVisible}`
        )
      }

      if (isVisible) {
        visibleCount++
      } else {
        culledCount++
      }
    })

    console.log(`👁️ Visible instances: ${visibleCount}/${batch.instances.length}`)
    console.log(`✂️ Culled instances: ${culledCount}/${batch.instances.length}`)

    if (culledCount === 0) {
      console.log(
        "💡 No instances are being culled. This might explain why you see objects on screen being culled incorrectly."
      )
      console.log("💡 Try moving the camera to point away from the objects to test culling.")
    }
  }

  /**
   * Inspect scene objects to detect duplicate rendering
   */
  public static inspectScene(): void {
    const scene =
      (window as any).renderer?.scene || (window as any).game?.scene || (window as any).scene

    if (!scene) {
      console.log("❌ No scene available for inspection")
      return
    }

    console.log("🔍 === SCENE INSPECTION ===")
    console.log(`📦 Total scene children: ${scene.children.length}`)

    let instancedMeshCount = 0
    let regularMeshCount = 0
    let groupCount = 0
    let otherCount = 0

    const assetGroups: string[] = []
    const instancedMeshes: string[] = []

    scene.children.forEach((child: any, index: number) => {
      if (child.name.includes("_gpu_batch_")) {
        instancedMeshCount++
        instancedMeshes.push(child.name)
      } else if (child.name.includes("_group") || child.name.includes(".obj")) {
        groupCount++
        assetGroups.push(child.name)
      } else if (child.type === "Mesh") {
        regularMeshCount++
      } else {
        otherCount++
      }

      if (index < 15) {
        // Log first 15 objects
        console.log(
          `  ${index}: ${child.type} - "${child.name}" (${child.children?.length || 0} children)`
        )
      }
    })

    console.log("📊 SCENE OBJECT BREAKDOWN:")
    console.log(`  🎯 InstancedMesh objects: ${instancedMeshCount}`)
    console.log(`  📦 Asset groups: ${groupCount}`)
    console.log(`  🔳 Regular meshes: ${regularMeshCount}`)
    console.log(`  📝 Other objects: ${otherCount}`)

    if (assetGroups.length > 0) {
      console.log("⚠️ POTENTIAL DUPLICATE RENDERING DETECTED!")
      console.log("📦 Asset groups in scene (these may cause duplicate rendering):")
      assetGroups.slice(0, 10).forEach((name) => console.log(`    - ${name}`)) // Limit to first 10
      if (assetGroups.length > 10) {
        console.log(`    ... and ${assetGroups.length - 10} more`)
      }
    }

    if (instancedMeshes.length > 0) {
      console.log("✅ InstancedMesh objects in scene:")
      instancedMeshes.forEach((name) => console.log(`    - ${name}`))
    }
  }

  /**
   * Make all debug functions globally available
   */
  public static makeGloballyAvailable(): void {
    ;(window as any).printRenderingReport = RenderingDebugger.printRenderingReport
    ;(window as any).analyzeDrawCalls = RenderingDebugger.analyzeDrawCalls
    ;(window as any).testFrustumCulling = RenderingDebugger.testFrustumCulling
    ;(window as any).inspectScene = RenderingDebugger.inspectScene
    ;(window as any).getRenderingStats = RenderingDebugger.getRenderingStats
    ;(window as any).debugFrustumCulling = RenderingDebugger.debugFrustumCullingForAsset
    ;(window as any).setFrustumPadding = AssetManager.setFrustumCullingPadding
    ;(window as any).getFrustumPadding = AssetManager.getFrustumCullingPadding
    ;(window as any).debugBatchTypes = AssetManager.debugBatchTypes
  }
}
