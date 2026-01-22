import * as THREE from "three"

// Re-export the ParticleEmitterComponent
export { Particle } from "./Particle"

// Import curve types and evaluation functions
export type { CurveKeyframe, AnimationCurve, CurveableValue } from "./curve"
export {
  evaluateCurve,
  evaluateCurveableValue,
  createKeyframe,
  createCurveFromPoints,
  CurvePresets,
  cloneCurve,
  addKeyframe,
  removeKeyframe,
  updateKeyframe,
} from "./curve"
import type { CurveableValue } from "./curve"
import { evaluateCurveableValue } from "./curve"

export type ParticleSystem = {
  object: THREE.InstancedMesh
  update: (dt: number, camera: THREE.Camera, emitterWorldMatrix?: THREE.Matrix4) => void
  burst: (origin: THREE.Vector3, count?: number) => void
  setSpawnRate: (rate: number) => void
  setOrigin: (origin: THREE.Vector3) => void
  config: EmitterConfig
  setTexture?: (texture: THREE.Texture) => void
  // Playback controls
  play: () => void
  stop: () => void
  restart: () => void
  isPlaying: () => boolean
  getElapsed: () => number
  // Internal methods (no cascade) - used by parent cascade
  playInternal?: () => void
  stopInternal?: () => void
  restartInternal?: () => void
}

export type NumRange = number | readonly [number, number]
type Vec3Range = THREE.Vector3 | { min: THREE.Vector3; max: THREE.Vector3 }
type Vec4Range = THREE.Vector4 | { min: THREE.Vector4; max: THREE.Vector4 }

function randRange(r: NumRange): number {
  if (Array.isArray(r)) return r[0] + Math.random() * (r[1] - r[0])
  return r as number
}
function randVec3(r: Vec3Range, out: THREE.Vector3): THREE.Vector3 {
  if (r instanceof THREE.Vector3) {
    out.copy(r)
    return out
  }
  const { min, max } = r
  out.set(
    min.x + Math.random() * (max.x - min.x),
    min.y + Math.random() * (max.y - min.y),
    min.z + Math.random() * (max.z - min.z),
  )
  return out
}
function randVec4(r: Vec4Range, out: THREE.Vector4): THREE.Vector4 {
  if (r instanceof THREE.Vector4) {
    out.copy(r)
    return out
  }
  const { min, max } = r
  out.set(
    min.x + Math.random() * (max.x - min.x),
    min.y + Math.random() * (max.y - min.y),
    min.z + Math.random() * (max.z - min.z),
    min.w + Math.random() * (max.w - min.w),
  )
  return out
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function lerpVec4(
  a: THREE.Vector4,
  b: THREE.Vector4,
  t: number,
  out: THREE.Vector4,
): THREE.Vector4 {
  out.set(
    lerp(a.x, b.x, t),
    lerp(a.y, b.y, t),
    lerp(a.z, b.z, t),
    lerp(a.w, b.w, t),
  )
  return out
}

export function range(min: number, max: number): readonly [number, number] {
  return [min, max] as const
}

// ============================================================================
// Simplex Noise Implementation (2D/3D)
// Based on Stefan Gustavson's implementation, optimized for particles
// ============================================================================

// Permutation table (doubled for wrapping)
const perm = new Uint8Array(512)
const permMod12 = new Uint8Array(512)

// Initialize permutation tables with a fixed seed for deterministic results
;(function initNoise() {
  const p = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
    8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
    35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
    134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
    55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
    18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
    250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
    189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
    172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
    228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
    107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
  ]
  for (let i = 0; i < 256; i++) {
    perm[i] = perm[i + 256] = p[i]
    permMod12[i] = permMod12[i + 256] = p[i] % 12
  }
})()

// Gradient vectors for 3D
const grad3 = [
  [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
  [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
  [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1]
]

// Skewing factors for 2D and 3D
const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const F3 = 1 / 3
const G3 = 1 / 6

/**
 * 2D Simplex noise - returns value in range [-1, 1]
 */
function simplex2D(x: number, y: number): number {
  // Skew input to determine which simplex cell we're in
  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)

  // Unskew back to (x,y) space
  const t = (i + j) * G2
  const X0 = i - t
  const Y0 = j - t
  const x0 = x - X0
  const y0 = y - Y0

  // Determine which simplex we're in
  let i1: number, j1: number
  if (x0 > y0) { i1 = 1; j1 = 0 }
  else { i1 = 0; j1 = 1 }

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  // Hash coordinates of the three corners
  const ii = i & 255
  const jj = j & 255
  const gi0 = permMod12[ii + perm[jj]]
  const gi1 = permMod12[ii + i1 + perm[jj + j1]]
  const gi2 = permMod12[ii + 1 + perm[jj + 1]]

  // Calculate contribution from three corners
  let n0 = 0, n1 = 0, n2 = 0

  let t0 = 0.5 - x0*x0 - y0*y0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0)
  }

  let t1 = 0.5 - x1*x1 - y1*y1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1)
  }

  let t2 = 0.5 - x2*x2 - y2*y2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2)
  }

  // Scale to [-1, 1]
  return 70 * (n0 + n1 + n2)
}

/**
 * 3D Simplex noise - returns value in range [-1, 1]
 */
function simplex3D(x: number, y: number, z: number): number {
  // Skew input space
  const s = (x + y + z) * F3
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)
  const k = Math.floor(z + s)

  // Unskew back
  const t = (i + j + k) * G3
  const X0 = i - t
  const Y0 = j - t
  const Z0 = k - t
  const x0 = x - X0
  const y0 = y - Y0
  const z0 = z - Z0

  // Determine which simplex we're in
  let i1: number, j1: number, k1: number
  let i2: number, j2: number, k2: number

  if (x0 >= y0) {
    if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0 }
    else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1 }
    else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1 }
  } else {
    if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1 }
    else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1 }
    else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0 }
  }

  const x1 = x0 - i1 + G3
  const y1 = y0 - j1 + G3
  const z1 = z0 - k1 + G3
  const x2 = x0 - i2 + 2*G3
  const y2 = y0 - j2 + 2*G3
  const z2 = z0 - k2 + 2*G3
  const x3 = x0 - 1 + 3*G3
  const y3 = y0 - 1 + 3*G3
  const z3 = z0 - 1 + 3*G3

  // Hash coordinates
  const ii = i & 255
  const jj = j & 255
  const kk = k & 255
  const gi0 = permMod12[ii + perm[jj + perm[kk]]]
  const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]
  const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]
  const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]

  // Calculate contributions
  let n0 = 0, n1 = 0, n2 = 0, n3 = 0

  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0 + grad3[gi0][2]*z0)
  }

  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1 + grad3[gi1][2]*z1)
  }

  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2 + grad3[gi2][2]*z2)
  }

  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3
  if (t3 >= 0) {
    t3 *= t3
    n3 = t3 * t3 * (grad3[gi3][0]*x3 + grad3[gi3][1]*y3 + grad3[gi3][2]*z3)
  }

  return 32 * (n0 + n1 + n2 + n3)
}

