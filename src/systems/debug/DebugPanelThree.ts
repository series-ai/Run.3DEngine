import * as THREE from "three"
import { PhysicsSystem } from "../physics/PhysicsSystem"
import { DynamicNavSystem } from "../navigation/DynamicNavSystem"
import { NavGridDebugDisplayThree } from "../navigation/NavGridDebugDisplayThree"
import { PathVisualizationThree } from "../navigation/PathVisualizationThree"
import { SplineDebugManager } from "../spline/SplineDebugManager"
import { AssetManager } from "@engine/assets/AssetManager"

/**
 * Debug option interface for tracking state
 */
interface DebugOption {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  element?: HTMLElement
}

/**
 * Base Debug panel for Three.js applications
 * Can be extended by specific game implementations to add custom debug options
 */
export class DebugPanelThree {
  // Static variable to always hide debug panel for release builds
  public static alwaysHide: boolean = false  
  
  protected container!: HTMLElement
  protected contentContainer!: HTMLElement
  protected options: DebugOption[] = []
  protected isVisible: boolean = true
  protected contentsExpanded: boolean = false
  protected performanceStats: { fps: number; frameTime: number } = {
    fps: 0,
    frameTime: 0,
  }
  protected performanceElement?: HTMLElement
  protected playerPositionElement?: HTMLElement
  protected renderer?: any // Three.js renderer for draw call stats
  protected playerGameObject?: any // Player GameObject for position tracking

  constructor() {
    this.createPanel()
    this.setupKeyboardToggle()
    this.setupPerformanceMonitoring()
    this.addCoreOptions()
    
    // Hide the panel immediately if alwaysHide is enabled
    if (DebugPanelThree.alwaysHide) {
      this.hide()
    }
  }

  /**
   * Set the Three.js renderer for draw call tracking
   * Should be called by the game implementation
   */
  public setRenderer(renderer: any): void {
    this.renderer = renderer
  }

  /**
   * Set the player GameObject for position tracking
   * Should be called by the game implementation
   */
  public setPlayerGameObject(playerGameObject: any): void {
    this.playerGameObject = playerGameObject
  }

  /**
   * Create the main debug panel HTML structure
   */
  protected createPanel(): void {
    // Create main container
    this.container = document.createElement("div")
    this.container.id = "debug-panel-three"
    this.container.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      width: 240px;
      min-width: 240px;
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 10px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: white;
      z-index: 1000;
      display: block;
      backdrop-filter: blur(10px);
      transition: width 0.3s ease-out;
      pointer-events: auto;
    `

    // Create title with expand/collapse functionality
    const titleContainer = document.createElement("div")
    titleContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
    `

    const titleText = document.createElement("span")
    titleText.textContent = "Debug"
    titleText.style.cssText = `
      font-weight: bold;
      color: #5B9AE8;
    `

    const expandCheckbox = document.createElement("input")
    expandCheckbox.type = "checkbox"
    expandCheckbox.checked = this.contentsExpanded
    expandCheckbox.style.cssText = `
      margin-left: 10px;
      cursor: pointer;
    `

    titleContainer.appendChild(titleText)
    titleContainer.appendChild(expandCheckbox)
    this.container.appendChild(titleContainer)

    // Create content container
    this.contentContainer = document.createElement("div")
    this.contentContainer.style.display = this.contentsExpanded
      ? "block"
      : "none"
    this.container.appendChild(this.contentContainer)

    // Add expand/collapse functionality
    const toggleContents = () => {
      this.contentsExpanded = !this.contentsExpanded
      expandCheckbox.checked = this.contentsExpanded
      this.contentContainer.style.display = this.contentsExpanded
        ? "block"
        : "none"
      
      // Adjust panel width and styling based on expanded state
      if (this.contentsExpanded) {
        this.container.style.width = "240px" // Full width when expanded
        this.container.style.minWidth = "240px"
        titleContainer.style.borderBottom = "1px solid rgba(255, 255, 255, 0.2)" // Show divider
        titleContainer.style.marginBottom = "10px"
        titleContainer.style.paddingBottom = "8px"
      } else {
        this.container.style.width = "auto" // Narrow width when collapsed
        this.container.style.minWidth = "90px"
        titleContainer.style.borderBottom = "none" // Hide divider
        titleContainer.style.marginBottom = "0"
        titleContainer.style.paddingBottom = "0"
      }
    }

    titleContainer.addEventListener("click", toggleContents)
    expandCheckbox.addEventListener("click", (e) => {
      e.stopPropagation()
      toggleContents()
    })

    // Add panel to UISystem container if available, otherwise document.body
    const uiContainer = document.getElementById("ui-system-three")
    if (uiContainer) {
      uiContainer.appendChild(this.container)
    } else {
      // Fallback to document.body if UISystem is not initialized
      document.body.appendChild(this.container)
    }
    
    // Set initial width and styling based on expanded state
    if (this.contentsExpanded) {
      this.container.style.width = "240px"
      this.container.style.minWidth = "240px"
      titleContainer.style.borderBottom = "1px solid rgba(255, 255, 255, 0.2)"
      titleContainer.style.marginBottom = "10px"
      titleContainer.style.paddingBottom = "8px"
    } else {
      this.container.style.width = "auto"
      this.container.style.minWidth = "90px"
      titleContainer.style.borderBottom = "none"
      titleContainer.style.marginBottom = "0"
      titleContainer.style.paddingBottom = "0"
    }
  }

