import * as THREE from "three"
import { Component } from "@engine/core/GameObject"
import { SplineThree } from "./SplineThree"

export interface SplineDebugOptionsThree {
  showWaypoints?: boolean
  showCurve?: boolean
  showDirection?: boolean
  waypointSize?: number
  waypointColor?: THREE.Color
  curveColor?: THREE.Color
  directionColor?: THREE.Color
  directionLength?: number
  directionSpacing?: number
}

/**
 * Three.js component for debugging and visualizing splines
 */
export class SplineDebugRendererThree extends Component {
  private spline: SplineThree
  private options: Required<SplineDebugOptionsThree>

  // Visual elements
  private waypointMeshes: THREE.Mesh[] = []
  private curveLine: THREE.Line | null = null
  private directionArrows: THREE.Group[] = []
  private parentGroup: THREE.Group

  constructor(spline: SplineThree, options: SplineDebugOptionsThree = {}) {
    super()

    this.spline = spline
    this.options = {
      showWaypoints: options.showWaypoints ?? true,
      showCurve: options.showCurve ?? true,
      showDirection: options.showDirection ?? false,
      waypointSize: options.waypointSize ?? 0.5,
      waypointColor: options.waypointColor ?? new THREE.Color(0xff0000),
      curveColor: options.curveColor ?? new THREE.Color(0xffff00),
      directionColor: options.directionColor ?? new THREE.Color(0x00ff00),
      directionLength: options.directionLength ?? 2.0,
      directionSpacing: options.directionSpacing ?? 0.1,
    }

    this.parentGroup = new THREE.Group()
  }

  protected onCreate(): void {
    if (!this.gameObject) return

    // Add the parent group to the scene through the gameObject
    this.gameObject.add(this.parentGroup)

    this.createDebugVisualization()
  }

  protected onCleanup(): void {
    this.clearVisualization()

    if (this.parentGroup && this.gameObject) {
      this.gameObject.remove(this.parentGroup)
    }
  }

  public update(deltaTime: number): void {
    // Debug visualization is static - no updates needed
  }

  /**
   * Update the visualization (call this if the spline changes)
   */
  public refresh(): void {
    this.clearVisualization()
    this.createDebugVisualization()
  }

  /**
   * Show or hide waypoints
   */
  public setShowWaypoints(show: boolean): void {
    this.options.showWaypoints = show
    this.waypointMeshes.forEach((mesh) => {
      mesh.visible = show
    })
  }

  /**
   * Show or hide the curve
   */
  public setShowCurve(show: boolean): void {
    this.options.showCurve = show
    if (this.curveLine) {
      this.curveLine.visible = show
    }
  }

  /**
   * Show or hide direction arrows
   */
  public setShowDirection(show: boolean): void {
    this.options.showDirection = show
    this.directionArrows.forEach((arrow) => {
      arrow.visible = show
    })
  }

  /**
   * Create all debug visualization elements
   */
  private createDebugVisualization(): void {
    if (this.options.showWaypoints) {
      this.createWaypoints()
    }

    if (this.options.showCurve) {
      this.createCurve()
    }

    if (this.options.showDirection) {
      this.createDirectionArrows()
    }
  }

  /**
   * Create waypoint spheres
   */
  private createWaypoints(): void {
    const geometry = new THREE.SphereGeometry(this.options.waypointSize, 8, 6)
    const material = new THREE.MeshBasicMaterial({
      color: this.options.waypointColor,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    })

    // Use original waypoints, not interpolated points
    const waypoints = this.spline.getWaypoints()

    waypoints.forEach((waypoint, index) => {
      const mesh = new THREE.Mesh(geometry, material.clone())
      mesh.position.copy(waypoint)
      mesh.renderOrder = 1000 // Render on top

      this.waypointMeshes.push(mesh)
      this.parentGroup.add(mesh)
    })
  }

  /**
   * Create the curve line
   */
  private createCurve(): void {
    const points = this.spline.getInterpolatedPoints()

    if (points.length < 2) return

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: this.options.curveColor,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    })

    this.curveLine = new THREE.Line(geometry, material)
    this.curveLine.renderOrder = 999 // Render below waypoints
    this.parentGroup.add(this.curveLine)
  }

  /**
   * Create direction arrows along the spline
   */
  private createDirectionArrows(): void {
    const spacing = this.options.directionSpacing
    const length = this.options.directionLength

    for (let t = 0; t <= 1; t += spacing) {
      const position = this.spline.getPointAt(t)
      const direction = this.spline.getDirectionAt(t)

      if (direction.length() < 0.001) continue

      const arrow = this.createArrow(position, direction, length)
      this.directionArrows.push(arrow)
      this.parentGroup.add(arrow)
    }
  }

  /**
   * Create a single direction arrow
   */
  private createArrow(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
  ): THREE.Group {
    const group = new THREE.Group()

    // Arrow shaft
    const shaftGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      length * 0.8,
      4,
    )
    const shaftMaterial = new THREE.MeshBasicMaterial({
      color: this.options.directionColor,
    })
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial)

    // Arrow head
    const headGeometry = new THREE.ConeGeometry(0.08, length * 0.2, 6)
    const headMaterial = new THREE.MeshBasicMaterial({
      color: this.options.directionColor,
    })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.y = length * 0.4

    group.add(shaft)
    group.add(head)

    // Position and orient the arrow
    group.position.copy(position)
    group.position.y += 0.1 // Slightly above ground

    // Orient to face the direction
    const up = new THREE.Vector3(0, 1, 0)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      up,
      direction.normalize(),
    )
    group.setRotationFromQuaternion(quaternion)

    return group
  }

  /**
   * Clear all visualization elements
   */
  private clearVisualization(): void {
    // Remove waypoints
    this.waypointMeshes.forEach((mesh) => {
      this.parentGroup.remove(mesh)
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose())
      } else {
        mesh.material.dispose()
      }
    })
    this.waypointMeshes = []

    // Remove curve
    if (this.curveLine) {
      this.parentGroup.remove(this.curveLine)
      this.curveLine.geometry.dispose()
      if (Array.isArray(this.curveLine.material)) {
        this.curveLine.material.forEach((mat) => mat.dispose())
      } else {
        this.curveLine.material.dispose()
      }
      this.curveLine = null
    }

    // Remove direction arrows
    this.directionArrows.forEach((arrow) => {
      this.parentGroup.remove(arrow)
      arrow.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    })
    this.directionArrows = []
  }
}
