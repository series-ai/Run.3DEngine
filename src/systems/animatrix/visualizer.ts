import Animatrix, { AnimationEvent, ParameterType } from "./animatrix"

interface NodePosition {
  x: number
  y: number
}

export default class AnimatrixVisualizer {
  private animator: Animatrix | null
  private animators: Map<string, Animatrix>
  private current_animator_name: string | null
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private node_positions: Map<string, NodePosition>
  private is_visible: boolean
  private container: HTMLDivElement
  private auto_layout_complete: boolean
  private animation_frame_id: number | null
  private event_listeners: Map<string, () => void>

  private readonly NODE_RADIUS = 35
  private readonly NODE_COLOR_IDLE = "#444444"
  private readonly NODE_COLOR_ACTIVE = "#4CAF50"
  private readonly NODE_COLOR_TRANSITIONING = "#FFA726"
  private readonly NODE_COLOR_BLENDTREE = "#607D8B"
  private readonly CONNECTION_COLOR = "#888888"
  private readonly CONNECTION_COLOR_ACTIVE = "#2196F3"
  private readonly TEXT_COLOR = "#FFFFFF"
  private readonly BG_COLOR = "rgba(30, 30, 30, 0.95)"

  // View transform (panning/zooming)
  private viewScale: number = 1
  private panX: number = 0
  private panY: number = 0
  private isPanningView: boolean = false
  private panStart: { x: number; y: number } = { x: 0, y: 0 }

  // Window drag/resize/minimize
  private isDraggingWindow: boolean = false
  private dragWindowOffset: { x: number; y: number } = { x: 0, y: 0 }
  private isResizingWindow: boolean = false
  private resizeStart: { x: number; y: number; w: number; h: number } = {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }
  private isMinimized: boolean = false
  // Blend tree drawer states
  private nodeDrawerOpen: Set<string> = new Set()
  // Track hover state for chevron areas
  private hoveredChevron: string | null = null
  // Labels to draw in screen space (unscaled by zoom)
  private pendingLabels: Array<{
    text: string
    x: number
    y: number
    align: CanvasTextAlign
    baseline: CanvasTextBaseline
    font: string
    color: string
  }> = []

  private getLOD(): number {
    // 0 = full detail, 1 = medium, 2 = minimal, 3 = headers only
    const s = this.viewScale
    if (s >= 1.2) return 0
    if (s >= 0.8) return 1
    if (s >= 0.5) return 2
    return 3
  }

  constructor(animator?: Animatrix, name?: string) {
    this.animator = null
    this.animators = new Map()
    this.current_animator_name = null
    this.node_positions = new Map()
    this.is_visible = true
    this.auto_layout_complete = false
    this.animation_frame_id = null
    this.event_listeners = new Map()

    this.container = document.createElement("div")
    this.container.style.position = "absolute"
    this.container.style.bottom = "10px"
    this.container.style.right = "10px"
    this.container.style.width = "500px"
    this.container.style.height = "400px"
    this.container.style.backgroundColor = this.BG_COLOR
    this.container.style.border = "2px solid #333"
    this.container.style.borderRadius = "8px"
    this.container.style.overflow = "hidden"
    this.container.style.fontFamily = "monospace"
    this.container.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)"
    this.container.style.zIndex = "2147483647"
    this.container.style.pointerEvents = "auto"

    const header = document.createElement("div")
    header.style.backgroundColor = "#222"
    header.style.padding = "8px"
    header.style.color = "#FFF"
    header.style.fontSize = "12px"
    header.style.borderBottom = "1px solid #444"
    header.style.display = "flex"
    header.style.justifyContent = "space-between"
    header.style.alignItems = "center"
    header.style.cursor = "move"

    const title_span = document.createElement("span")
    title_span.id = "visualizer-title"
    title_span.textContent = "ANIMATION GRAPH"
    header.appendChild(title_span)

    const controls_div = document.createElement("div")
    controls_div.style.display = "flex"
    controls_div.style.gap = "8px"
    controls_div.style.alignItems = "center"

    const animator_select = document.createElement("select")
    animator_select.id = "animator-select"
    animator_select.style.background = "#333"
    animator_select.style.border = "1px solid #555"
    animator_select.style.color = "#FFF"
    animator_select.style.padding = "2px 4px"
    animator_select.style.borderRadius = "3px"
    animator_select.style.fontSize = "11px"
    animator_select.style.cursor = "pointer"
    animator_select.style.display = "none"
    animator_select.onchange = (e) => {
      const target = e.target as HTMLSelectElement
      this.set_animator(target.value)
    }
    controls_div.appendChild(animator_select)

