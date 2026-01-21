import * as THREE from "three"
import { UIUtils } from "./UIUtils"

/**
 * HTML/CSS-based UI system for Three.js
 * Provides overlay elements for HUD, interaction prompts, menus, and dialogs
 * Uses modern CSS and HTML instead of canvas-based UI
 * 
 * The system uses two separate containers:
 * - Main container: For HUD, menus, etc. Respects safe area insets
 * - World container: For world-space UI (indicators above 3D objects). Not affected by safe areas
 */
export class UISystem {
  private static container: HTMLElement | null = null
  private static worldContainer: HTMLElement | null = null // Separate container for world UI
  private static isInitialized: boolean = false
  private static activeElements: Map<string, UIElement> = new Map()
  private static lastMoneyAmount: number = -1 // Track last money amount for animation

  // Unity-style Canvas Scaler system with "Match Width Or Height" support
  // Reference resolution is the screen size at which UI appears at 100% scale
  // matchWidthOrHeight: 0 = match width only, 1 = match height only, 0.5 = blend both
  private static referenceWidth: number = 1920 // Reference resolution width (Full HD)
  private static referenceHeight: number = 1080 // Reference resolution height (Full HD)
  private static matchWidthOrHeight: number = 0.5 // 0=width, 1=height, 0.5=blend (like Unity)
  private static minScale: number = 0.5 // Minimum scale
  private static maxScale: number = 1.5 // Maximum scale
  private static currentScale: number = 1.0 // Calculated scale

  /**
   * Reset the UISystem state - useful for page refreshes or reinitialization
   */
  public static reset(): void {
    if (UISystem.container) {
      UISystem.container.remove()
      UISystem.container = null
    }
    if (UISystem.worldContainer) {
      UISystem.worldContainer.remove()
      UISystem.worldContainer = null
    }
    UISystem.activeElements.clear()
    UISystem.isInitialized = false
    console.log(`[UISystem] System reset`)
  }

  public static setInsets(insets: {
    left: number
    top: number
    right: number
    bottom: number
  }): void {
    UISystem.initialize()

    const container = UISystem.container
    if (!container) {
      console.warn("UISystem container missing")
      return
    }

    console.log(`[UISystem] Setting safe area insets:`, insets)

    // Apply safe area insets only to the main UI container
    // World UI container is not affected by safe areas to maintain accurate 3D positioning
    container.style.left = insets.left + "px"
    container.style.top = insets.top + "px"
    container.style.right = insets.right + "px"
    container.style.bottom = insets.bottom + "px"
  }