/**
 * Fractal Brownian Motion (FBM) - layered noise with octaves
 * Returns value roughly in range [-1, 1]
 */
function fbm2D(x: number, y: number, octaves: number): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplex2D(x * frequency, y * frequency)
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / maxValue
}

function fbm3D(x: number, y: number, z: number, octaves: number): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplex3D(x * frequency, y * frequency, z * frequency)
    maxValue += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / maxValue
}

export const EmitterShape = {
  CONE: "cone",
  SPHERE: "sphere",
  BOX: "box",
  POINT: "point",
} as const
export type EmitterShapeKey = (typeof EmitterShape)[keyof typeof EmitterShape]

export type BurstConfig = {
  time: number              // When to burst (seconds from start)
  count: number             // How many particles to spawn
  cycles?: number           // How many times to repeat (1 = once, default)
  interval?: number         // Time between cycles
}

export type EmissionConfig = {
  mode: 'constant' | 'burst'
  rateOverTime?: number     // For constant mode (particles per second)
  bursts?: BurstConfig[]    // For burst mode
}

export type NoiseConfig = {
  enabled?: boolean
  // What to affect
  positionAmount?: number     // How much noise affects position (world units)
  rotationAmount?: number     // How much noise affects rotation (radians)
  sizeAmount?: number         // How much noise affects size (multiplier, 0-1 range typically)
  // Noise parameters
  frequency?: number          // How fast the noise changes spatially (default 1)
  scrollSpeed?: number        // How fast noise scrolls over time (default 0)
  octaves?: number            // Number of noise layers for detail (1-4, default 1)
  strengthX?: number          // Noise strength multiplier for X axis (default 1)
  strengthY?: number          // Noise strength multiplier for Y axis (default 1)
}

export type FlipConfig = {
  x?: number                  // Probability (0-1) of flipping particle horizontally
  y?: number                  // Probability (0-1) of flipping particle vertically
}

export type RenderMode = 'billboard' | 'quad'

export type EmitterConfig = {
  maxParticles?: number

  // Playback control
  duration?: number         // System duration in seconds (0 = infinite)
  looping?: boolean         // Restart after duration ends
  playOnAwake?: boolean     // Start playing immediately on creation

  // Emission
  emission?: EmissionConfig

  // Shape
  shape?: EmitterShapeKey
  coneAngle?: NumRange
  coneDirection?: THREE.Vector3
  radius?: number
  boxSize?: THREE.Vector3
  sphereRadius?: number

  // Particle properties
  lifetime?: NumRange
  size?: { start: NumRange; end: NumRange }
  speed?: NumRange
  gravity?: THREE.Vector3
  damping?: number          // Velocity damping over lifetime (0 = no damping, higher = more drag)

  // Orbital velocity - particles orbit around axes (radians per second)
  orbital?: {
    x?: number  // Orbit around X axis (rotation in YZ plane)
    y?: number  // Orbit around Y axis (rotation in XZ plane)
    z?: number  // Orbit around Z axis (rotation in XY plane)
  }
  alignment?: {
    velocityScale?: number
    enableVelocityStretch?: boolean
    enableVelocityAlignment?: boolean
  }

  rotation?: { angle?: NumRange; velocity?: NumRange }

  // Curves - "over lifetime" multipliers (all default to 1.0 constant)
  sizeOverLifetime?: CurveableValue     // Multiplier applied to interpolated size
  speedOverLifetime?: CurveableValue    // Multiplier applied to velocity magnitude
  opacityOverLifetime?: CurveableValue  // Direct alpha value (0-1), overrides color alpha
  rotationOverLifetime?: CurveableValue // Multiplier applied to angular velocity

  // Noise - affects position, rotation, and size over lifetime
  noise?: NoiseConfig

  // Rendering
  color?: {
    start: Vec4Range
    startList?: THREE.Vector4[]  // Random start colors to pick from
    useStartAsEnd?: boolean      // If true, end color matches start (for no-fade when using random colors)
    mid?: Vec4Range
    end: Vec4Range
  }
  blending?: THREE.Blending
  premultipliedAlpha?: boolean
  maskFromLuminance?: boolean
  flip?: FlipConfig             // Probability of flipping particles on X/Y axes
  renderMode?: RenderMode       // 'billboard' (default) or 'quad' (uses emitter rotation)

  // Collision
  collision?: {
    enabled?: boolean
    planeY?: number
    restitution?: number
    friction?: number
    killAfterBounces?: number
  }

  // Sprite sheets
  spriteSheet?: {
    rows: number
    columns: number
    frameCount?: number
    timeMode?: 'fps' | 'startLifetime'  // fps = animate at fps rate, startLifetime = fixed frame based on lifetime value
    fps?: number
    loop?: boolean
    randomStartFrame?: boolean  // If true, each particle starts at a random frame in the animation
  }

  debug?: boolean
  debugVelocities?: boolean
}

export type EmitterAssets = {
  texture?: THREE.Texture
  textureUrl?: string
  material?: THREE.MeshBasicMaterial
}