  /**
   * Add core debug options that all implementations should have
   * Can be overridden by implementations to add custom options
   */
  protected addCoreOptions(): void {
    // Add performance stats as the first option
    this.addOption("Performance Stats", false, (checked) => {
      if (this.performanceElement) {
        this.performanceElement.style.display = checked ? "block" : "none"
      }
    })

    // Create performance stats display
    this.createPerformanceDisplay()

    // Add common debug options with working implementations
    this.addCommonDebugOptions()
  }

  /**
   * Add common debug options that most Three.js games will need
   * These have working implementations using dynamic imports
   */
  protected addCommonDebugOptions(): void {
    // Add physics debug toggle with working implementation
    this.addOption("Physics Debug", false, (checked) => {
      PhysicsSystem.setDebugEnabled(checked)
    })

    // Add navigation debug toggle with working implementation
    this.addOption("Navigation Debug", false, (checked) => {
      if (checked) {
        DynamicNavSystem.debugNavigation()
      } else {
        NavGridDebugDisplayThree.clearDebugLines()
      }
    })

    // Add path visualization toggle with working implementation
    this.addOption("Path Visualization", false, (checked) => {
      PathVisualizationThree.setVisualizationEnabled(checked)
      // Path visualization toggled
    })

    // Add spline debug toggle with working implementation
    this.addOption("Spline Debug", false, (checked) => {
      SplineDebugManager.getInstance().setDebugEnabled(checked)
    })

    // Post-processing option removed - using pure Three.js rendering

    // Add instancing report command (one-time action)
    this.addOption("Print Instance Report", false, (checked) => {
      if (checked) {
        const report = AssetManager.getInstanceReport()
        console.log(report)

        // Also expose to global for easy access
        ;(window as any).getInstanceReport = () =>
          AssetManager.getInstanceReport()
        console.log("💡 Use getInstanceReport() in console for updated reports")

        // Remove this option after use (reset checkbox)
        setTimeout(() => {
          const checkbox = document.querySelector(
            `input[type="checkbox"][data-label="Print Instance Report"]`,
          ) as HTMLInputElement
          if (checkbox) {
            checkbox.checked = false
          }
        }, 100)
      }
    })
  }

  // Post-processing callback method removed - post-processing disabled

