import * as THREE from "three"
import { Component, VenusGame } from "@engine/core"
import { PrefabComponent } from "../prefabs/PrefabComponent"
import type { ComponentJSON, PrefabNode } from "../prefabs"
import { StowKitSystem } from "../stowkit/StowKitSystem"
import { createParticleEmitter } from "./index"
import type { EmitterConfig, EmitterAssets, ParticleSystem } from "./index"

// ============================================================================
// Prefab JSON Type Definitions
// ============================================================================

interface CurvePropertyValue {
    mode: "constant" | "curve"
    constant?: number
    curve?: { keys: { time: number; value: number; inTangent: number; outTangent: number }[] }
}

interface ParticleSystemJSON extends ComponentJSON {
    type: "particle_system"
    main: {
        duration: number
        looping: boolean
        startLifetimeMin: number
        startLifetimeMax: number
        startSpeedMin: number
        startSpeedMax: number
        startSizeMin: number
        startSizeMax: number
        gravityModifier: number
        maxParticles: number
        startColor: number[]
        useRandomStartColors?: boolean
        randomStartColors?: number[][]
        colorOverLifetime: boolean
        endColor: number[]
        useMidColor?: boolean
        midColor?: number[]
        opacityOverLifetime?: CurvePropertyValue
    }
    emission: {
        enabled: boolean
        mode: "constant" | "burst"
        rateOverTime: number
        burstCount?: number
        burstCycles?: number
        burstInterval?: number
    }
    shape: {
        enabled: boolean
        shape: "cone" | "sphere" | "box" | "point"
        radius: number
        coneAngleMin?: number
        coneAngleMax?: number
        coneDirection?: number[]
        boxSize?: number[]
        sphereRadius?: number
    }
    velocity: {
        enabled: boolean
        gravity: number[]
        damping?: number
        speedOverLifetime?: CurvePropertyValue
        orbitalX?: number
        orbitalY?: number
        orbitalZ?: number
    }
    size: {
        value?: {
            enabled?: boolean
            endSizeMin?: number
            endSizeMax?: number
        }
        enabled?: boolean
        endSizeMin: number
        endSizeMax: number
        sizeOverLifetime?: CurvePropertyValue
    }
    rotation: {
        enabled: boolean
        startAngleMin: number
        startAngleMax: number
        angularVelocityMin: number
        angularVelocityMax: number
        rotationOverLifetime?: CurvePropertyValue
    }
    noise?: {
        enabled: boolean
        positionAmount?: number
        rotationAmount?: number
        sizeAmount?: number
        frequency?: number
        scrollSpeed?: number
        octaves?: number
    }
    textureSheet: {
        enabled: boolean
        timeMode?: "fps" | "startLifetime"
        rows: number
        columns: number
        fps: number
        loop: boolean
        randomStartFrame?: boolean
    }
    collision: {
        enabled: boolean
        planeY?: number
        restitution?: number
        friction?: number
        killAfterBounces?: number
    }
    renderer: {
        texture: {
            pack: string
            assetId: string
        }
        renderMode?: "billboard" | "quad"
        blending: "additive" | "normal"
        premultipliedAlpha: boolean
        maskFromLuminance: boolean
        velocityScale: number
        stretchWithVelocity: boolean
        alignToVelocity: boolean
        flipX?: number
        flipY?: number
    }
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Unwrap SerializedProperty values from a module
 */
function unwrapModule(module: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const key in module) {
        const value = module[key]
        result[key] = value?.value ?? value
    }
    return result
}

function degToRad(degrees: number): number {
    return degrees * (Math.PI / 180)
}

function isEnabled(val: any, defaultEnabled: boolean = true): boolean {
    if (val === true) return true
    if (val === false) return false
    return defaultEnabled
}

function getBlendingMode(mode: string): THREE.Blending {
    switch (mode) {
        case 'additive':
            return THREE.AdditiveBlending
        case 'multiply':
            return THREE.MultiplyBlending
        case 'normal':
        default:
            return THREE.NormalBlending
    }
}

/**
 * Deeply unwrap SerializedProperty values from a nested object
 */
function deepUnwrap(value: any): any {
    // Unwrap SerializedProperty (object with only a 'value' property)
    if (value && typeof value === 'object' && 'value' in value && Object.keys(value).length === 1) {
        return deepUnwrap(value.value)
    }

    if (Array.isArray(value)) {
        return value.map(item => deepUnwrap(item))
    }

    if (value !== null && typeof value === 'object') {
        const result: Record<string, any> = {}
        for (const key in value) {
            result[key] = deepUnwrap(value[key])
        }
        return result
    }

    return value
}