export function createParticleEmitter(
  cfg: EmitterConfig = {},
  assets: EmitterAssets = {},
): ParticleSystem {
  cfg.alignment = { ...(cfg.alignment ?? {}) }
  cfg.collision = { ...(cfg.collision ?? {}) }
  const particleCount = cfg.maxParticles ?? 300
  const baseBillboardSize = 0.35
  const baseSizeX = baseBillboardSize
  const baseSizeY = baseBillboardSize
  let velocityScaleFactor = cfg.alignment?.velocityScale ?? 0.4

  const texture = assets.texture
    ? assets.texture
    : assets.textureUrl
      ? new THREE.TextureLoader().load(assets.textureUrl)
      : (cfg as any).textureUrl
        ? new THREE.TextureLoader().load((cfg as any).textureUrl)
        : new THREE.TextureLoader().load("assets/particle_tex.jpg")
  texture.flipY = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  const material = new THREE.RawShaderMaterial({
    uniforms: {
      map: { value: texture },
      spriteSheetEnabled: { value: cfg.spriteSheet ? 1.0 : 0.0 },
      spriteGrid: {
        value: new THREE.Vector2(
          cfg.spriteSheet?.columns ?? 1,
          cfg.spriteSheet?.rows ?? 1,
        ),
      },
      spriteTotalFrames: {
        value: cfg.spriteSheet
          ? (cfg.spriteSheet.frameCount ??
            (cfg.spriteSheet.columns ?? 1) * (cfg.spriteSheet.rows ?? 1))
          : 1,
      },
      spriteCurrentFrame: { value: 0 },
      spritePerParticle: { value: 1.0 },
      spritePad: { value: new THREE.Vector2(0.002, 0.002) },
      useMaskFromLuminance: {
        value: (cfg.maskFromLuminance ?? false) ? 1.0 : 0.0,
      },
    },
    vertexShader: `
      precision highp float;
      precision highp int;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      attribute vec3 position;
      attribute vec2 uv;
      attribute mat4 instanceMatrix;
      attribute vec3 instanceColor;
      attribute float instanceOpacity;
      attribute float instanceFrame;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vFrame;
      void main() {
        vUv = uv;
        vColor = instanceColor;
        vOpacity = instanceOpacity;
        vFrame = instanceFrame;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      uniform float spriteSheetEnabled;
      uniform vec2 spriteGrid;
      uniform float spriteTotalFrames;
      uniform float spriteCurrentFrame;
      uniform float spritePerParticle;
      uniform vec2 spritePad;
      uniform float useMaskFromLuminance;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vOpacity;
      varying float vFrame;
      void main() {
        vec2 uvFrame = vUv;
        if (spriteSheetEnabled > 0.5) {
          float tilesX = spriteGrid.x;
          float tilesY = spriteGrid.y;
          float total = max(1.0, spriteTotalFrames);
          float frame = spritePerParticle > 0.5 ? vFrame : spriteCurrentFrame;
          frame = mod(floor(frame), total);
          float col = mod(frame, tilesX);
          float row = floor(frame / tilesX);
          vec2 tileSize = vec2(1.0 / tilesX, 1.0 / tilesY);
          vec2 pad = spritePad * tileSize;
          vec2 offset = vec2(col, row) * tileSize + pad;
          // Flip V within tile to correct sprite orientation
          vec2 uvInTile = vec2(vUv.x, 1.0 - vUv.y) * (tileSize - 2.0 * pad);
          uvFrame = offset + uvInTile;
        } else {
          // Flip V coordinate for regular (non-sprite-sheet) textures
          uvFrame = vec2(vUv.x, 1.0 - vUv.y);
        }
        vec4 texel = texture2D(map, uvFrame);
        // RawShaderMaterial bypasses Three.js color management, so we must convert sRGB to linear manually
        texel.rgb = pow(texel.rgb, vec3(2.2));
        float alpha = texel.a;
        if (useMaskFromLuminance > 0.5) {
          // Use luminance as alpha mask (ignore texel RGB for color)
          alpha = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
          float outA = alpha * vOpacity;
          vec3 outRGB = vColor * outA; // premultiply
          gl_FragColor = vec4(outRGB, outA);
        } else {
          gl_FragColor = vec4(texel.rgb * vColor, alpha * vOpacity);
        }
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: cfg.blending ?? THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  // Set premultiplied alpha mode if requested (works best with NormalBlending)
  ;(material as THREE.RawShaderMaterial).premultipliedAlpha =
    cfg.premultipliedAlpha ?? false

  const geometry = new THREE.PlaneGeometry(1, 1)
  const mesh = new THREE.InstancedMesh(geometry, material, particleCount)

  const instanceColors = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount * 3; i++) instanceColors[i] = 1.0
  mesh.instanceColor = new THREE.InstancedBufferAttribute(instanceColors, 3)

  const instanceOpacity = new Float32Array(particleCount)
  geometry.setAttribute(
    "instanceOpacity",
    new THREE.InstancedBufferAttribute(instanceOpacity, 1),
  )
  const instanceFrame = new Float32Array(particleCount)
  geometry.setAttribute(
    "instanceFrame",
    new THREE.InstancedBufferAttribute(instanceFrame, 1),
  )

  const positions = new Float32Array(particleCount * 3)
  const velocities = new Float32Array(particleCount * 3)
  const ages = new Float32Array(particleCount)
  const lifetimes = new Float32Array(particleCount)
  const bounceCount = new Float32Array(particleCount)
  const sizeStart = new Float32Array(particleCount)
  const sizeEnd = new Float32Array(particleCount)
  const spinAngle = new Float32Array(particleCount)
  const spinVelocity = new Float32Array(particleCount)
  const frameOffset = new Float32Array(particleCount) // Random start frame offset per particle
  const color0 = new Float32Array(particleCount * 4)
  const color1 = new Float32Array(particleCount * 4)
  const color2 = new Float32Array(particleCount * 4)
  const noiseSeed = new Float32Array(particleCount * 2) // Per-particle noise seed (x, y offset)
  const flipState = new Uint8Array(particleCount) // Per-particle flip state (bit 0 = flipX, bit 1 = flipY)

  // Flip configuration (probability 0-1 for each axis)
  const flipX = Math.max(0, Math.min(1, cfg.flip?.x ?? 0))
  const flipY = Math.max(0, Math.min(1, cfg.flip?.y ?? 0))

  // Noise configuration
  const noiseCfg = cfg.noise ?? {}
  const noiseEnabled = noiseCfg.enabled ?? false
  const noisePositionAmount = noiseCfg.positionAmount ?? 0
  const noiseRotationAmount = noiseCfg.rotationAmount ?? 0
  const noiseSizeAmount = noiseCfg.sizeAmount ?? 0
  const noiseFrequency = noiseCfg.frequency ?? 1
  const noiseScrollSpeed = noiseCfg.scrollSpeed ?? 0
  const noiseOctaves = Math.max(1, Math.min(4, Math.round(noiseCfg.octaves ?? 1)))
  const noiseStrengthX = noiseCfg.strengthX ?? 1
  const noiseStrengthY = noiseCfg.strengthY ?? 1

  const gravity = cfg.gravity
    ? cfg.gravity.clone()
    : new THREE.Vector3(0, -9.8, 0)
  const damping = cfg.damping ?? 0

  // Orbital velocity (radians per second around each axis)
  const orbitalX = cfg.orbital?.x ?? 0
  const orbitalY = cfg.orbital?.y ?? 0
  const orbitalZ = cfg.orbital?.z ?? 0
  const hasOrbital = orbitalX !== 0 || orbitalY !== 0 || orbitalZ !== 0

  const emitterRadius = cfg.radius ?? 0.25

  // Emission config
  const emission = cfg.emission ?? { mode: 'constant' as const, rateOverTime: 50 }
  let currentSpawnRate = emission.mode === 'constant' ? (emission.rateOverTime ?? 50) : 0

  const shape: EmitterShapeKey = cfg.shape ?? EmitterShape.CONE
  const coneDirection = (cfg.coneDirection ?? new THREE.Vector3(0, 1, 0))
    .clone()
    .normalize()
  const coneAngleRange: NumRange = cfg.coneAngle ?? [Math.PI / 16, Math.PI / 12]
  const speedRange: NumRange = cfg.speed ?? [1.0, 3.0]
  const lifeRange: NumRange = cfg.lifetime ?? [1.5, 3.0]
  const sizeRangeStart: NumRange = cfg.size?.start ?? [0.8, 1.2]
  const sizeRangeEnd: NumRange = cfg.size?.end ?? [0.2, 0.5]
  // When rotation is disabled (undefined), use zero angle and velocity so particles don't rotate
  const rotAngleRange: NumRange = cfg.rotation ? (cfg.rotation.angle ?? [0, Math.PI * 2]) : [0, 0]
  const rotVelRange: NumRange = cfg.rotation ? (cfg.rotation.velocity ?? [-6.0, 6.0]) : [0, 0]
  const colorStartRange: Vec4Range =
    cfg.color?.start ?? new THREE.Vector4(1, 0.8, 0.2, 1)
  const colorStartList: THREE.Vector4[] | undefined = cfg.color?.startList
  const colorUseStartAsEnd: boolean = cfg.color?.useStartAsEnd ?? false
  const colorMidRange: Vec4Range | undefined = cfg.color?.mid
  const colorEndRange: Vec4Range =
    cfg.color?.end ?? new THREE.Vector4(0.8, 0.1, 0.02, 0)

  const collisionCfg = cfg.collision ?? {}
  const floorCollisionEnabled = collisionCfg.enabled ?? true
  const floorY = collisionCfg.planeY ?? 0
  const floorBounceRestitution = collisionCfg.restitution ?? 0.7
  const floorFriction = collisionCfg.friction ?? 0.5
  const killAfterBounces = collisionCfg.killAfterBounces ?? 2

  let burstOrigin = new THREE.Vector3()
  let spawnAccumulator = 0

  // Playback state
  let isPlayingState = cfg.playOnAwake ?? true
  let elapsed = 0
  let systemComplete = false

  // Burst tracking (for burst mode with cycles)
  const bursts = emission.mode === 'burst' ? (emission.bursts ?? []) : []
  const burstCycleCount: number[] = bursts.map(() => 0)
  const nextBurstTime: number[] = bursts.map(b => b.time)

  function resetBurstTracking() {
    for (let i = 0; i < bursts.length; i++) {
      burstCycleCount[i] = 0
      nextBurstTime[i] = bursts[i].time
    }
  }

  let currentVelocityScale = velocityScaleFactor

  let spriteFrameAcc = 0
  let anyAliveLastFrame = false

  let debugGroup: THREE.Group | null = null
  let debugVelSegments: THREE.LineSegments | null = null
  if (cfg.debug && shape === EmitterShape.CONE) {
    debugGroup = new THREE.Group()
    const L = 2.0
    const minA = Array.isArray(coneAngleRange)
      ? coneAngleRange[0]
      : coneAngleRange
    const maxA = Array.isArray(coneAngleRange)
      ? coneAngleRange[1]
      : coneAngleRange
    const axis = coneDirection
    const u = new THREE.Vector3()
    const v = new THREE.Vector3()
    if (Math.abs(axis.x) < 0.9) u.set(1, 0, 0)
    else u.set(0, 1, 0)
    u.cross(axis).normalize()
    v.copy(axis).cross(u).normalize()

    function ring(angle: number, color: number) {
      const r = Math.tan(angle) * L
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2
        const p = new THREE.Vector3()
          .copy(axis)
          .multiplyScalar(L)
          .addScaledVector(u, Math.cos(t) * r)
          .addScaledVector(v, Math.sin(t) * r)
        pts.push(p)
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
      })
      return new THREE.Line(geom, mat)
    }

    const axisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3().copy(axis).multiplyScalar(L),
    ])
    debugGroup.add(
      new THREE.Line(
        axisGeom,
        new THREE.LineBasicMaterial({ color: 0x66ccff }),
      ),
    )
    debugGroup.add(ring(minA, 0x44ff44))
    debugGroup.add(ring(maxA, 0xff4444))
    ;(mesh as THREE.Object3D).add(debugGroup)
  }
  if (cfg.debugVelocities) {
    const maxLines = Math.min(64, particleCount)
    const linePos = new Float32Array(maxLines * 2 * 3)
    const geom = new THREE.BufferGeometry()
    geom.setAttribute("position", new THREE.BufferAttribute(linePos, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0xffff66,
      transparent: true,
      opacity: 0.85,
    })
    debugVelSegments = new THREE.LineSegments(geom, mat)
    ;(mesh as THREE.Object3D).add(debugVelSegments)
  }

  const m4 = new THREE.Matrix4()
  const invWorldMatrix = new THREE.Matrix4()
  const pos = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const rightRot = new THREE.Vector3()
  const upRot = new THREE.Vector3()
  const viewDir = new THREE.Vector3()
  const prevPos = new THREE.Vector3()
  const prevNdc = new THREE.Vector3()
  const currNdc = new THREE.Vector3()
  const tmp4a = new THREE.Vector4()
  const tmp4b = new THREE.Vector4()
  const tmp4c = new THREE.Vector4()
  const tmpColor = new THREE.Color()
  const tmpVec3A = new THREE.Vector3()
  const tmpVec3B = new THREE.Vector3()
  const tmpVec3C = new THREE.Vector3()
  const tmpVec3D = new THREE.Vector3()
  const tmpVec3E = new THREE.Vector3()

  function sampleDirection(spawnPos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    switch (shape) {
      case EmitterShape.CONE: {
        tmpVec3A.copy(spawnPos).sub(burstOrigin).normalize()
        const angle = randRange(coneAngleRange)
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        out.copy(coneDirection).multiplyScalar(cosA).addScaledVector(tmpVec3A, sinA).normalize()
        return out
      }
      case EmitterShape.SPHERE:
      case EmitterShape.POINT: {
        out.set(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        ).normalize()
        return out
      }
      default:
        out.set(0, 1, 0)
        return out
    }
  }

  // Pre-computed box size to avoid allocation
  const defaultBoxSize = new THREE.Vector3(1, 1, 1)
  const boxSize = cfg.boxSize ?? defaultBoxSize

  function sampleSpawnPosition(origin: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    switch (shape) {
      case EmitterShape.CONE:
      case EmitterShape.POINT: {
        const r = emitterRadius * Math.sqrt(Math.random())
        const t = Math.random() * Math.PI * 2
        const axis = coneDirection
        if (Math.abs(axis.x) < 0.9) tmpVec3B.set(1, 0, 0)
        else tmpVec3B.set(0, 1, 0)
        tmpVec3B.cross(axis).normalize()
        tmpVec3C.copy(axis).cross(tmpVec3B).normalize()
        out.copy(origin)
          .addScaledVector(tmpVec3B, Math.cos(t) * r)
          .addScaledVector(tmpVec3C, Math.sin(t) * r)
        return out
      }
      case EmitterShape.SPHERE: {
        tmpVec3B.set(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        ).normalize()
        const r = (cfg.sphereRadius ?? emitterRadius) * Math.cbrt(Math.random())
        out.copy(origin).addScaledVector(tmpVec3B, r)
        return out
      }
      case EmitterShape.BOX: {
        out.set(
          origin.x + (Math.random() - 0.5) * boxSize.x,
          origin.y + (Math.random() - 0.5) * boxSize.y,
          origin.z + (Math.random() - 0.5) * boxSize.z,
        )
        return out
      }
      default:
        out.copy(origin)
        return out
    }
  }

  // Pre-compute sprite settings
  const spriteTotalFrames = cfg.spriteSheet
    ? (cfg.spriteSheet.frameCount ?? (cfg.spriteSheet.columns ?? 1) * (cfg.spriteSheet.rows ?? 1))
    : 1
  const spriteFps = cfg.spriteSheet?.fps ?? 15
  const spriteLoop = cfg.spriteSheet?.loop ?? true
  const spriteTimeMode = cfg.spriteSheet?.timeMode ?? 'fps'
  const spriteRandomStartFrame = cfg.spriteSheet?.randomStartFrame ?? false


  function respawn(i: number, origin: THREE.Vector3 = burstOrigin) {
    const idx = i * 3
    sampleSpawnPosition(origin, tmpVec3D)
    positions[idx + 0] = tmpVec3D.x
    positions[idx + 1] = tmpVec3D.y
    positions[idx + 2] = tmpVec3D.z

    sampleDirection(tmpVec3D, tmpVec3E)
    const speed = randRange(speedRange)
    velocities[idx + 0] = tmpVec3E.x * speed
    velocities[idx + 1] = tmpVec3E.y * speed
    velocities[idx + 2] = tmpVec3E.z * speed

    ages[i] = 0
    lifetimes[i] = Math.max(0.0001, randRange(lifeRange))
    bounceCount[i] = 0

    sizeStart[i] = randRange(sizeRangeStart)
    sizeEnd[i] = randRange(sizeRangeEnd)
    spinAngle[i] = randRange(rotAngleRange)
    spinVelocity[i] = randRange(rotVelRange)

    // Set random start frame offset if enabled
    frameOffset[i] = spriteRandomStartFrame ? Math.random() * spriteTotalFrames : 0

    // Set random noise seed for this particle (used to give each particle unique noise pattern)
    const seedBase = i * 2
    noiseSeed[seedBase + 0] = Math.random() * 1000
    noiseSeed[seedBase + 1] = Math.random() * 1000

    // Determine flip state based on probability (random check against flipX/flipY values)
    let flip = 0
    if (flipX > 0 && Math.random() < flipX) flip |= 1  // bit 0 = flip X
    if (flipY > 0 && Math.random() < flipY) flip |= 2  // bit 1 = flip Y
    flipState[i] = flip

    // Write colors directly to typed arrays without allocating Vector4
    const base = i * 4
    // If startList exists and has colors, pick one randomly; otherwise use start range
    if (colorStartList && colorStartList.length > 0) {
      const picked = colorStartList[Math.floor(Math.random() * colorStartList.length)]
      tmp4a.copy(picked)
    } else {
      randVec4(colorStartRange, tmp4a)
    }
    color0[base + 0] = tmp4a.x
    color0[base + 1] = tmp4a.y
    color0[base + 2] = tmp4a.z
    color0[base + 3] = tmp4a.w
    
    if (colorMidRange) {
      randVec4(colorMidRange, tmp4b)
      color1[base + 0] = tmp4b.x
      color1[base + 1] = tmp4b.y
      color1[base + 2] = tmp4b.z
      color1[base + 3] = tmp4b.w
    } else {
      color1[base + 0] = tmp4a.x
      color1[base + 1] = tmp4a.y
      color1[base + 2] = tmp4a.z
      color1[base + 3] = tmp4a.w
    }
    
    // If useStartAsEnd is true, copy start color to end (no fade effect)
    // This ensures random start colors stay constant when colorOverLifetime is disabled
    if (colorUseStartAsEnd) {
      color2[base + 0] = tmp4a.x
      color2[base + 1] = tmp4a.y
      color2[base + 2] = tmp4a.z
      color2[base + 3] = tmp4a.w
    } else {
      randVec4(colorEndRange, tmp4c)
      color2[base + 0] = tmp4c.x
      color2[base + 1] = tmp4c.y
      color2[base + 2] = tmp4c.z
      color2[base + 3] = tmp4c.w
    }
  }

  for (let i = 0; i < particleCount; i++) {
    ages[i] = 10
    lifetimes[i] = 0
  }

  // Check if all particles are dead
  function allParticlesDead(): boolean {
    for (let i = 0; i < particleCount; i++) {
      if (ages[i] < lifetimes[i]) return false
    }
    return true
  }

  // Kill all particles (used by stop)
  function despawnAll(): void {
    for (let i = 0; i < particleCount; i++) {
      ages[i] = lifetimes[i] + 1
    }
    mesh.count = 0
  }

  // Render mode configuration
  const renderMode = cfg.renderMode ?? 'billboard'

  // Reusable vectors for emitter orientation (quad mode)
  const emitterRight = new THREE.Vector3()
  const emitterUp = new THREE.Vector3()
  const emitterForward = new THREE.Vector3()

  const update = (dt: number, camera: THREE.Camera, emitterWorldMatrix?: THREE.Matrix4) => {
    if (debugGroup) debugGroup.position.copy(burstOrigin)
    if (debugVelSegments) {
      const attr = debugVelSegments.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      let w = 0
      const scale = 0.25
      const maxLines = arr.length / 6
      for (let i = 0; i < particleCount && w / 6 < maxLines; i++) {
        if (ages[i] >= lifetimes[i]) continue
        const idx = i * 3
        const x = positions[idx + 0]
        const y = positions[idx + 1]
        const z = positions[idx + 2]
        const vx = velocities[idx + 0]
        const vy = velocities[idx + 1]
        const vz = velocities[idx + 2]
        arr[w++] = x
        arr[w++] = y
        arr[w++] = z
        arr[w++] = x + vx * scale
        arr[w++] = y + vy * scale
        arr[w++] = z + vz * scale
      }
      for (; w < arr.length; w++) arr[w] = 0
      attr.needsUpdate = true
    }

    // Handle playback state
    const duration = cfg.duration ?? 0
    const withinDuration = duration <= 0 || elapsed < duration

    if (isPlayingState && !systemComplete) {
      elapsed += dt

      // Handle emission based on mode
      if (emission.mode === 'constant' && withinDuration) {
        // Constant emission - spawn over time
        if (currentSpawnRate > 0) {
          spawnAccumulator += currentSpawnRate * dt
          const toSpawn = Math.floor(spawnAccumulator)
          if (toSpawn > 0) {
            spawnAccumulator -= toSpawn
            let spawned = 0
            for (let i = 0; i < particleCount && spawned < toSpawn; i++) {
              if (ages[i] >= lifetimes[i]) {
                respawn(i, burstOrigin)
                spawned++
              }
            }
          }
        }
      } else if (emission.mode === 'burst' && withinDuration) {
        // Burst emission - process burst triggers
        for (let bi = 0; bi < bursts.length; bi++) {
          const b = bursts[bi]
          const cyclesCompleted = burstCycleCount[bi]
          const maxCycles = b.cycles ?? 1

          if (cyclesCompleted >= maxCycles) continue

          if (elapsed >= nextBurstTime[bi]) {
            // Trigger burst
            burst(burstOrigin, b.count)

            // Schedule next cycle
            burstCycleCount[bi]++
            if (burstCycleCount[bi] < maxCycles) {
              nextBurstTime[bi] = elapsed + (b.interval ?? 0)
            }
          }
        }
      }

      // Check for system completion (only when duration is set)
      if (duration > 0 && elapsed >= duration) {
        if (cfg.looping) {
          // Restart the system immediately - don't wait for particles to die
          elapsed = 0
          resetBurstTracking()
        } else if (!withinDuration) {
          // Non-looping system past duration - stop spawning but let particles live
          // Only mark complete when all particles are dead
          if (allParticlesDead()) {
            systemComplete = true
            isPlayingState = false
          }
        }
      }
    }

    // Extract camera vectors (always needed for billboard mode and velocity alignment)
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    up.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    forward.setFromMatrixColumn(camera.matrixWorld, 2).normalize()
    viewDir.copy(forward).negate()

    // Transform billboard vectors from world space to emitter's local space
    // This ensures billboards face the camera correctly even when emitter has rotated parents
    if (emitterWorldMatrix) {
      invWorldMatrix.copy(emitterWorldMatrix).invert()
      right.transformDirection(invWorldMatrix)
      up.transformDirection(invWorldMatrix)
      forward.transformDirection(invWorldMatrix)
      viewDir.transformDirection(invWorldMatrix)
    }

    // For quad mode, use local/identity vectors since the parent hierarchy
    // already applies the emitter's world transform to the instanced mesh
    const isQuadMode = renderMode === 'quad'
    if (isQuadMode) {
      // Use identity axes - parent transform handles the rotation
      emitterRight.set(1, 0, 0)
      emitterUp.set(0, 1, 0)
      emitterForward.set(0, 0, 1)
    }

    // Cache alignment config lookups
    const velAlign = cfg.alignment?.enableVelocityAlignment ?? false
    const velStretchEnabled = cfg.alignment?.enableVelocityStretch ?? false
    const velScaleConfig = cfg.alignment?.velocityScale ?? velocityScaleFactor

    // GPU write index - alive particles are packed contiguously for rendering
    let writeIdx = 0
    
    for (let i = 0; i < particleCount; i++) {
      // Early exit for dead particles - skip all processing
      if (ages[i] >= lifetimes[i]) continue

      const idx = i * 3

      // Calculate life ratio for curve evaluation (needed early for speed/rotation curves)
      const preLifeRatio = ages[i] / lifetimes[i]

      // Evaluate speed and rotation curves
      const speedCurveMultiplier = evaluateCurveableValue(cfg.speedOverLifetime, preLifeRatio, 1)
      const rotationCurveMultiplier = evaluateCurveableValue(cfg.rotationOverLifetime, preLifeRatio, 1)

      // Physics update
      velocities[idx + 0] += gravity.x * dt
      velocities[idx + 1] += gravity.y * dt
      velocities[idx + 2] += gravity.z * dt

      // Apply damping (velocity reduction over time)
      if (damping > 0) {
        const dampFactor = 1 - damping * dt
        const clampedDamp = Math.max(0, dampFactor)
        velocities[idx + 0] *= clampedDamp
        velocities[idx + 1] *= clampedDamp
        velocities[idx + 2] *= clampedDamp
      }

      // Apply orbital velocity (rotation around axes)
      // This rotates both position and velocity around each axis, creating orbital motion
      // Velocity must also be rotated so alignment to velocity works correctly
      if (hasOrbital) {
        // Orbital X: rotate in YZ plane around X axis
        if (orbitalX !== 0) {
          const cosX = Math.cos(orbitalX * dt)
          const sinX = Math.sin(orbitalX * dt)
          // Rotate position
          const py = positions[idx + 1]
          const pz = positions[idx + 2]
          positions[idx + 1] = py * cosX - pz * sinX
          positions[idx + 2] = py * sinX + pz * cosX
          // Rotate velocity
          const vy = velocities[idx + 1]
          const vz = velocities[idx + 2]
          velocities[idx + 1] = vy * cosX - vz * sinX
          velocities[idx + 2] = vy * sinX + vz * cosX
        }

        // Orbital Y: rotate in XZ plane around Y axis
        if (orbitalY !== 0) {
          const cosY = Math.cos(orbitalY * dt)
          const sinY = Math.sin(orbitalY * dt)
          // Rotate position
          const px = positions[idx + 0]
          const pz = positions[idx + 2]
          positions[idx + 0] = px * cosY + pz * sinY
          positions[idx + 2] = -px * sinY + pz * cosY
          // Rotate velocity
          const vx = velocities[idx + 0]
          const vz = velocities[idx + 2]
          velocities[idx + 0] = vx * cosY + vz * sinY
          velocities[idx + 2] = -vx * sinY + vz * cosY
        }

        // Orbital Z: rotate in XY plane around Z axis
        if (orbitalZ !== 0) {
          const cosZ = Math.cos(orbitalZ * dt)
          const sinZ = Math.sin(orbitalZ * dt)
          // Rotate position
          const px = positions[idx + 0]
          const py = positions[idx + 1]
          positions[idx + 0] = px * cosZ - py * sinZ
          positions[idx + 1] = px * sinZ + py * cosZ
          // Rotate velocity
          const vx = velocities[idx + 0]
          const vy = velocities[idx + 1]
          velocities[idx + 0] = vx * cosZ - vy * sinZ
          velocities[idx + 1] = vx * sinZ + vy * cosZ
        }
      }

      // Apply speed curve multiplier to position update
      const effectiveSpeedMult = speedCurveMultiplier
      positions[idx + 0] += velocities[idx + 0] * dt * effectiveSpeedMult
      positions[idx + 1] += velocities[idx + 1] * dt * effectiveSpeedMult
      positions[idx + 2] += velocities[idx + 2] * dt * effectiveSpeedMult
      ages[i] += dt

      // Apply rotation curve multiplier to angular velocity
      spinAngle[i] += spinVelocity[i] * dt * rotationCurveMultiplier

      // Floor collision
      if (
        floorCollisionEnabled &&
        positions[idx + 1] <= floorY &&
        velocities[idx + 1] < 0
      ) {
        positions[idx + 1] = floorY
        velocities[idx + 1] = -velocities[idx + 1] * floorBounceRestitution
        velocities[idx + 0] *= floorFriction
        velocities[idx + 2] *= floorFriction
        bounceCount[i]++
        if (bounceCount[i] >= killAfterBounces) {
          lifetimes[i] = ages[i]
          continue // Particle just died, skip rendering
        }
      }

      // Check if particle died this frame from age
      if (ages[i] >= lifetimes[i]) continue

      pos.set(positions[idx + 0], positions[idx + 1], positions[idx + 2])

      // Apply noise offsets for position, rotation, and size
      let noiseRotOffset = 0
      let noiseSizeMultiplier = 1
      if (noiseEnabled) {
        const seedBase = i * 2
        const seedX = noiseSeed[seedBase + 0]
        const seedY = noiseSeed[seedBase + 1]
        const timeOffset = ages[i] * noiseScrollSpeed

        // Sample noise at particle's unique seed + time offset
        const noiseX = noiseOctaves > 1
          ? fbm2D((seedX + timeOffset) * noiseFrequency, seedY * noiseFrequency, noiseOctaves)
          : simplex2D((seedX + timeOffset) * noiseFrequency, seedY * noiseFrequency)
        const noiseY = noiseOctaves > 1
          ? fbm2D((seedX + 100 + timeOffset) * noiseFrequency, (seedY + 100) * noiseFrequency, noiseOctaves)
          : simplex2D((seedX + 100 + timeOffset) * noiseFrequency, (seedY + 100) * noiseFrequency)
        const noiseZ = noiseOctaves > 1
          ? fbm2D((seedX + 200 + timeOffset) * noiseFrequency, (seedY + 200) * noiseFrequency, noiseOctaves)
          : simplex2D((seedX + 200 + timeOffset) * noiseFrequency, (seedY + 200) * noiseFrequency)

        // Apply position noise with strength modifiers
        if (noisePositionAmount > 0) {
          pos.x += noiseX * noisePositionAmount * noiseStrengthX
          pos.y += noiseY * noisePositionAmount * noiseStrengthY
          pos.z += noiseZ * noisePositionAmount * noiseStrengthX // Z uses X strength (horizontal)
        }

        // Calculate rotation noise offset
        if (noiseRotationAmount > 0) {
          const noiseRot = noiseOctaves > 1
            ? fbm2D((seedX + 300 + timeOffset) * noiseFrequency, (seedY + 300) * noiseFrequency, noiseOctaves)
            : simplex2D((seedX + 300 + timeOffset) * noiseFrequency, (seedY + 300) * noiseFrequency)
          noiseRotOffset = noiseRot * noiseRotationAmount
        }

        // Calculate size noise multiplier (centered around 1)
        if (noiseSizeAmount > 0) {
          const noiseSz = noiseOctaves > 1
            ? fbm2D((seedX + 400 + timeOffset) * noiseFrequency, (seedY + 400) * noiseFrequency, noiseOctaves)
            : simplex2D((seedX + 400 + timeOffset) * noiseFrequency, (seedY + 400) * noiseFrequency)
          // noiseSz is [-1, 1], map to [1-amount, 1+amount]
          noiseSizeMultiplier = 1 + noiseSz * noiseSizeAmount
        }
      }

      let angle = 0
      if (velAlign && !isQuadMode) {
        // Velocity alignment only makes sense in billboard mode
        // Calculate effective velocity including orbital tangential velocity
        let effVelX = velocities[idx + 0]
        let effVelY = velocities[idx + 1]
        let effVelZ = velocities[idx + 2]

        // Add orbital tangential velocity: v_tangent = ω × position
        // For rotation around X axis: vy += -ωX * z, vz += ωX * y
        // For rotation around Y axis: vx += ωY * z, vz += -ωY * x
        // For rotation around Z axis: vx += -ωZ * y, vy += ωZ * x
        if (hasOrbital) {
          const px = positions[idx + 0]
          const py = positions[idx + 1]
          const pz = positions[idx + 2]
          if (orbitalX !== 0) {
            effVelY += -orbitalX * pz
            effVelZ += orbitalX * py
          }
          if (orbitalY !== 0) {
            effVelX += orbitalY * pz
            effVelZ += -orbitalY * px
          }
          if (orbitalZ !== 0) {
            effVelX += -orbitalZ * py
            effVelY += orbitalZ * px
          }
        }

        prevPos.set(
          positions[idx + 0] - effVelX * dt,
          positions[idx + 1] - effVelY * dt,
          positions[idx + 2] - effVelZ * dt,
        )
        prevNdc.copy(prevPos).project(camera)
        currNdc.copy(pos).project(camera)
        const dx = currNdc.x - prevNdc.x
        const dy = currNdc.y - prevNdc.y
        angle = Math.atan2(dy, dx) - Math.PI * 0.5
      }
      angle += spinAngle[i] + noiseRotOffset
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)

      if (isQuadMode) {
        // Quad mode: use emitter's orientation, apply spin around local forward axis
        rightRot.set(
          emitterRight.x * cosA + emitterUp.x * sinA,
          emitterRight.y * cosA + emitterUp.y * sinA,
          emitterRight.z * cosA + emitterUp.z * sinA,
        )
        upRot.set(
          -emitterRight.x * sinA + emitterUp.x * cosA,
          -emitterRight.y * sinA + emitterUp.y * cosA,
          -emitterRight.z * sinA + emitterUp.z * cosA,
        )
      } else {
        // Billboard mode: use camera's orientation
        rightRot.set(
          right.x * cosA + up.x * sinA,
          right.y * cosA + up.y * sinA,
          right.z * cosA + up.z * sinA,
        )
        upRot.set(
          -right.x * sinA + up.x * cosA,
          -right.y * sinA + up.y * cosA,
          -right.z * sinA + up.z * cosA,
        )
      }

      currentVelocityScale = velStretchEnabled ? velScaleConfig : 0
      const vmag = Math.hypot(
        velocities[idx + 0],
        velocities[idx + 1],
        velocities[idx + 2],
      )
      const stretch = 1 + vmag * currentVelocityScale
      // No artificial attenuation - perspective camera handles depth scaling naturally

      const lifeRatio = ages[i] / lifetimes[i]

      // Evaluate curve multipliers for this particle's lifetime
      const sizeCurveMultiplier = evaluateCurveableValue(cfg.sizeOverLifetime, lifeRatio, 1)
      const opacityCurveValue = cfg.opacityOverLifetime !== undefined
        ? evaluateCurveableValue(cfg.opacityOverLifetime, lifeRatio, 1)
        : null // null means use color alpha interpolation

      const s = lerp(sizeStart[i], sizeEnd[i], lifeRatio) * noiseSizeMultiplier * sizeCurveMultiplier
      let sx = baseSizeX * s
      let sy = baseSizeY * s * stretch

      // Apply flip (negate scale to flip the particle)
      const flip = flipState[i]
      if (flip & 1) sx = -sx  // flip X (horizontal)
      if (flip & 2) sy = -sy  // flip Y (vertical)

      // Color interpolation
      const colorBase = i * 4
      tmp4a.set(
        color0[colorBase + 0],
        color0[colorBase + 1],
        color0[colorBase + 2],
        color0[colorBase + 3],
      )
      tmp4b.set(
        color2[colorBase + 0],
        color2[colorBase + 1],
        color2[colorBase + 2],
        color2[colorBase + 3],
      )
      if (colorMidRange) {
        tmp4c.set(
          color1[colorBase + 0],
          color1[colorBase + 1],
          color1[colorBase + 2],
          color1[colorBase + 3],
        )
        if (lifeRatio < 0.5) {
          lerpVec4(tmp4a, tmp4c, lifeRatio * 2, tmp4a)
        } else {
          lerpVec4(tmp4c, tmp4b, (lifeRatio - 0.5) * 2, tmp4a)
        }
      } else {
        lerpVec4(tmp4a, tmp4b, lifeRatio, tmp4a)
      }

      // Write GPU data at writeIdx (packed contiguously)
      tmpColor.setRGB(tmp4a.x, tmp4a.y, tmp4a.z)
      mesh.setColorAt(writeIdx, tmpColor)
      // Use opacity curve if defined, otherwise use interpolated color alpha
      instanceOpacity[writeIdx] = opacityCurveValue !== null ? opacityCurveValue : tmp4a.w

      // Use emitter forward for quad mode, camera view direction for billboard
      const normal = isQuadMode ? emitterForward : viewDir
      m4.set(
        rightRot.x * sx,
        upRot.x * sy,
        normal.x,
        pos.x,
        rightRot.y * sx,
        upRot.y * sy,
        normal.y,
        pos.y,
        rightRot.z * sx,
        upRot.z * sy,
        normal.z,
        pos.z,
        0,
        0,
        0,
        1,
      )
      mesh.setMatrixAt(writeIdx, m4)

      // Per-particle sprite frame
      if (cfg.spriteSheet) {
        let frameF: number
        if (spriteTimeMode === 'startLifetime') {
          // Frame is fixed based on particle's assigned lifetime value (normalized within range)
          // Particles with shorter lifetimes get lower frames, longer lifetimes get higher frames
          const lifeMin = Array.isArray(lifeRange) ? lifeRange[0] : lifeRange as number
          const lifeMax = Array.isArray(lifeRange) ? lifeRange[1] : lifeRange as number
          const normalizedLife = lifeMax > lifeMin
            ? (lifetimes[i] - lifeMin) / (lifeMax - lifeMin)
            : 0
          // Use spriteTotalFrames (not -1) because normalizedLife is in [0,1) due to Math.random()
          // This ensures all frames including the last one can be selected
          frameF = normalizedLife * spriteTotalFrames
        } else {
          // FPS-based animation with optional random start offset
          frameF = ages[i] * spriteFps + frameOffset[i]
          if (spriteLoop) {
            frameF = frameF % spriteTotalFrames
          } else {
            frameF = Math.min(frameF, spriteTotalFrames - 0.01)
          }
        }
        instanceFrame[writeIdx] = frameF
      }

      writeIdx++
    }

    // Set instance count to only render alive particles
    mesh.count = writeIdx

    ;(
      mesh.instanceMatrix as unknown as THREE.InstancedBufferAttribute
    ).needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const op = geometry.getAttribute(
      "instanceOpacity",
    ) as THREE.InstancedBufferAttribute
    if (op) op.needsUpdate = true
    const ifr = geometry.getAttribute(
      "instanceFrame",
    ) as THREE.InstancedBufferAttribute
    if (ifr) ifr.needsUpdate = true

    const spriteCfg = cfg.spriteSheet
    const shaderMat = material as THREE.RawShaderMaterial
    if (shaderMat && spriteCfg) {
      const gridX = spriteCfg.columns
      const gridY = spriteCfg.rows
      const total = spriteCfg.frameCount ?? gridX * gridY
      shaderMat.uniforms.spriteSheetEnabled.value = 1.0
      ;(shaderMat.uniforms.spriteGrid.value as THREE.Vector2).set(gridX, gridY)
      shaderMat.uniforms.spriteTotalFrames.value = total
      shaderMat.uniforms.spriteCurrentFrame.value = 0
      shaderMat.uniforms.spritePerParticle.value = 1.0
    } else if (shaderMat) {
      shaderMat.uniforms.spriteSheetEnabled.value = 0.0
    }
  }

  const burst = (origin: THREE.Vector3, count: number = 50) => {
    burstOrigin.copy(origin)
    // Do not reset global sprite frame; per-particle frames are derived from age
    let spawned = 0
    for (let i = 0; i < particleCount && spawned < count; i++) {
      if (ages[i] >= lifetimes[i]) {
        respawn(i, origin)
        spawned++
      }
    }
  }

  const setTexture = (tex: THREE.Texture) => {
    const m = material as THREE.RawShaderMaterial
    if (m.uniforms.map) m.uniforms.map.value = tex
    tex.needsUpdate = true
    m.needsUpdate = true
  }

  const setSpawnRate = (rate: number) => {
    currentSpawnRate = Math.max(0, rate || 0)
  }

  const setOrigin = (origin: THREE.Vector3) => {
    burstOrigin.copy(origin)
  }

  // Internal playback controls (no cascade - used by parent's cascade)
  const playInternal = () => {
    isPlayingState = true
    systemComplete = false
  }

  const stopInternal = () => {
    isPlayingState = false
    elapsed = 0
    systemComplete = false
    spawnAccumulator = 0
    resetBurstTracking()
    despawnAll()
  }

  const restartInternal = () => {
    stopInternal()
    playInternal()
  }

  // Helper to cascade action to child particle emitters
  const cascadeToChildren = (action: 'play' | 'stop' | 'restart') => {
    // Get the parent object (the one that owns this particle system)
    const parent = mesh.parent
    if (!parent) return

    // Traverse all descendants and trigger INTERNAL action (no re-cascade)
    parent.traverse((child) => {
      // Skip self (the mesh itself)
      if (child === mesh) return
      // Check if child has a particle emitter
      const childEmitter = child.userData.__particleEmitter as ParticleSystem | undefined
      if (childEmitter) {
        // Call internal methods to avoid infinite recursion
        if (action === 'play') childEmitter.playInternal?.()
        else if (action === 'stop') childEmitter.stopInternal?.()
        else if (action === 'restart') childEmitter.restartInternal?.()
      }
    })
  }

  // Playback controls - cascade to children
  const play = () => {
    playInternal()
    cascadeToChildren('play')
  }

  const stop = () => {
    stopInternal()
    cascadeToChildren('stop')
  }

  const restart = () => {
    restartInternal()
    cascadeToChildren('restart')
  }

  const isPlaying = () => isPlayingState

  const getElapsed = () => elapsed

  return {
    object: mesh,
    update,
    burst,
    setSpawnRate,
    setOrigin,
    config: cfg,
    setTexture,
    // Playback controls
    play,
    stop,
    restart,
    isPlaying,
    getElapsed,
    // Internal methods (no cascade) - used by parent cascade
    playInternal,
    stopInternal,
    restartInternal,
  }
}