  /**
   * Initialize the UI system
   */
  public static initialize(): void {
    if (UISystem.isInitialized) {
      return
    }

    // Initialize CSS variables (font family, etc.)
    UIUtils.initializeCSSVariables()

    // Create the main UI container (for HUD, menus, etc. - respects safe areas)
    UISystem.container = document.createElement("div")
    UISystem.container.id = "ui-system-three"
    UISystem.container.style.cssText = `
      position: absolute;
      top: 0px;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `
    document.body.appendChild(UISystem.container)

    // Create a separate container for world-space UI (doesn't respect safe areas)
    UISystem.worldContainer = document.createElement("div")
    UISystem.worldContainer.id = "ui-world-system-three"
    UISystem.worldContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `
    document.body.appendChild(UISystem.worldContainer)

    // Add global CSS styles
    UISystem.addGlobalStyles()

    UISystem.isInitialized = true

    // Add CSS custom properties for responsive scaling
    UISystem.updateResponsiveScale()

    // Update responsive scale on window resize
    window.addEventListener("resize", UISystem.updateResponsiveScale)

    // Add debug functions
    ;(window as any).refreshUIStyles = () => {
      console.log("🧪 Forcing UI styles refresh...")
      const existing = document.getElementById("ui-system-three-styles")
      if (existing) {
        existing.remove()
      }
      UISystem.addGlobalStyles()
      console.log("🧪 UI styles refreshed")
    }
    ;(window as any).cleanupUIElements = () => {
      const elements = document.querySelectorAll(".ui-max-indicator")
      console.log(`🧪 Found ${elements.length} MAX indicators, cleaning up...`)
      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect()
        console.log(`Element ${index} position:`, rect)
        if (rect.left === 0 && rect.top === 0) {
          console.log(`🧪 Removing element ${index} (at origin)`)
          el.remove()
        }
      })
    }
    ;(window as any).resetUISystem = () => {
      console.log("🔄 Resetting UI system...")
      UISystem.reset()
      UISystem.initialize()
      console.log("✅ UI system reset complete")
    }

    // UI debug functions available
  }

  /**
   * Add global CSS styles for UI elements
   */
  private static addGlobalStyles(): void {
    const style = document.createElement("style")
    style.textContent = `
      .ui-element {
        position: absolute;
        pointer-events: auto;
        user-select: none;
      }
      
      .ui-hud {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .ui-interaction-prompt {
        background: rgba(74, 222, 128, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
        text-align: center;
        backdrop-filter: blur(4px);
        border: 2px solid rgba(255, 255, 255, 0.3);
        animation: ui-pulse 2s infinite;
      }
      
      .ui-money-display {
        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 20px;
        font-weight: 700;
        box-shadow: 0 6px 0 #16a34a, 0 8px 20px rgba(34, 197, 94, 0.4);
        font-family: var(--game-font);
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        opacity: 0.9;
      }
      
      .ui-progress-bar {
        background: rgba(0, 0, 0, 0.7);
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .ui-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        transition: width 0.3s ease;
      }
      
      .ui-button {
        background: rgba(59, 130, 246, 0.9);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .ui-button:hover {
        background: rgba(79, 70, 229, 0.9);
        transform: translateY(-1px);
      }
      
      .ui-button:active {
        transform: translateY(0);
      }
      
      .ui-modal {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 24px;
        border-radius: 12px;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      }
      
      .ui-tooltip {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      @keyframes ui-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
      }
      
      @keyframes ui-fade-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .ui-fade-in {
        animation: ui-fade-in 0.3s ease;
      }
      
      /* Purchase Area Styles */
      .purchase-area-world-ui {
        position: absolute;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 1000;
      }
      
      .purchase-area-ui {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        text-align: center;
        border: 2px solid #4ade80;
        box-shadow: 0 4px 16px rgba(74, 222, 128, 0.3);
        min-width: 120px;
      }
      
      .purchase-label {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 4px;
        color: #4ade80;
      }
      
      .purchase-progress {
        font-size: 14px;
        margin-bottom: 2px;
        color: #ffffff;
      }
      
      .purchase-percent {
        font-size: 16px;
        font-weight: bold;
        color: #4ade80;
      }
      
      /* MAX Indicator Styles - Moved to world-ui.css */
      /* Commented out to use external CSS file without !important overrides */
      
      /* Table Warning Styles - Moved to world-ui.css */
      /* Commented out to use external CSS file without !important overrides */
      
      @keyframes ui-max-pulse {
        0%, 100% { 
          opacity: 1;
          transform: scale(1);
        }
        50% { 
          opacity: 0.8;
          transform: scale(1.05);
        }
      }
      
      @keyframes bounce-pulse {
        0%, 100% {
          transform: translateY(0) scale(1);
        }
        25% {
          transform: translateY(-4px) scale(1.05);
        }
        50% {
          transform: translateY(0) scale(1.1);
        }
        75% {
          transform: translateY(-2px) scale(1.05);
        }
      }
      
      @keyframes gentle-bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-3px);
        }
      }
      
      @keyframes money-pulse {
        0%, 100% {
          transform: scale(1) rotate(0deg);
        }
        25% {
          transform: scale(1.02) rotate(1deg);
        }
        50% {
          transform: scale(1.05) rotate(-1deg);
        }
        75% {
          transform: scale(1.02) rotate(1deg);
        }
      }
      
      @keyframes money-juice {
        0% {
          transform: scale(1) rotate(0deg);
        }
        10% {
          transform: scale(1.3) rotate(-5deg);
        }
        20% {
          transform: scale(1.15) rotate(5deg);
        }
        30% {
          transform: scale(1.25) rotate(-3deg);
        }
        40% {
          transform: scale(1.1) rotate(3deg);
        }
        50% {
          transform: scale(1.15) rotate(-2deg);
        }
        60% {
          transform: scale(1.05) rotate(2deg);
        }
        70% {
          transform: scale(1.08) rotate(-1deg);
        }
        80% {
          transform: scale(1.02) rotate(1deg);
        }
        90% {
          transform: scale(1.01) rotate(0deg);
        }
        100% {
          transform: scale(1) rotate(0deg);
        }
      }
      
      /* Order Indicator Styles - Moved to world-ui.css */
      /* Commented out to use external CSS file without !important overrides */

      /* Car Order Indicator Styles - Moved to world-ui.css */
      /* Commented out to use external CSS file without !important overrides */
    `
    document.head.appendChild(style)
  }

  /**
   * Create a HUD element (money display, health bar, etc.)
   */
  public static createHUD(
    id: string,
    content: string,
    position: { x: number; y: number },
    options: { className?: string; style?: string } = {},
  ): UIElement {
    const element = UISystem.createElement(
      id,
      "hud",
      content,
      position,
      options,
    )
    element.element.classList.add("ui-hud")
    return element
  }

  /**
   * Create an interaction prompt (Press E to interact, etc.)
   */
  public static createInteractionPrompt(
    id: string,
    text: string,
    position: { x: number; y: number },
  ): UIElement {
    const element = UISystem.createElement(id, "interaction", text, position)
    element.element.classList.add("ui-interaction-prompt")
    return element
  }

  /**
   * Create a progress bar (cooking progress, etc.)
   */
  public static createProgressBar(
    id: string,
    position: { x: number; y: number },
    size: { width: number; height: number },
    progress: number = 0,
  ): UIProgressBar {
    const container = document.createElement("div")
    container.className = "ui-element ui-progress-bar"
    container.style.cssText = `
      left: ${position.x}px;
      top: ${position.y}px;
      width: ${size.width}px;
      height: ${size.height}px;
    `

    const fill = document.createElement("div")
    fill.className = "ui-progress-fill"
    fill.style.width = `${progress * 100}%`
    container.appendChild(fill)

    UISystem.container!.appendChild(container)

    const progressBar: UIProgressBar = {
      id,
      type: "progress",
      element: container,
      fillElement: fill,
      setProgress: (value: number) => {
        fill.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`
      },
      show: () => {
        container.style.display = "block"
      },
      hide: () => {
        container.style.display = "none"
      },
      remove: () => {
        container.remove()
        UISystem.activeElements.delete(id)
      },
    }

    UISystem.activeElements.set(id, progressBar)
    return progressBar
  }

  /**
   * Create a button
   */
  public static createButton(
    id: string,
    text: string,
    position: { x: number; y: number },
    onClick: () => void,
  ): UIElement {
    const element = UISystem.createElement(id, "button", text, position)
    element.element.classList.add("ui-button")
    element.element.addEventListener("click", onClick)
    return element
  }

  /**
   * Create a modal dialog
   */
  public static createModal(
    id: string,
    content: string,
    options: {
      title?: string
      buttons?: Array<{ text: string; onClick: () => void }>
      width?: number
      height?: number
      fullScreenOverlay?: boolean // If true, backdrop will ignore safe areas and cover the full screen
    } = {},
  ): UIElement {
    const modal = document.createElement("div")
    modal.className = "ui-element ui-modal ui-fade-in"
    let style = `
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: ${options.width || 400}px;
      z-index: 1100;
    `
    if (typeof options.height === "number") {
      style += `max-height: ${options.height}px;`
    }
    modal.style.cssText = style
    // Avoid one-frame position/size flicker by rendering hidden and revealing next frame
    ;(modal as HTMLElement).style.visibility = "hidden"

    let html = ""
    if (options.title) {
      html += `<h3 style="margin: 0 0 16px 0; color: #10b981;">${options.title}</h3>`
    }
    html += `<div style="margin-bottom: 16px;">${content}</div>`

    if (options.buttons) {
      html +=
        '<div style="display: flex; gap: 8px; justify-content: flex-end;">'
      options.buttons.forEach((button, index) => {
        html += `<button class="ui-button" data-button-index="${index}">${button.text}</button>`
      })
      html += "</div>"
    }

    modal.innerHTML = html

    // Add button event listeners
    if (options.buttons) {
      options.buttons.forEach((button, index) => {
        const buttonElement = modal.querySelector(
          `[data-button-index="${index}"]`,
        ) as HTMLElement
        if (buttonElement) {
          buttonElement.addEventListener("click", button.onClick)
        }
      })
    }

    // Add backdrop
    const backdrop = document.createElement("div")
    backdrop.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1099;
    `
    
    // Use worldContainer for full-screen overlays that ignore safe areas, otherwise use main container
    const backdropContainer = options.fullScreenOverlay ? UISystem.worldContainer! : UISystem.container!
    backdropContainer.appendChild(backdrop)

    UISystem.container!.appendChild(modal)
    requestAnimationFrame(() => {
      ;(modal as HTMLElement).style.visibility = "visible"
    })

    const element: UIElement = {
      id,
      type: "modal",
      element: modal,
      show: () => {
        modal.style.display = "block"
        backdrop.style.display = "block"
      },
      hide: () => {
        modal.style.display = "none"
        backdrop.style.display = "none"
      },
      remove: () => {
        modal.remove()
        backdrop.remove()
        UISystem.activeElements.delete(id)
      },
    }

    UISystem.activeElements.set(id, element)
    return element
  }

  /**
   * Update money display (special HUD element)
   */
  public static updateMoneyDisplay(amount: number): void {
    // Money display update requested

    const existing = UISystem.activeElements.get("money-display")
    if (existing) {
      // Check if money increased for juice animation
      const shouldJuice =
        UISystem.lastMoneyAmount >= 0 && amount > UISystem.lastMoneyAmount

      // Money display updated
      existing.element.innerHTML = `<span class="money-display-icon"></span>${amount.toLocaleString()}`

      // Apply juice animation if money increased
      if (shouldJuice) {
        // Remove any existing animation
        existing.element.style.animation = "none"

        // Dispatch custom event for sound system to hook into
        window.dispatchEvent(
          new CustomEvent("moneyIncreased", {
            detail: { oldAmount: UISystem.lastMoneyAmount, newAmount: amount },
          }),
        )

        // No more animations - let MoneyChangeIndicator handle attention-grabbing
      }

      UISystem.lastMoneyAmount = amount
    } else {
      // Creating money display

      const money = UISystem.createHUD(
        "money-display",
        `<span class="money-display-icon"></span>${amount.toLocaleString()}`,
        { x: window.innerWidth - 150, y: 20 }, // Top-right positioning
      )
      money.element.classList.add("ui-money-display")

      // Add money display specific styles - define colors here (will be centralized later if needed)
      money.element.style.cssText += `
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        left: auto !important;
        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%) !important;
        color: white !important;
        padding: 12px 20px !important;
        border-radius: 25px !important;
        font-weight: 700 !important;
        font-size: 22px !important;
        box-shadow: 0 6px 0 #16a34a, 0 8px 20px rgba(34, 197, 94, 0.4) !important;
        z-index: 9999 !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        font-family: var(--game-font) !important;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3) !important;
        /* No animation - stable money display */
        transform-origin: center !important;
        opacity: 0.9 !important;
      `

      // Add money icon styles if not already added
      if (!document.querySelector("#money-display-icon-style")) {
        const iconStyle = document.createElement("style")
        iconStyle.id = "money-display-icon-style"
        iconStyle.textContent = `
          .money-display-icon {
            width: 30px;
            height: 30px;
            background-image: url('assets/cozy_game_general/money_icon.png');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            display: inline-block;
            flex-shrink: 0;
            filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.4));
          }
        `
        document.head.appendChild(iconStyle)
      }

      // Money display created
      UISystem.lastMoneyAmount = amount
    }
  }

  /**
   * Create a world-space UI element that follows a 3D position
   */
  public static createWorldSpaceUI(
    id: string,
    content: string,
    worldPosition: THREE.Vector3,
    camera: THREE.Camera,
    options: { offset?: { x: number; y: number }; className?: string } = {},
  ): UIWorldElement {
    const element = document.createElement("div")
    element.className = `ui-element ${options.className || "ui-tooltip"}`
    element.innerHTML = content
    element.style.position = "absolute"

    // Use world container instead of regular container to avoid safe area issues
    UISystem.worldContainer!.appendChild(element)

    const worldElement: UIWorldElement = {
      id,
      type: "world",
      element,
      worldPosition: worldPosition.clone(),
      update: (camera: THREE.Camera) => {
        // Project 3D position to screen coordinates
        const screenPosition = worldPosition.clone().project(camera)

        // Convert to pixel coordinates
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth
        const y = (screenPosition.y * -0.5 + 0.5) * window.innerHeight

        // Apply offset
        const offsetX = options.offset?.x || 0
        const offsetY = options.offset?.y || -30

        element.style.left = `${x + offsetX}px`
        element.style.top = `${y + offsetY}px`
        element.style.transform = "translate(-50%, -50%)" // Center the element on the position
        element.style.transformOrigin = "center"

        // Hide if behind camera
        element.style.display = screenPosition.z > 1 ? "none" : "block"
      },
      show: () => {
        element.style.display = "block"
      },
      hide: () => {
        element.style.display = "none"
      },
      remove: () => {
        element.remove()
        UISystem.activeElements.delete(id)
      },
    }

    UISystem.activeElements.set(id, worldElement)
    return worldElement
  }

  /**
   * Update all world-space UI elements
   */
  public static updateWorldSpaceElements(camera: THREE.Camera): void {
    UISystem.activeElements.forEach((element) => {
      if (element.type === "world" && "update" in element) {
        ;(element as UIWorldElement).update(camera)
      }
    })
  }

  /**
   * Unity-style Canvas Scaler with "Match Width Or Height" support
   * 
   * How it works:
   * - Reference resolution (e.g., 800x600) - screen size where UI is 100% scale
   * - matchWidthOrHeight: 0 = match width, 1 = match height, 0.5 = blend both
   * - UI components use CSS: transform: scale(var(--ui-scale, 1))
   * 
   * The blend formula (same as Unity):
   * scale = widthScale^(1-match) * heightScale^match
   * 
   * This means on portrait mobile (narrow width, tall height):
   * - Width-only (match=0): very small UI
   * - Height-only (match=1): large UI  
   * - Blend (match=0.5): balanced UI that looks good
   */
  public static updateResponsiveScale(): void {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    
    // Calculate scale factors for width and height
    const widthScale = screenWidth / UISystem.referenceWidth
    const heightScale = screenHeight / UISystem.referenceHeight
    
    // Unity's blend formula: scale = widthScale^(1-match) * heightScale^match
    const match = UISystem.matchWidthOrHeight
    const rawScale = Math.pow(widthScale, 1 - match) * Math.pow(heightScale, match)
    
    // Clamp the scale to prevent extremes
    const prevScale = UISystem.currentScale
    UISystem.currentScale = Math.max(UISystem.minScale, Math.min(UISystem.maxScale, rawScale))
    
    // Log scale changes for debugging
    if (Math.abs(prevScale - UISystem.currentScale) > 0.01) {
      console.log(`[UISystem] Canvas Scale: ${UISystem.currentScale.toFixed(2)} (screen: ${screenWidth}x${screenHeight}, ref: ${UISystem.referenceWidth}x${UISystem.referenceHeight}, match: ${match})`)
    }

    // Set CSS custom property that UI components use via: transform: scale(var(--ui-scale, 1))
    document.documentElement.style.setProperty("--ui-scale", UISystem.currentScale.toString())
    document.documentElement.style.setProperty("--screen-width", `${screenWidth}px`)
    document.documentElement.style.setProperty("--screen-height", `${screenHeight}px`)
  }

  /**
   * Create a HUD element with responsive anchor-based positioning
   */
  public static createResponsiveHUD(
    id: string,
    content: string,
    anchor: { x: number; y: number }, // 0-1 values (0 = left/top, 1 = right/bottom)
    offset: { x: number; y: number } = { x: 0, y: 0 }, // Pixel offset from anchor
    options: { className?: string; style?: string } = {},
  ): UIElement {
    const element = document.createElement("div")
    element.className = `ui-element ui-responsive ${options.className || ""}`
    element.innerHTML = content

    // Use CSS positioning with calc() for responsive anchoring
    element.style.position = "absolute"
    element.style.left = `calc(${anchor.x * 100}% + ${offset.x}px)`
    element.style.top = `calc(${anchor.y * 100}% + ${offset.y}px)`
    element.style.transform = `translate(-${anchor.x * 100}%, -${anchor.y * 100}%) scale(var(--ui-scale, 1))`
    element.style.transformOrigin = "center"
    element.style.pointerEvents = "none"
    element.style.zIndex = "1000"

    if (options.style) {
      element.style.cssText += options.style
    }

    UISystem.container!.appendChild(element)

    const uiElement: UIElement = {
      id,
      type: "hud",
      element,
      show: () => {
        element.style.display = "block"
      },
      hide: () => {
        element.style.display = "none"
      },
      remove: () => {
        element.remove()
        UISystem.activeElements.delete(id)
      },
    }

    UISystem.activeElements.set(id, uiElement)
    return uiElement
  }

  /**
   * Get an element by ID
   */
  public static getElement(id: string): UIElement | undefined {
    return UISystem.activeElements.get(id)
  }

  /**
   * Remove an element
   */
  public static removeElement(id: string): void {
    const element = UISystem.activeElements.get(id)
    if (element) {
      element.remove()
    }
  }

  /**
   * Clear all UI elements
   */
  public static clear(): void {
    UISystem.activeElements.forEach((element) => element.remove())
    UISystem.activeElements.clear()
  }

  /**
   * Show/hide the entire UI system
   */
  public static setVisible(visible: boolean): void {
    if (UISystem.container) {
      UISystem.container.style.display = visible ? "block" : "none"
    }
    if (UISystem.worldContainer) {
      UISystem.worldContainer.style.display = visible ? "block" : "none"
    }
  }

  /**
   * Generic element creation helper
   */
  private static createElement(
    id: string,
    type: string,
    content: string,
    position: { x: number; y: number },
    options: { className?: string; style?: string } = {},
  ): UIElement {
    const element = document.createElement("div")
    element.className = `ui-element ${options.className || ""}`
    element.innerHTML = content
    element.style.cssText = `
      left: ${position.x}px;
      top: ${position.y}px;
      ${options.style || ""}
    `

    UISystem.container!.appendChild(element)

    const uiElement: UIElement = {
      id,
      type,
      element,
      show: () => {
        element.style.display = "block"
      },
      hide: () => {
        element.style.display = "none"
      },
      remove: () => {
        element.remove()
        UISystem.activeElements.delete(id)
      },
    }

    UISystem.activeElements.set(id, uiElement)
    return uiElement
  }

  /**
   * Configure the reference resolution for UI scaling (like Unity's Canvas Scaler)
   * @param referenceWidth - The width at which UI is designed (default: 1920 Full HD)
   * @param referenceHeight - The height at which UI is designed (default: 1080 Full HD)
   * @param matchWidthOrHeight - 0 = match width, 1 = match height, 0.5 = blend both (recommended)
   * @param minScale - Minimum scale factor (prevents UI from getting too small)
   * @param maxScale - Maximum scale factor (prevents UI from getting too large)
   */
  public static configureScaling(
    referenceWidth: number = 1920,
    referenceHeight: number = 1080,
    matchWidthOrHeight: number = 0.5,
    minScale: number = 0.5,
    maxScale: number = 1.5
  ): void {
    UISystem.referenceWidth = referenceWidth
    UISystem.referenceHeight = referenceHeight
    UISystem.matchWidthOrHeight = Math.max(0, Math.min(1, matchWidthOrHeight))
    UISystem.minScale = minScale
    UISystem.maxScale = maxScale
    UISystem.updateResponsiveScale()
  }

  /**
   * Get the current calculated UI scale factor
   */
  public static getUIScale(): number {
    return UISystem.currentScale
  }

  /**
   * Get the reference width used for scaling calculations
   */
  public static getReferenceWidth(): number {
    return UISystem.referenceWidth
  }

  /**
   * Dispose of the UI system
   */
  public static dispose(): void {
    UISystem.clear()
    window.removeEventListener("resize", UISystem.updateResponsiveScale)
    if (UISystem.container) {
      UISystem.container.remove()
      UISystem.container = null
    }
    if (UISystem.worldContainer) {
      UISystem.worldContainer.remove()
      UISystem.worldContainer = null
    }
    UISystem.isInitialized = false
  }
}

// UI Element interfaces
export interface UIElement {
  id: string
  type: string
  element: HTMLElement
  show: () => void
  hide: () => void
  remove: () => void
}

export interface UIProgressBar extends UIElement {
  fillElement: HTMLElement
  setProgress: (value: number) => void
}

export interface UIWorldElement extends UIElement {
  worldPosition: THREE.Vector3
  update: (camera: THREE.Camera) => void
}