    const toggle_btn = document.createElement("button")
    toggle_btn.textContent = "−"
    toggle_btn.style.background = "none"
    toggle_btn.style.border = "1px solid #666"
    toggle_btn.style.color = "#FFF"
    toggle_btn.style.cursor = "pointer"
    toggle_btn.style.padding = "2px 8px"
    toggle_btn.style.borderRadius = "3px"
    toggle_btn.onclick = () => this.toggle_minimize()
    controls_div.appendChild(toggle_btn)
    header.appendChild(controls_div)

    // Create main content area with flex layout
    const content_area = document.createElement("div")
    content_area.style.display = "flex"
    content_area.style.height = "calc(100% - 40px)" // Account for header height
    content_area.style.backgroundColor = this.BG_COLOR

    const params_panel = document.createElement("div")
    params_panel.id = "params-panel"
    params_panel.style.backgroundColor = "#1a1a1a"
    params_panel.style.padding = "8px"
    params_panel.style.fontSize = "11px"
    params_panel.style.color = "#AAA"
    params_panel.style.width = "180px"
    params_panel.style.minWidth = "160px"
    params_panel.style.overflowY = "auto"
    params_panel.style.borderRight = "1px solid #333"
    params_panel.style.flexShrink = "0"

    this.canvas = document.createElement("canvas")
    this.canvas.style.flex = "1"
    this.canvas.style.minWidth = "300px"

    content_area.appendChild(params_panel)
    content_area.appendChild(this.canvas)

    this.container.appendChild(header)
    this.container.appendChild(content_area)

    // Set initial visibility based on is_visible flag
    this.container.style.display = this.is_visible ? "block" : "none"

    document.body.appendChild(this.container)

    this.ctx = this.canvas.getContext("2d")!