  /**
   * Add a debug option to the panel
   */
  public addOption(
    label: string,
    defaultValue: boolean,
    onChange: (checked: boolean) => void,
  ): void {
    const optionContainer = document.createElement("div")
    optionContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      margin: 4px 0;
      background: ${defaultValue ? "rgba(91, 154, 232, 0.2)" : "rgba(255, 255, 255, 0.1)"};
      border-radius: 4px;
      transition: background-color 0.2s;
    `

    const labelElement = document.createElement("span")
    labelElement.textContent = label
    labelElement.style.cssText = `
      color: white;
      font-size: 13px;
    `

    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.checked = defaultValue
    checkbox.setAttribute("data-label", label) // Add data attribute for identification
    checkbox.style.cssText = `
      cursor: pointer;
      accent-color: #5B9AE8;
    `

    optionContainer.appendChild(labelElement)
    optionContainer.appendChild(checkbox)
    this.contentContainer.appendChild(optionContainer)

    // Store option data
    const option: DebugOption = {
      label,
      checked: defaultValue,
      onChange,
      element: optionContainer,
    }

    this.options.push(option)

    // Set up event handler
    checkbox.addEventListener("change", () => {
      option.checked = checkbox.checked
      optionContainer.style.background = checkbox.checked
        ? "rgba(91, 154, 232, 0.2)"
        : "rgba(255, 255, 255, 0.1)"
      onChange(checkbox.checked)
    })

    // Trigger initial state
    onChange(defaultValue)
  }

  /**
   * Add a numeric slider to the panel
   */
  public addSlider(
    label: string,
    defaultValue: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
  ): void {
    const optionContainer = document.createElement("div")
    optionContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 8px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    `

    const labelContainer = document.createElement("div")
    labelContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    `

    const labelElement = document.createElement("span")
    labelElement.textContent = label
    labelElement.style.cssText = `
      color: white;
      font-size: 13px;
    `

    const valueElement = document.createElement("span")
    valueElement.textContent = defaultValue.toFixed(3)
    valueElement.style.cssText = `
      color: #5B9AE8;
      font-size: 12px;
    `

    const slider = document.createElement("input")
    slider.type = "range"
    slider.min = min.toString()
    slider.max = max.toString()
    slider.step = ((max - min) / 100).toString()
    slider.value = defaultValue.toString()
    slider.style.cssText = `
      width: 100%;
      cursor: pointer;
      accent-color: #5B9AE8;
    `

    labelContainer.appendChild(labelElement)
    labelContainer.appendChild(valueElement)
    optionContainer.appendChild(labelContainer)
    optionContainer.appendChild(slider)
    this.contentContainer.appendChild(optionContainer)

    // Set up event handler
    slider.addEventListener("input", () => {
      const value = parseFloat(slider.value)
      valueElement.textContent = value.toFixed(3)
      onChange(value)
    })

    // Trigger initial value
    onChange(defaultValue)
  }

  /**
   * Create performance stats display
   */
  protected createPerformanceDisplay(): void {
    this.performanceElement = document.createElement("div")
    this.performanceElement.style.cssText = `
      padding: 8px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 11px;
      display: none;
      line-height: 1.4;
    `

    this.performanceElement.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; color: #5B9AE8;">Performance:</div>
      <div id="fps-display">FPS: --</div>
      <div id="frame-time-display">Frame Time: -- ms</div>
      
      <div style="font-weight: bold; margin: 6px 0 2px 0; color: #5B9AE8;">Rendering:</div>
      <div id="draw-calls-display">Draw Calls: --</div>
      <div id="triangles-display">Triangles: --</div>
      
      <div style="font-weight: bold; margin: 6px 0 2px 0; color: #5B9AE8;">Instancing:</div>
      <div id="total-instances-display">Total: --</div>
      <div id="gpu-instances-display">GPU: --</div>
      <div id="shared-instances-display">Shared: --</div>
      <div id="cloned-instances-display">Cloned: --</div>
      <div id="broken-instances-display">Broken: --</div>
      <div id="geometry-reuse-display">Geo Reuse: --x</div>
    `

    this.contentContainer.appendChild(this.performanceElement)
  }