/**
 * Convert editor CurvePropertyValue to engine CurveableValue format
 */
function convertCurvePropertyToEngine(
    propValue: any,
    defaultValue: number = 1
): number | { curve: { keys: any[] } } | undefined {
    if (!propValue) return undefined

    // Deeply unwrap all SerializedProperty wrappers
    const value = deepUnwrap(propValue)

    if (!value || typeof value !== 'object') return undefined

    // Check if it's a CurvePropertyValue
    if (value.mode === 'constant') {
        const constantVal = value.constant ?? defaultValue
        // Only return if different from default to avoid unnecessary curve evaluation
        if (constantVal !== defaultValue) {
            return constantVal
        }
        return undefined
    }

    // Handle curve mode
    if (value.mode === 'curve' && value.curve && Array.isArray(value.curve.keys)) {
        return { curve: value.curve }
    }

    return undefined
}

// ============================================================================
// ParticleSystemPrefabComponent
// ============================================================================

/**
 * Prefab component for particle systems.
 * Directly creates particle emitter like the editor does.
 */
@PrefabComponent("particle_system")
export class ParticleSystemPrefabComponent extends Component {
    private emitter: ParticleSystem | null = null
    private json: ParticleSystemJSON

    /**
     * Create a ParticleSystemPrefabComponent from prefab JSON
     */
    static fromPrefabJSON(json: ParticleSystemJSON, _node: PrefabNode): ParticleSystemPrefabComponent | null {
        return new ParticleSystemPrefabComponent(json)
    }

    constructor(json: ParticleSystemJSON) {
        super()
        this.json = json
    }

    protected onCreate(): void {
        // Build config exactly like the editor does
        const config = this.buildEmitterConfig()
        const assets = this.buildEmitterAssets()

        // Create the particle emitter directly (like editor does)
        this.emitter = createParticleEmitter(config, assets)

        // Add to the object (like editor does)
        if (this.emitter?.object && this.gameObject) {
            this.gameObject.add(this.emitter.object)
            this.emitter.object.position.set(0, 0, 0)
            this.emitter.object.frustumCulled = false
            // Store emitter reference in userData for cascade functionality
            // This allows parent particle systems to find and control child emitters
            this.gameObject.userData.__particleEmitter = this.emitter
        }

        // Load texture asynchronously and update material (like editor does)
        this.loadTextureAsync()
    }

    /**
     * Load texture on-demand and update the emitter's material
     * This matches how the editor loads textures asynchronously
     */
    private async loadTextureAsync(): Promise<void> {
        const textureRef = this.json.renderer?.texture
        if (!textureRef?.pack || !textureRef?.assetId) return
        if (!this.emitter) return

        const stowkit = StowKitSystem.getInstance()
        // Load VFX texture
        const tex = await stowkit.getTexture(textureRef.assetId)

        // Configure for particle shaders
        tex.colorSpace = THREE.NoColorSpace
        tex.flipY = false
        tex.needsUpdate = true

        if (this.emitter) {
            // Update the emitter's material texture (like editor does)
            const material = this.emitter.object.material as THREE.ShaderMaterial
            if (material?.uniforms?.map) {
                material.uniforms.map.value = tex
                material.needsUpdate = true
            }
        }
    }