    const stopAll = (e: Event) => {
      e.stopPropagation()
    }
    // Prevent game input from consuming these events. Do NOT block move events so window listeners still receive them.
    ;[
      "mousedown",
      "click",
      "dblclick",
      "contextmenu",
      "pointerdown",
      "wheel",
    ].forEach((type) => {
      this.container.addEventListener(type as any, stopAll)
    })
    // Ensure releasing inside the window stops drag/resize immediately
    this.container.addEventListener("mouseup", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.stop_window_drag()
      this.stop_window_resize()
    })
    this.container.addEventListener("pointerup", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.stop_window_drag()
      this.stop_window_resize()
    })

    this.canvas.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.handle_mouse_down(e)
    })
    this.canvas.addEventListener("mousemove", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.handle_mouse_move(e)
    })
    this.canvas.addEventListener("mouseup", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.handle_mouse_up()
    })
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.handle_wheel(e)
      },
      { passive: false },
    )

    // Enable window dragging via header
    header.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.start_window_drag(e)
    })
    window.addEventListener("mousemove", (e) => this.on_window_drag(e))
    window.addEventListener("mouseup", () => {
      this.stop_window_drag()
      this.stop_window_resize()
    })
    window.addEventListener("pointerup", () => {
      this.stop_window_drag()
      this.stop_window_resize()
    })

    // Resizer handle
    const resizer = document.createElement("div")
    resizer.style.position = "absolute"
    resizer.style.width = "14px"
    resizer.style.height = "14px"
    resizer.style.right = "2px"
    resizer.style.bottom = "2px"
    resizer.style.cursor = "se-resize"
    resizer.style.background =
      "linear-gradient(135deg, transparent 50%, #666 50%)"
    this.container.appendChild(resizer)
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.start_window_resize(e)
    })
    window.addEventListener("mousemove", (e) => this.on_window_resize(e))
    window.addEventListener("mouseup", () => this.stop_window_resize())

    if (animator) {
      this.add_animator(name || `animator_${this.animators.size + 1}`, animator)
    }

    this.update_canvas_size()
    this.start_animation_loop()
  }

  public add_animator(name: string, animator: Animatrix): void {
    this.animators.set(name, animator)

    if (!this.current_animator_name) {
      this.set_animator(name)
    } else {
      this.update_animator_select()
    }
  }

  public remove_animator(name: string): void {
    if (this.current_animator_name === name) {
      this.set_animator(null)
    }
    this.animators.delete(name)
    this.update_animator_select()
  }

  public set_animator(name: string | null): void {
    // Clean up old listeners
    this.cleanup_animator_listeners()

    if (name === null) {
      this.animator = null
      this.current_animator_name = null
      this.node_positions.clear()
      this.auto_layout_complete = false
    } else {
      const animator = this.animators.get(name)
      if (animator) {
        this.animator = animator
        this.current_animator_name = name
        this.setup_animator_listeners()
        this.node_positions.clear()
        this.auto_layout_complete = false
        this.auto_layout_nodes()
        // Reset view so nodes appear centered by default
        this.viewScale = 1
        this.panX = 0
        this.panY = 0
      }
    }

    this.update_title()
    this.update_animator_select()
    this.render()
  }

  private setup_animator_listeners(): void {
    if (!this.animator) return

    const state_changed_listener = () => this.render()
    const transition_start_listener = () => this.render()
    const transition_end_listener = () => this.render()

    this.animator.add_listener(
      AnimationEvent.STATE_CHANGED,
      state_changed_listener,
    )
    this.animator.add_listener(
      AnimationEvent.TRANSITION_START,
      transition_start_listener,
    )
    this.animator.add_listener(
      AnimationEvent.TRANSITION_END,
      transition_end_listener,
    )

    this.event_listeners.set("state_changed", state_changed_listener)
    this.event_listeners.set("transition_start", transition_start_listener)
    this.event_listeners.set("transition_end", transition_end_listener)
  }

  private cleanup_animator_listeners(): void {
    if (!this.animator) return

    const state_changed_listener = this.event_listeners.get("state_changed")
    const transition_start_listener =
      this.event_listeners.get("transition_start")
    const transition_end_listener = this.event_listeners.get("transition_end")

    if (state_changed_listener) {
      this.animator.remove_listener(
        AnimationEvent.STATE_CHANGED,
        state_changed_listener,
      )
    }
    if (transition_start_listener) {
      this.animator.remove_listener(
        AnimationEvent.TRANSITION_START,
        transition_start_listener,
      )
    }
    if (transition_end_listener) {
      this.animator.remove_listener(
        AnimationEvent.TRANSITION_END,
        transition_end_listener,
      )
    }

    this.event_listeners.clear()
  }

  private update_animator_select(): void {
    const select = this.container.querySelector(
      "#animator-select",
    ) as HTMLSelectElement
    if (!select) return

    select.innerHTML = ""

    if (this.animators.size === 0) {
      select.style.display = "none"
      return
    }

    if (this.animators.size === 1) {
      select.style.display = "none"
    } else {
      select.style.display = "block"
    }

    this.animators.forEach((_, name) => {
      const option = document.createElement("option")
      option.value = name
      option.textContent = name
      option.selected = name === this.current_animator_name
      select.appendChild(option)
    })
  }

  private update_title(): void {
    const title = this.container.querySelector(
      "#visualizer-title",
    ) as HTMLElement
    if (!title) return

    if (this.current_animator_name) {
      title.textContent = `ANIMATION GRAPH - ${this.current_animator_name}`
    } else {
      title.textContent = "ANIMATION GRAPH - No Animator"
    }
  }

  private start_animation_loop(): void {
    const animate = () => {
      this.render()
      this.animation_frame_id = requestAnimationFrame(animate)
    }
    animate()
  }

  private auto_layout_nodes(): void {
    if (!this.animator) return
    const clips = this.animator.get_clips()
    const blendNodes = this.animator.get_blend_tree_ids()
    const transitions = this.animator.get_transitions()
    // States referenced explicitly in transitions should always be visible
    const referencedStates = new Set<string>()
    transitions.forEach((t) => {
      if (t.from !== "*") referencedStates.add(t.from)
      referencedStates.add(t.to)
    })

    // Collect all child clip ids of any blend tree
    const childClipIds = new Set<string>()
    blendNodes.forEach((id) => {
      const cfg = this.animator!.get_blend_tree_config(id)
      if (cfg) {
        cfg.children.forEach((ch) => childClipIds.add(ch.state_id))
      }
    })

    // Clips that are not exclusively internal children (or are referenced in transitions)
    const baseClipIds = Array.from(clips.keys()).filter(
      (id) => !childClipIds.has(id) || referencedStates.has(id),
    )
    // Final node ids = base clips + blend tree ids
    const nodeIds: string[] = [
      ...new Set<string>([...baseClipIds, ...blendNodes]),
    ]
    const num_nodes = nodeIds.length
    if (num_nodes === 0) return

    const center_x = this.canvas.width / 2
    const center_y = this.canvas.height / 2
    // Lay out nodes in a vertical column with generous spacing
    const verticalGap = 300 // more space by default
    const startY = center_y - ((num_nodes - 1) * verticalGap) / 2
    let index = 0
    for (const state_id of nodeIds) {
      const x = center_x
      const y = startY + index * verticalGap
      this.node_positions.set(state_id, { x, y })
      index++
    }

    this.auto_layout_complete = true
  }

  private dragging_node: string | null = null
  private drag_offset: NodePosition = { x: 0, y: 0 }

  private handle_mouse_down(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const x = (sx - this.panX) / this.viewScale
    const y = (sy - this.panY) / this.viewScale

    let hitNode: string | null = null
    let hitExpander: boolean = false
    this.node_positions.forEach((pos, state_id) => {
      const is_blend = this.animator?.is_blend_tree_state(state_id) || false
      const dims = this.get_node_dimensions(state_id, is_blend)
      const left = pos.x - dims.w / 2
      const top = pos.y - dims.h / 2
      const headerH = 24
      if (x >= left && x <= left + dims.w && y >= top && y <= top + dims.h) {
        hitNode = state_id
        // Only trigger expander if clicking specifically on the chevron area for blend nodes
        if (is_blend && y >= top && y <= top + headerH) {
          // Chevron is positioned at (left + 10, top + 6) and is about 12x12 pixels
          const chevronX = left + 10
          const chevronY = top + 6
          const chevronSize = 12
          if (
            x >= chevronX &&
            x <= chevronX + chevronSize &&
            y >= chevronY &&
            y <= chevronY + chevronSize
          ) {
            hitExpander = true
          }
        }
      }
    })

    if (hitNode) {
      if (hitExpander) {
        if (this.nodeDrawerOpen.has(hitNode))
          this.nodeDrawerOpen.delete(hitNode)
        else this.nodeDrawerOpen.add(hitNode)
        this.render()
        return
      }
      const pos = this.node_positions.get(hitNode)!
      this.dragging_node = hitNode
      this.drag_offset = { x: x - pos.x, y: y - pos.y }
    } else {
      this.isPanningView = true
      this.panStart = { x: sx - this.panX, y: sy - this.panY }
    }
  }

  private handle_mouse_move(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top

    if (this.isPanningView) {
      this.panX = sx - this.panStart.x
      this.panY = sy - this.panStart.y
      this.render()
      return
    }

    if (this.dragging_node) {
      const x = (sx - this.panX) / this.viewScale
      const y = (sy - this.panY) / this.viewScale

      const pos = this.node_positions.get(this.dragging_node)
      if (pos) {
        pos.x = x - this.drag_offset.x
        pos.y = y - this.drag_offset.y
        this.render()
      }
      return
    }

    // Check for chevron hover states
    const x = (sx - this.panX) / this.viewScale
    const y = (sy - this.panY) / this.viewScale
    let newHoveredChevron: string | null = null

    this.node_positions.forEach((pos, state_id) => {
      const is_blend = this.animator?.is_blend_tree_state(state_id) || false
      if (!is_blend) return

      const dims = this.get_node_dimensions(state_id, is_blend)
      const left = pos.x - dims.w / 2
      const top = pos.y - dims.h / 2
      const headerH = 24

      if (y >= top && y <= top + headerH) {
        const chevronX = left + 10
        const chevronY = top + 6
        const chevronSize = 12
        if (
          x >= chevronX &&
          x <= chevronX + chevronSize &&
          y >= chevronY &&
          y <= chevronY + chevronSize
        ) {
          newHoveredChevron = state_id
        }
      }
    })

    if (newHoveredChevron !== this.hoveredChevron) {
      this.hoveredChevron = newHoveredChevron
      this.canvas.style.cursor = newHoveredChevron ? "pointer" : "default"
      this.render()
    }
  }

  private handle_mouse_up(): void {
    this.dragging_node = null
    this.isPanningView = false
  }

  private handle_wheel(event: WheelEvent): void {
    event.preventDefault()
    const delta = -event.deltaY
    const zoomFactor = delta > 0 ? 1.1 : 0.9
    const rect = this.canvas.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top

    const prevScale = this.viewScale
    let nextScale = this.viewScale * zoomFactor
    nextScale = Math.max(0.5, Math.min(2.5, nextScale))

    this.panX = cx - (cx - this.panX) * (nextScale / prevScale)
    this.panY = cy - (cy - this.panY) * (nextScale / prevScale)
    this.viewScale = nextScale
    this.render()
  }

  private start_window_drag(event: MouseEvent): void {
    const rect = this.container.getBoundingClientRect()
    this.isDraggingWindow = true
    this.dragWindowOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    this.container.style.left = rect.left + "px"
    this.container.style.top = rect.top + "px"
    this.container.style.right = ""
    this.container.style.bottom = ""
    // Add a class cursor while dragging
    document.body.style.cursor = "grabbing"
  }

  private on_window_drag(event: MouseEvent): void {
    if (!this.isDraggingWindow) return
    const x = event.clientX - this.dragWindowOffset.x
    const y = event.clientY - this.dragWindowOffset.y
    this.container.style.left = x + "px"
    this.container.style.top = y + "px"
  }

  private stop_window_drag(): void {
    this.isDraggingWindow = false
    document.body.style.cursor = ""
  }

  private start_window_resize(event: MouseEvent): void {
    event.preventDefault()
    event.stopPropagation()
    const rect = this.container.getBoundingClientRect()
    this.isResizingWindow = true
    this.resizeStart = {
      x: event.clientX,
      y: event.clientY,
      w: rect.width,
      h: rect.height,
    }
    document.body.style.cursor = "nwse-resize"
  }

  private on_window_resize(event: MouseEvent): void {
    if (!this.isResizingWindow) return
    const dx = event.clientX - this.resizeStart.x
    const dy = event.clientY - this.resizeStart.y
    // Allow shrinking and growing with clamped min sizes
    const w = Math.max(360, this.resizeStart.w + dx)
    const h = Math.max(260, this.resizeStart.h + dy)
    this.container.style.width = w + "px"
    this.container.style.height = h + "px"
    this.update_canvas_size()
    this.render()
  }

  private stop_window_resize(): void {
    if (!this.isResizingWindow) return
    this.isResizingWindow = false
    document.body.style.cursor = ""
  }

  private toggle_minimize(): void {
    this.isMinimized = !this.isMinimized
    const content_area = this.container.children[1] as HTMLElement // content area is second child after header
    if (this.isMinimized) {
      content_area.style.display = "none"
      this.container.style.height = "auto"
    } else {
      content_area.style.display = "flex"
      this.update_canvas_size()
    }
  }

  private update_canvas_size(): void {
    const rect = this.container.getBoundingClientRect()
    const params = document.getElementById("params-panel") as HTMLElement | null
    const headerHeight = 40
    const paramsWidth =
      params && params.style.display !== "none"
        ? params.getBoundingClientRect().width || 180
        : 0
    const height = Math.max(120, rect.height - headerHeight)
    const width = Math.max(200, rect.width - paramsWidth)
    this.canvas.width = Math.floor(width)
    this.canvas.height = Math.floor(height)
  }

  private render(): void {
    if (!this.is_visible) return

    if (!this.auto_layout_complete) {
      this.auto_layout_nodes()
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.fillStyle = "#1E1E1E"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.ctx.save()
    this.ctx.translate(this.panX, this.panY)
    this.ctx.scale(this.viewScale, this.viewScale)
    this.draw_connections()
    this.draw_nodes()
    this.ctx.restore()
    this.draw_labels_screen_space()
    this.update_parameters_panel()
  }

  private draw_connections(): void {
    if (!this.animator) return
    const transitions = this.animator.get_transitions()
    const active_transition = this.animator.get_active_transition()

    transitions.forEach((transition) => {
      const from_pos =
        transition.from === "*"
          ? { x: 40, y: 40 }
          : this.node_positions.get(transition.from)
      const to_pos = this.node_positions.get(transition.to)

      if (from_pos && to_pos) {
        const is_active =
          active_transition &&
          (active_transition.from_state === transition.from ||
            transition.from === "*") &&
          active_transition.to_state === transition.to

        this.ctx.strokeStyle = is_active
          ? this.CONNECTION_COLOR_ACTIVE
          : this.CONNECTION_COLOR
        this.ctx.lineWidth = is_active ? 3 : 1
        this.ctx.setLineDash(transition.from === "*" ? [5, 5] : [])

        this.ctx.beginPath()

        if (transition.from === "*") {
          this.ctx.moveTo(from_pos.x, from_pos.y)
          this.ctx.lineTo(to_pos.x, to_pos.y)
        } else {
          const angle = Math.atan2(to_pos.y - from_pos.y, to_pos.x - from_pos.x)
          const start_x = from_pos.x + Math.cos(angle) * this.NODE_RADIUS
          const start_y = from_pos.y + Math.sin(angle) * this.NODE_RADIUS
          const end_x = to_pos.x - Math.cos(angle) * this.NODE_RADIUS
          const end_y = to_pos.y - Math.sin(angle) * this.NODE_RADIUS

          this.ctx.moveTo(start_x, start_y)
          this.ctx.lineTo(end_x, end_y)

          const arrow_length = 10
          const arrow_angle = Math.PI / 6
          this.ctx.lineTo(
            end_x - arrow_length * Math.cos(angle - arrow_angle),
            end_y - arrow_length * Math.sin(angle - arrow_angle),
          )
          this.ctx.moveTo(end_x, end_y)
          this.ctx.lineTo(
            end_x - arrow_length * Math.cos(angle + arrow_angle),
            end_y - arrow_length * Math.sin(angle + arrow_angle),
          )
        }

        this.ctx.stroke()
        this.ctx.setLineDash([])

        if (is_active && active_transition) {
          const progress = active_transition.progress
          const mid_x = from_pos.x + (to_pos.x - from_pos.x) * progress
          const mid_y = from_pos.y + (to_pos.y - from_pos.y) * progress

          this.ctx.fillStyle = this.CONNECTION_COLOR_ACTIVE
          this.ctx.beginPath()
          this.ctx.arc(mid_x, mid_y, 4, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }
    })

    // Simplify rendering: do not draw links to child clips; blend trees are summarized in their own node UI

    const any_state_pos = { x: 40, y: 40 }
    this.ctx.strokeStyle = "#666"
    this.ctx.strokeRect(any_state_pos.x - 15, any_state_pos.y - 10, 30, 20)

    this.ctx.fillStyle = "#666"
    this.ctx.font = "10px monospace"
    this.ctx.textAlign = "center"
    this.ctx.textBaseline = "middle"
    this.ctx.fillText("ANY", any_state_pos.x, any_state_pos.y)
  }

  private draw_nodes(): void {
    if (!this.animator) return
    const current_state = this.animator.get_current_state()
    const active_transition = this.animator.get_active_transition()
    const clips = this.animator.get_clips()
    // const blendIds = this.animator.get_blend_tree_ids();

    this.node_positions.forEach((pos, state_id) => {
      const is_current = current_state === state_id
      const is_transitioning_from = active_transition?.from_state === state_id
      const is_transitioning_to = active_transition?.to_state === state_id
      const clip = clips.get(state_id)
      const is_blend = this.animator!.is_blend_tree_state(state_id)

      let fill_color = is_blend
        ? this.NODE_COLOR_BLENDTREE
        : this.NODE_COLOR_IDLE
      if (is_current && !active_transition) {
        fill_color = this.NODE_COLOR_ACTIVE
      } else if (is_transitioning_from || is_transitioning_to) {
        fill_color = this.NODE_COLOR_TRANSITIONING
      }

      // LOD and dimensions
      const lod = this.getLOD()
      const dims = this.get_node_dimensions(state_id, is_blend)
      const nodeW = dims.w
      const nodeH = dims.h
      const nx = pos.x - nodeW / 2
      const ny = pos.y - nodeH / 2

      // Node background and header
      const headerH = lod <= 1 ? 28 : 24
      this.draw_rounded_rect(
        nx,
        ny,
        nodeW,
        nodeH,
        10,
        "#20252a",
        is_current ? "#FFF" : "#666",
        is_current ? 2 : 1,
      )
      this.ctx.fillStyle = fill_color
      this.ctx.fillRect(nx + 1, ny + 1, nodeW - 2, headerH)

      // Expander chevron for blend trees
      if (is_blend) {
        const open = this.nodeDrawerOpen.has(state_id)
        const is_hovered = this.hoveredChevron === state_id
        this.draw_chevron(nx + 10, ny + 6, open, is_hovered)
      }

      // Title text in header (screen-space for readability)
      const headerFont =
        lod === 0
          ? "bold 16px monospace"
          : lod === 1
            ? "bold 14px monospace"
            : "bold 12px monospace"
      this.queue_label(
        state_id.toUpperCase(),
        pos.x,
        ny + headerH / 2,
        "center",
        "middle",
        headerFont,
        this.TEXT_COLOR,
      )

      // If blend tree, draw its 1D line with thresholds and current value below the node
      if (is_blend) {
        const cfg = this.animator!.get_blend_tree_config(state_id)
        if (cfg) {
          if (lod <= 2) {
            const lineY = ny + headerH + (lod === 0 ? 28 : 20)
            const lineW = Math.min(160, nodeW - 20)
            const lineX = pos.x - lineW / 2
            this.ctx.strokeStyle = "#90A4AE"
            this.ctx.lineWidth = 2
            this.ctx.beginPath()
            this.ctx.moveTo(lineX, lineY)
            this.ctx.lineTo(lineX + lineW, lineY)
            this.ctx.stroke()

            // Draw thresholds as small ticks with compact labels
            const children = [...cfg.children].sort(
              (a, b) => a.threshold - b.threshold,
            )
            if (children.length > 0) {
              const minT = children[0].threshold
              const maxT = children[children.length - 1].threshold
              const range = Math.max(1e-5, maxT - minT)
              this.ctx.fillStyle = "#CFD8DC"
              this.ctx.strokeStyle = "#90A4AE"
              for (const ch of children) {
                const nx2 = lineX + ((ch.threshold - minT) / range) * lineW
                this.ctx.beginPath()
                this.ctx.moveTo(nx2, lineY - 4)
                this.ctx.lineTo(nx2, lineY + 4)
                this.ctx.stroke()
                if (lod <= 1) {
                  const label = `${Number.isFinite(ch.threshold) ? ch.threshold : ""}`
                  this.queue_label(
                    label,
                    nx2,
                    lineY + 6,
                    "center",
                    "top",
                    "11px monospace",
                    "#CFD8DC",
                  )
                }
              }

              // Current parameter marker
              const p = this.animator!.get_float(cfg.parameter)
              const px =
                lineX +
                ((Math.min(maxT, Math.max(minT, p)) - minT) / range) * lineW
              this.ctx.fillStyle = "#FFEE58"
              this.ctx.beginPath()
              this.ctx.arc(px, lineY, 3, 0, Math.PI * 2)
              this.ctx.fill()

              // Parameter name and value centered under the line
              if (lod <= 2) {
                const pf = lod === 0 ? "12px monospace" : "11px monospace"
                this.queue_label(
                  `${cfg.parameter}: ${p.toFixed(2)}`,
                  pos.x,
                  lineY + 12,
                  "center",
                  "top",
                  pf,
                  "#B0BEC5",
                )
              }

              // Drawer with child clip names (if open)
              if (this.nodeDrawerOpen.has(state_id) && lod <= 1) {
                const listX = nx + 10
                let listY = lineY + 26

                // Get blend weights for each child to show which are active
                const paramValue = this.animator!.get_float(cfg.parameter)

                for (const ch of children) {
                  // Calculate blend weight for this child based on parameter value
                  let weight = 0
                  const idx = children.indexOf(ch)
                  if (children.length === 1) {
                    weight = 1
                  } else if (idx === 0) {
                    // First child
                    const nextThreshold =
                      children[idx + 1]?.threshold ?? ch.threshold
                    weight =
                      paramValue <= ch.threshold
                        ? 1
                        : paramValue <= nextThreshold
                          ? (nextThreshold - paramValue) /
                            (nextThreshold - ch.threshold)
                          : 0
                  } else if (idx === children.length - 1) {
                    // Last child
                    const prevThreshold =
                      children[idx - 1]?.threshold ?? ch.threshold
                    weight =
                      paramValue >= ch.threshold
                        ? 1
                        : paramValue >= prevThreshold
                          ? (paramValue - prevThreshold) /
                            (ch.threshold - prevThreshold)
                          : 0
                  } else {
                    // Middle child - blend between neighbors
                    const prevThreshold =
                      children[idx - 1]?.threshold ?? ch.threshold
                    const nextThreshold =
                      children[idx + 1]?.threshold ?? ch.threshold
                    if (
                      paramValue >= prevThreshold &&
                      paramValue <= nextThreshold
                    ) {
                      if (paramValue <= ch.threshold) {
                        weight =
                          (paramValue - prevThreshold) /
                          (ch.threshold - prevThreshold)
                      } else {
                        weight =
                          (nextThreshold - paramValue) /
                          (nextThreshold - ch.threshold)
                      }
                    }
                  }
                  weight = Math.max(0, Math.min(1, weight))

                  // Visual indicators based on weight
                  let bullet = "•"
                  let color = "#B0BEC5"
                  let bgColor = null

                  if (weight > 0.8) {
                    bullet = "●" // solid circle for primary
                    color = "#4CAF50" // green for active
                    bgColor = "rgba(76, 175, 80, 0.1)"
                  } else if (weight > 0.3) {
                    bullet = "◐" // half circle for blending
                    color = "#FFA726" // orange for blending
                    bgColor = "rgba(255, 167, 38, 0.1)"
                  } else if (weight > 0.05) {
                    bullet = "○" // hollow circle for minimal contribution
                    color = "#90A4AE" // grey for minimal
                  }

                  // Draw background highlight for active clips
                  if (bgColor) {
                    this.ctx.fillStyle = bgColor
                    this.ctx.fillRect(listX - 4, listY - 2, 200, 14)
                  }

                  const weightText =
                    weight > 0.01 ? ` (${(weight * 100).toFixed(0)}%)` : ""
                  this.queue_label(
                    `${bullet} ${ch.state_id}${weightText}  @ ${ch.threshold}`,
                    listX,
                    listY,
                    "left",
                    "top",
                    "12px monospace",
                    color,
                  )
                  listY += 16
                }
              }
            }
          }
        }
      }

      if (
        (is_current || is_transitioning_from || is_transitioning_to) &&
        this.animator
      ) {
        const playback_progress = this.animator.get_clip_progress(state_id)
        const weight = is_transitioning_from
          ? 1 - active_transition!.progress
          : is_transitioning_to
            ? active_transition!.progress
            : is_current
              ? 1.0
              : 0
        if (lod <= 1) {
          const barY = ny + nodeH + 12
          this.draw_playback_indicator(
            pos.x,
            barY,
            playback_progress,
            weight,
            clip?.loop || false,
          )
        }
      }
    })
  }

  private get_node_dimensions(
    state_id: string,
    is_blend: boolean,
  ): { w: number; h: number } {
    const lod = this.getLOD()
    const baseW = lod === 0 ? 240 : lod === 1 ? 220 : 200
    const baseH = is_blend ? (lod === 0 ? 130 : 110) : lod === 0 ? 80 : 70
    if (!is_blend) return { w: baseW, h: baseH }
    const open = this.nodeDrawerOpen.has(state_id)
    if (!open || lod > 1) return { w: baseW, h: baseH }
    // Add height to list all children lines
    const cfg = this.animator?.get_blend_tree_config(state_id)
    const extra = cfg ? cfg.children.length * 16 + 10 : 0
    return { w: baseW, h: baseH + extra }
  }

  private queue_label(
    text: string,
    x: number,
    y: number,
    align: CanvasTextAlign,
    baseline: CanvasTextBaseline,
    font: string,
    color: string,
  ): void {
    // Transform world coords to screen space based on current pan/zoom
    const sx = x * this.viewScale + this.panX
    const sy = y * this.viewScale + this.panY
    this.pendingLabels.push({
      text,
      x: sx,
      y: sy,
      align,
      baseline,
      font,
      color,
    })
  }

  private draw_labels_screen_space(): void {
    if (this.pendingLabels.length === 0) return
    for (const lbl of this.pendingLabels) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ctx.fillStyle = lbl.color
      this.ctx.font = lbl.font
      this.ctx.textAlign = lbl.align
      this.ctx.textBaseline = lbl.baseline
      this.ctx.fillText(lbl.text, lbl.x, lbl.y)
    }
    this.pendingLabels.length = 0
  }

  private draw_chevron(
    x: number,
    y: number,
    open: boolean,
    hovered: boolean = false,
  ): void {
    const ctx = this.ctx

    // Draw hover background
    if (hovered) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
      ctx.fillRect(x - 2, y - 2, 16, 16)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
      ctx.lineWidth = 1
      ctx.strokeRect(x - 2, y - 2, 16, 16)
    }

    ctx.fillStyle = hovered ? "#FFD700" : "#FFF" // Gold when hovered, white otherwise
    ctx.beginPath()
    if (open) {
      // down arrow
      ctx.moveTo(x, y)
      ctx.lineTo(x + 12, y)
      ctx.lineTo(x + 6, y + 8)
    } else {
      // right arrow
      ctx.moveTo(x, y)
      ctx.lineTo(x + 8, y + 6)
      ctx.lineTo(x, y + 12)
    }
    ctx.closePath()
    ctx.fill()
  }

  private draw_rounded_rect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke: string,
    lineWidth: number,
  ): void {
    const ctx = this.ctx
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  private draw_playback_indicator(
    x: number,
    y: number,
    progress: number,
    weight: number,
    is_looping: boolean,
  ): void {
    const bar_width = 60
    const bar_height = 8
    const bar_x = x - bar_width / 2

    this.ctx.fillStyle = "rgba(30, 30, 30, 0.8)"
    this.ctx.fillRect(bar_x, y, bar_width, bar_height)

    const progress_color = is_looping ? "#2196F3" : "#4CAF50"
    this.ctx.fillStyle = progress_color
    this.ctx.fillRect(bar_x, y, bar_width * progress, bar_height)

    if (weight < 1.0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.3 * (1 - weight)})`
      this.ctx.fillRect(bar_x, y, bar_width, bar_height)
    }

    this.ctx.strokeStyle = weight > 0 ? "#AAA" : "#444"
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(bar_x, y, bar_width, bar_height)
    const playhead_x = bar_x + bar_width * progress
    this.ctx.strokeStyle = "#FFF"
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(playhead_x, y - 2)
    this.ctx.lineTo(playhead_x, y + bar_height + 2)
    this.ctx.stroke()
  }

  private update_parameters_panel(): void {
    const panel = document.getElementById("params-panel")
    if (!panel) return

    if (!this.animator) {
      panel.innerHTML =
        '<div style="color: #666; text-align: center; padding: 20px;">No animator selected</div>'
      return
    }

    const params = this.animator.get_parameters_map()
    let html =
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">'

    params.forEach((param, name) => {
      let value_display = param.value
      let color = "#AAA"

      if (param.type === ParameterType.BOOL) {
        value_display = param.value ? "✓" : "✗"
        color = param.value ? "#4CAF50" : "#F44336"
      } else if (param.type === ParameterType.TRIGGER) {
        value_display = param.value ? "●" : "○"
        color = param.value ? "#FFA726" : "#666"
      } else if (param.type === ParameterType.FLOAT) {
        value_display = param.value.toFixed(2)
      }

      html += `<div style="color: #888;">${name}:</div>`
      html += `<div style="color: ${color}; font-weight: bold;">${value_display}</div>`
    })

    html += "</div>"
    panel.innerHTML = html
  }

  public toggle_visibility(): void {
    this.is_visible = !this.is_visible
    this.container.style.display = this.is_visible ? "block" : "none"
  }

  public show(): void {
    this.is_visible = true
    this.container.style.display = "block"
    this.render()
  }

  public hide(): void {
    this.is_visible = false
    this.container.style.display = "none"
  }

  public destroy(): void {
    if (this.animation_frame_id !== null) {
      cancelAnimationFrame(this.animation_frame_id)
    }
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
