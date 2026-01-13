import * as THREE from "three"

// Re-export the ParticleEmitterComponent
export { Particle } from "./Particle"

export type ParticleSystem = {
  object: THREE.InstancedMesh
  update: (dt: number, camera: THREE.Camera) => void
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
  alignment?: {
    velocityScale?: number
    enableVelocityStretch?: boolean
    enableVelocityAlignment?: boolean
  }

  rotation?: { angle?: NumRange; velocity?: NumRange }

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
      precision mediump float;
      precision mediump int;
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
      precision mediump float;
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
        // Decode sRGB to linear space for correct color blending
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

  const gravity = cfg.gravity
    ? cfg.gravity.clone()
    : new THREE.Vector3(0, -9.8, 0)
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

  const update = (dt: number, camera: THREE.Camera) => {
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

    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    up.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    forward.setFromMatrixColumn(camera.matrixWorld, 2).normalize()
    viewDir.copy(forward).negate()

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

      // Physics update
      velocities[idx + 0] += gravity.x * dt
      velocities[idx + 1] += gravity.y * dt
      velocities[idx + 2] += gravity.z * dt
      positions[idx + 0] += velocities[idx + 0] * dt
      positions[idx + 1] += velocities[idx + 1] * dt
      positions[idx + 2] += velocities[idx + 2] * dt
      ages[i] += dt
      spinAngle[i] += spinVelocity[i] * dt

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

      let angle = 0
      if (velAlign) {
        prevPos.set(
          positions[idx + 0] - velocities[idx + 0] * dt,
          positions[idx + 1] - velocities[idx + 1] * dt,
          positions[idx + 2] - velocities[idx + 2] * dt,
        )
        prevNdc.copy(prevPos).project(camera)
        currNdc.copy(pos).project(camera)
        const dx = currNdc.x - prevNdc.x
        const dy = currNdc.y - prevNdc.y
        angle = Math.atan2(dy, dx) - Math.PI * 0.5
      }
      angle += spinAngle[i]
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)

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

      currentVelocityScale = velStretchEnabled ? velScaleConfig : 0
      const vmag = Math.hypot(
        velocities[idx + 0],
        velocities[idx + 1],
        velocities[idx + 2],
      )
      const stretch = 1 + vmag * currentVelocityScale
      const distance = camera.position.distanceTo(pos)
      const attenuation = 1 / (1 + distance * 0.25)

      const lifeRatio = ages[i] / lifetimes[i]
      const s = lerp(sizeStart[i], sizeEnd[i], lifeRatio)
      const sx = baseSizeX * s * attenuation
      const sy = baseSizeY * s * attenuation * stretch

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
      instanceOpacity[writeIdx] = tmp4a.w

      const normal = viewDir
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
          frameF = normalizedLife * (spriteTotalFrames - 1)
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

  // Playback controls
  const play = () => {
    isPlayingState = true
    systemComplete = false
  }

  const stop = () => {
    isPlayingState = false
    elapsed = 0
    systemComplete = false
    spawnAccumulator = 0
    resetBurstTracking()
    despawnAll()
  }

  const restart = () => {
    stop()
    play()
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
  }
}