    /**
     * Build EmitterConfig from prefab JSON - matches editor's buildEmitterConfigFromComponentData
     */
    private buildEmitterConfig(): EmitterConfig {
        // Use unwrapModule exactly like the editor does
        const main = unwrapModule(this.json.main || {})
        const emission = unwrapModule(this.json.emission || {})
        const shape = unwrapModule(this.json.shape || {})
        const velocity = unwrapModule(this.json.velocity || {})
        const size = unwrapModule(this.json.size || {})
        const rotation = unwrapModule(this.json.rotation || {})
        const noise = unwrapModule(this.json.noise || {})
        const textureSheet = unwrapModule(this.json.textureSheet || {})
        const collision = unwrapModule(this.json.collision || {})
        const renderer = unwrapModule(this.json.renderer || {})

        // Apply gravity modifier to base gravity (like editor)
        const gravityModifier = main.gravityModifier ?? 1.0
        const baseGravity = velocity.gravity || [0, -9.8, 0]

        // Build emission config based on mode (like editor)
        const emissionEnabled = isEnabled(emission.enabled)
        const isBurst = emission.mode === 'burst'

        const config = {
            maxParticles: main.maxParticles ?? 300,

            // Playback control
            duration: main.duration ?? 5,
            looping: main.looping ?? true,
            playOnAwake: false,

            // Emission (like editor)
            emission: emissionEnabled ? {
                mode: isBurst ? 'burst' : 'constant',
                rateOverTime: emission.rateOverTime ?? 50,
                bursts: isBurst ? [{
                    time: 0,
                    count: emission.burstCount ?? 30,
                    cycles: emission.burstCycles ?? 1,
                    interval: emission.burstInterval ?? 0.5,
                }] : undefined,
            } : { mode: 'constant', rateOverTime: 0 },

            // Lifetime from main module
            lifetime: [main.startLifetimeMin ?? 1.5, main.startLifetimeMax ?? 3.0],

            // Speed from main module
            speed: [main.startSpeedMin ?? 1.0, main.startSpeedMax ?? 3.0],

            // Shape (like editor)
            shape: isEnabled(shape.enabled) ? (shape.shape ?? 'cone') : 'point',
            radius: shape.radius ?? 0.25,
            coneAngle: [degToRad(shape.coneAngleMin ?? 15), degToRad(shape.coneAngleMax ?? 30)],
            coneDirection: new THREE.Vector3(
                shape.coneDirection?.[0] ?? 0,
                shape.coneDirection?.[1] ?? 1,
                shape.coneDirection?.[2] ?? 0
            ),
            boxSize: new THREE.Vector3(
                shape.boxSize?.[0] ?? 1,
                shape.boxSize?.[1] ?? 1,
                shape.boxSize?.[2] ?? 1
            ),
            sphereRadius: shape.sphereRadius ?? 1,

            // Velocity - apply gravity modifier (like editor)
            gravity: isEnabled(velocity.enabled)
                ? new THREE.Vector3(
                    (baseGravity[0] ?? 0) * gravityModifier,
                    (baseGravity[1] ?? -9.8) * gravityModifier,
                    (baseGravity[2] ?? 0) * gravityModifier
                )
                : new THREE.Vector3(0, 0, 0),

            // Damping
            damping: isEnabled(velocity.enabled) ? (velocity.damping ?? 0) : 0,

            // Size - start from main, end from size module (like editor)
            size: isEnabled(size.enabled)
                ? {
                    start: [main.startSizeMin ?? 0.8, main.startSizeMax ?? 1.2],
                    end: [size.endSizeMin ?? 0.2, size.endSizeMax ?? 0.5],
                }
                : {
                    start: [main.startSizeMin ?? 1, main.startSizeMax ?? 1],
                    end: [main.startSizeMin ?? 1, main.startSizeMax ?? 1]
                },

            // Rotation (disabled by default, like editor)
            rotation: isEnabled(rotation.enabled, false)
                ? {
                    angle: [degToRad(rotation.startAngleMin ?? 0), degToRad(rotation.startAngleMax ?? 360)],
                    velocity: [degToRad(rotation.angularVelocityMin ?? -180), degToRad(rotation.angularVelocityMax ?? 180)],
                }
                : undefined,

            // Noise (disabled by default, like editor)
            noise: isEnabled(noise.enabled, false)
                ? {
                    enabled: true,
                    positionAmount: noise.positionAmount ?? 0,
                    rotationAmount: degToRad(noise.rotationAmount ?? 0),
                    sizeAmount: noise.sizeAmount ?? 0,
                    frequency: noise.frequency ?? 1,
                    scrollSpeed: noise.scrollSpeed ?? 0,
                    octaves: Math.round(noise.octaves ?? 1),
                }
                : undefined,

            // Color (like editor)
            color: {
                start: new THREE.Vector4(
                    main.startColor?.[0] ?? 1,
                    main.startColor?.[1] ?? 1,
                    main.startColor?.[2] ?? 1,
                    main.startColor?.[3] ?? 1
                ),
                // Random start colors list - convert array of [r,g,b,a] to Vector4 array
                startList: isEnabled(main.useRandomStartColors, false) && Array.isArray(main.randomStartColors) && main.randomStartColors.length > 0
                    ? main.randomStartColors.map((c: [number, number, number, number]) =>
                        new THREE.Vector4(c[0] ?? 1, c[1] ?? 1, c[2] ?? 1, c[3] ?? 1)
                    )
                    : undefined,
                // When colorOverLifetime is disabled, use start color as end (no fade)
                // This ensures random start colors stay constant throughout particle lifetime
                useStartAsEnd: !isEnabled(main.colorOverLifetime, false),
                mid: isEnabled(main.colorOverLifetime, false) && isEnabled(main.useMidColor, false)
                    ? new THREE.Vector4(
                        main.midColor?.[0] ?? 0.8,
                        main.midColor?.[1] ?? 0.8,
                        main.midColor?.[2] ?? 0.8,
                        main.midColor?.[3] ?? 0.7
                    )
                    : undefined,
                end: isEnabled(main.colorOverLifetime, false)
                    ? new THREE.Vector4(
                        main.endColor?.[0] ?? 0.5,
                        main.endColor?.[1] ?? 0.5,
                        main.endColor?.[2] ?? 0.5,
                        main.endColor?.[3] ?? 0
                    )
                    : new THREE.Vector4(
                        main.startColor?.[0] ?? 1,
                        main.startColor?.[1] ?? 1,
                        main.startColor?.[2] ?? 1,
                        main.startColor?.[3] ?? 1
                    ),
            },

            // Renderer (like editor)
            renderMode: (renderer.renderMode ?? 'billboard') as 'billboard' | 'quad',
            blending: getBlendingMode(renderer.blending ?? 'additive'),
            premultipliedAlpha: renderer.premultipliedAlpha ?? false,
            maskFromLuminance: renderer.maskFromLuminance ?? false,
            flip: {
                x: renderer.flipX ?? 0,
                y: renderer.flipY ?? 0,
            },

            // Texture Sheet Animation (disabled by default, like editor)
            spriteSheet: isEnabled(textureSheet.enabled, false)
                ? {
                    rows: Math.round(textureSheet.rows ?? 4),
                    columns: Math.round(textureSheet.columns ?? 4),
                    timeMode: (textureSheet.timeMode ?? 'fps') as 'fps' | 'startLifetime',
                    fps: textureSheet.fps ?? 15,
                    loop: textureSheet.loop ?? true,
                    randomStartFrame: textureSheet.randomStartFrame ?? false,
                }
                : undefined,

            // Collision (disabled by default, like editor)
            collision: {
                enabled: isEnabled(collision.enabled, false),
                planeY: collision.planeY ?? 0,
                restitution: collision.restitution ?? 0.7,
                friction: collision.friction ?? 0.5,
                killAfterBounces: Math.round(collision.killAfterBounces ?? 2),
            },

            // Alignment (like editor)
            alignment: {
                velocityScale: renderer.velocityScale ?? 0.4,
                enableVelocityStretch: renderer.stretchWithVelocity ?? false,
                enableVelocityAlignment: renderer.alignToVelocity ?? false,
            },

            // Curve over lifetime properties (like editor)
            sizeOverLifetime: convertCurvePropertyToEngine(size.sizeOverLifetime, 1),
            speedOverLifetime: convertCurvePropertyToEngine(velocity.speedOverLifetime, 1),
            opacityOverLifetime: convertCurvePropertyToEngine(main.opacityOverLifetime, 1),
            rotationOverLifetime: convertCurvePropertyToEngine(rotation.rotationOverLifetime, 1),

            // Orbital velocity - rotation around axes (radians/sec)
            orbital: isEnabled(velocity.enabled) && (velocity.orbitalX || velocity.orbitalY || velocity.orbitalZ)
                ? {
                    x: velocity.orbitalX ?? 0,
                    y: velocity.orbitalY ?? 0,
                    z: velocity.orbitalZ ?? 0,
                }
                : undefined,
        } as EmitterConfig

        return config
    }