  /**
   * Create player position display
   */
  protected createPlayerPositionDisplay(): void {
    this.playerPositionElement = document.createElement("div")
    this.playerPositionElement.style.cssText = `
      padding: 8px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 11px;
      display: none;
      line-height: 1.4;
    `

    this.playerPositionElement.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; color: #5B9AE8;">Player Position:</div>
      <div id="player-x-display">X: --</div>
      <div id="player-y-display">Y: --</div>
      <div id="player-z-display">Z: --</div>
    `

    this.contentContainer.appendChild(this.playerPositionElement)
  }

  /**
   * Set up performance monitoring
   */
  protected setupPerformanceMonitoring(): void {
    let lastTime = performance.now()
    let frameCount = 0
    let fpsUpdateTime = performance.now()

    const updatePerformance = () => {
      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      frameCount++

      // Update FPS every second
      if (currentTime - fpsUpdateTime >= 1000) {
        this.performanceStats.fps = Math.round(
          frameCount / ((currentTime - fpsUpdateTime) / 1000),
        )
        frameCount = 0
        fpsUpdateTime = currentTime
      }

      this.performanceStats.frameTime = Math.round(deltaTime * 100) / 100

      // Update display
      this.updatePerformanceDisplay()
      this.updatePlayerPositionDisplay()

      requestAnimationFrame(updatePerformance)
    }

    requestAnimationFrame(updatePerformance)
  }

  /**
   * Update all performance metrics in the display
   */
  protected updatePerformanceDisplay(): void {
    // Basic performance metrics
    const fpsDisplay = document.getElementById("fps-display")
    const frameTimeDisplay = document.getElementById("frame-time-display")

    if (fpsDisplay) fpsDisplay.textContent = `FPS: ${this.performanceStats.fps}`
    if (frameTimeDisplay)
      frameTimeDisplay.textContent = `Frame Time: ${this.performanceStats.frameTime} ms`

    // Three.js rendering metrics
    if (this.renderer && this.renderer.info) {
      const info = this.renderer.info

      const drawCallsDisplay = document.getElementById("draw-calls-display")
      const trianglesDisplay = document.getElementById("triangles-display")

      if (drawCallsDisplay) {
        const drawCalls = info.render?.calls || 0
        drawCallsDisplay.textContent = `Draw Calls: ${drawCalls}`

        // Color code draw calls (green = good, yellow = ok, red = bad)
        if (drawCalls < 50) {
          drawCallsDisplay.style.color = "#4CAF50" // Green
        } else if (drawCalls < 100) {
          drawCallsDisplay.style.color = "#FF9800" // Orange
        } else {
          drawCallsDisplay.style.color = "#F44336" // Red
        }
      }

      if (trianglesDisplay) {
        const triangles = info.render?.triangles || 0
        const trianglesK = Math.round(triangles / 1000)
        trianglesDisplay.textContent = `Triangles: ${trianglesK}K`

        // Color code triangles
        if (triangles < 50000) {
          trianglesDisplay.style.color = "#4CAF50" // Green
        } else if (triangles < 100000) {
          trianglesDisplay.style.color = "#FF9800" // Orange
        } else {
          trianglesDisplay.style.color = "#F44336" // Red
        }
      }

      // Manually reset renderer info if autoReset is disabled
      // This prevents accumulation of draw calls/triangles
      if (!info.autoReset) {
        info.reset()
      }
    }

    // Instancing statistics (import dynamically to avoid circular dependencies)
    const instanceStats = AssetManager.getGlobalInstanceStats()

    const totalDisplay = document.getElementById("total-instances-display")
    const gpuDisplay = document.getElementById("gpu-instances-display")
    const sharedDisplay = document.getElementById("shared-instances-display")
    const clonedDisplay = document.getElementById("cloned-instances-display")
    const brokenDisplay = document.getElementById("broken-instances-display")
    const geoReuseDisplay = document.getElementById("geometry-reuse-display")

    if (totalDisplay)
      totalDisplay.textContent = `Total: ${instanceStats.totalInstances}`

    if (gpuDisplay) {
      gpuDisplay.textContent = `GPU: ${instanceStats.gpuInstances}`

      // Color code GPU instances (higher is better for performance)
      const gpuPercent =
        instanceStats.totalInstances > 0
          ? Math.round(
              (instanceStats.gpuInstances / instanceStats.totalInstances) * 100,
            )
          : 0

      if (gpuPercent > 70) {
        gpuDisplay.style.color = "#4CAF50" // Green - excellent GPU usage
      } else if (gpuPercent > 40) {
        gpuDisplay.style.color = "#FF9800" // Orange - moderate GPU usage
      } else {
        gpuDisplay.style.color = "#F44336" // Red - poor GPU usage
      }
    }

    if (sharedDisplay) {
      const sharedPercent =
        instanceStats.totalInstances > 0
          ? Math.round(
              (instanceStats.sharedInstances / instanceStats.totalInstances) *
                100,
            )
          : 0
      sharedDisplay.textContent = `Shared: ${instanceStats.sharedInstances} (${sharedPercent}%)`

      // Color code shared instances (higher % is better)
      if (sharedPercent > 70) {
        sharedDisplay.style.color = "#4CAF50" // Green
      } else if (sharedPercent > 40) {
        sharedDisplay.style.color = "#FF9800" // Orange
      } else {
        sharedDisplay.style.color = "#F44336" // Red
      }
    }

    if (clonedDisplay) {
      const clonedPercent =
        instanceStats.totalInstances > 0
          ? Math.round(
              (instanceStats.clonedInstances / instanceStats.totalInstances) *
                100,
            )
          : 0
      clonedDisplay.textContent = `Cloned: ${instanceStats.clonedInstances} (${clonedPercent}%)`
    }

    if (brokenDisplay) {
      brokenDisplay.textContent = `Broken: ${instanceStats.brokenInstances}`

      // Color code broken instances (fewer is better)
      if (instanceStats.brokenInstances === 0) {
        brokenDisplay.style.color = "#4CAF50" // Green
      } else if (instanceStats.brokenInstances < 5) {
        brokenDisplay.style.color = "#FF9800" // Orange
      } else {
        brokenDisplay.style.color = "#F44336" // Red
      }
    }

    if (geoReuseDisplay) {
      geoReuseDisplay.textContent = `Geo Reuse: ${instanceStats.geometryReuse}x`

      // Color code geometry reuse (higher is better for instancing)
      if (instanceStats.geometryReuse > 3) {
        geoReuseDisplay.style.color = "#4CAF50" // Green
      } else if (instanceStats.geometryReuse > 1.5) {
        geoReuseDisplay.style.color = "#FF9800" // Orange
      } else {
        geoReuseDisplay.style.color = "#F44336" // Red
      }
    }
  }

  /**
   * Update player position display
   */
  protected updatePlayerPositionDisplay(): void {
    if (!this.playerGameObject) {
      // Set displays to show no data available
      const xDisplay = document.getElementById("player-x-display")
      const yDisplay = document.getElementById("player-y-display")
      const zDisplay = document.getElementById("player-z-display")

      if (xDisplay) xDisplay.textContent = `X: --`
      if (yDisplay) yDisplay.textContent = `Y: --`
      if (zDisplay) zDisplay.textContent = `Z: --`
      return
    }

    try {
      // Get world position of the player
      const worldPos = new THREE.Vector3()
      this.playerGameObject.getWorldPosition(worldPos)

      // Update the position displays
      const xDisplay = document.getElementById("player-x-display")
      const yDisplay = document.getElementById("player-y-display")
      const zDisplay = document.getElementById("player-z-display")

      if (xDisplay) xDisplay.textContent = `X: ${worldPos.x.toFixed(2)}`
      if (yDisplay) yDisplay.textContent = `Y: ${worldPos.y.toFixed(2)}`
      if (zDisplay) zDisplay.textContent = `Z: ${worldPos.z.toFixed(2)}`
    } catch (error) {
      // Silently handle errors when player object is not available
      const xDisplay = document.getElementById("player-x-display")
      const yDisplay = document.getElementById("player-y-display")
      const zDisplay = document.getElementById("player-z-display")

      if (xDisplay) xDisplay.textContent = `X: --`
      if (yDisplay) yDisplay.textContent = `Y: --`
      if (zDisplay) zDisplay.textContent = `Z: --`
    }
  }

  /**
   * Set up keyboard toggle for debug panel
   */
  protected setupKeyboardToggle(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key === "`" || event.key === "~") {
        // Backtick or tilde key
        this.toggle()
        event.preventDefault()
      } else if (event.key === "Tab") {
        // Tab key - complete visibility toggle for marketing purposes
        this.toggle()
        event.preventDefault()
      }
    })
  }

  /**
   * Show the debug panel
   */
  public show(): void {
    // Don't show if always hidden for release builds
    if (DebugPanelThree.alwaysHide) {
      return
    }
    
    this.isVisible = true
    this.container.style.display = "block"
  }

  /**
   * Hide the debug panel
   */
  public hide(): void {
    this.isVisible = false
    this.container.style.display = "none"
  }

  /**
   * Toggle the debug panel visibility
   */
  public toggle(): void {
    // Don't toggle if always hidden for release builds
    if (DebugPanelThree.alwaysHide) {
      return
    }
    
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  /**
   * Get current visibility state
   */
  public getVisibility(): boolean {
    return this.isVisible
  }

  /**
   * Dispose of the debug panel
   */
  public dispose(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.options = []
  }
}