    /**
     * Build EmitterAssets from prefab JSON
     * Starts with procedural texture - actual texture is loaded asynchronously in loadTextureAsync()
     */
    private buildEmitterAssets(): EmitterAssets {
        // Create procedural fallback texture (like editor does)
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)')
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, size, size)
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true

        return { texture }
    }

    /**
     * Trigger a burst of particles
     */
    public trigger(count: number = 10): void {
        if (!this.emitter) return
        const localOrigin = new THREE.Vector3(0, 0, 0)
        this.emitter.setOrigin(localOrigin)
        this.emitter.burst(localOrigin, count)
    }

    /**
     * Play the particle system
     */
    public play(): void {
        (this.emitter as any)?.play?.()
    }

    /**
     * Stop the particle system
     */
    public stop(): void {
        (this.emitter as any)?.stop?.()
    }

    /**
     * Update the particle system
     */
    public update(deltaTime: number): void {
        if (!this.emitter) return
        this.emitter.update(deltaTime, VenusGame.camera, this.gameObject?.matrixWorld)
    }

    /**
     * Get the underlying particle system
     */
    public getEmitter(): ParticleSystem | null {
        return this.emitter
    }

    protected onCleanup(): void {
        if (this.emitter?.object && this.gameObject) {
            this.gameObject.remove(this.emitter.object)
            // Clean up the userData reference
            delete this.gameObject.userData.__particleEmitter
        }
        this.emitter = null
    }
}
