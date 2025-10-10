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
}

export type NumRange = number | readonly [number, number]
type Vec3Range = THREE.Vector3 | { min: THREE.Vector3; max: THREE.Vector3 }
type Vec4Range = THREE.Vector4 | { min: THREE.Vector4; max: THREE.Vector4 }

function randRange(r: NumRange): number {
  if (Array.isArray(r)) return r[0] + Math.random() * (r[1] - r[0])
  return r as number
}
function randVec3(r: Vec3Range): THREE.Vector3 {
  if (r instanceof THREE.Vector3) return r.clone()
  const { min, max } = r
  return new THREE.Vector3(
    min.x + Math.random() * (max.x - min.x),
    min.y + Math.random() * (max.y - min.y),
    min.z + Math.random() * (max.z - min.z),
  )
}
function randVec4(r: Vec4Range): THREE.Vector4 {
  if (r instanceof THREE.Vector4) return r.clone()
  const { min, max } = r
  return new THREE.Vector4(
    min.x + Math.random() * (max.x - min.x),
    min.y + Math.random() * (max.y - min.y),
    min.z + Math.random() * (max.z - min.z),
    min.w + Math.random() * (max.w - min.w),
  )
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

export type EmitterConfig = {
  position?: THREE.Vector3
  spawnRate?: number
  maxParticles?: number

  shape?: EmitterShapeKey
  coneAngle?: NumRange
  coneDirection?: THREE.Vector3
  radius?: number
  boxSize?: THREE.Vector3
  sphereRadius?: number

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

  color?: { start: Vec4Range; mid?: Vec4Range; end: Vec4Range }
  blending?: THREE.Blending
  premultipliedAlpha?: boolean
  maskFromLuminance?: boolean

  collision?: {
    enabled?: boolean
    planeY?: number
    restitution?: number
    friction?: number
    killAfterBounces?: number
  }

  spriteSheet?: {
    rows: number
    columns: number
    frameCount?: number
    fps?: number
    loop?: boolean
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
          vec2 uvInTile = vUv * (tileSize - 2.0 * pad);
          uvFrame = offset + uvInTile;
        }
        vec4 texel = texture2D(map, uvFrame);
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
  const color0 = new Float32Array(particleCount * 4)
  const color1 = new Float32Array(particleCount * 4)
  const color2 = new Float32Array(particleCount * 4)

  const gravity = cfg.gravity
    ? cfg.gravity.clone()
    : new THREE.Vector3(0, -9.8, 0)
  const emitterRadius = cfg.radius ?? 0.25
  let currentSpawnRate = cfg.spawnRate ?? 0
  const shape: EmitterShapeKey = cfg.shape ?? EmitterShape.CONE
  const coneDirection = (cfg.coneDirection ?? new THREE.Vector3(0, 1, 0))
    .clone()
    .normalize()
  const coneAngleRange: NumRange = cfg.coneAngle ?? [Math.PI / 16, Math.PI / 12]
  const speedRange: NumRange = cfg.speed ?? [1.0, 3.0]
  const lifeRange: NumRange = cfg.lifetime ?? [1.5, 3.0]
  const sizeRangeStart: NumRange = cfg.size?.start ?? [0.8, 1.2]
  const sizeRangeEnd: NumRange = cfg.size?.end ?? [0.2, 0.5]
  const rotAngleRange: NumRange = cfg.rotation?.angle ?? [0, Math.PI * 2]
  const rotVelRange: NumRange = cfg.rotation?.velocity ?? [-6.0, 6.0]
  const colorStartRange: Vec4Range =
    cfg.color?.start ?? new THREE.Vector4(1, 0.8, 0.2, 1)
  const colorMidRange: Vec4Range | undefined = cfg.color?.mid
  const colorEndRange: Vec4Range =
    cfg.color?.end ?? new THREE.Vector4(0.8, 0.1, 0.02, 0)

  const collisionCfg = cfg.collision ?? {}
  const floorCollisionEnabled = collisionCfg.enabled ?? true
  const floorY = collisionCfg.planeY ?? 0
  const floorBounceRestitution = collisionCfg.restitution ?? 0.7
  const floorFriction = collisionCfg.friction ?? 0.5
  const killAfterBounces = collisionCfg.killAfterBounces ?? 2

  let burstOrigin = (cfg.position ?? new THREE.Vector3()).clone()
  let spawnAccumulator = 0

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

  function sampleDirection(spawnPos: THREE.Vector3): THREE.Vector3 {
    switch (shape) {
      case EmitterShape.CONE: {
        const offsetDir = new THREE.Vector3()
          .copy(spawnPos)
          .sub(burstOrigin)
          .normalize()
        const angle = randRange(coneAngleRange)
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        return new THREE.Vector3()
          .copy(coneDirection)
          .multiplyScalar(cosA)
          .addScaledVector(offsetDir, sinA)
          .normalize()
      }
      case EmitterShape.SPHERE:
      case EmitterShape.POINT: {
        const dir = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        )
        return dir.normalize()
      }
      default:
        return new THREE.Vector3(0, 1, 0)
    }
  }

  function sampleSpawnPosition(origin: THREE.Vector3): THREE.Vector3 {
    switch (shape) {
      case EmitterShape.CONE:
      case EmitterShape.POINT: {
        const r = emitterRadius * Math.sqrt(Math.random())
        const t = Math.random() * Math.PI * 2
        const axis = coneDirection
        const u = new THREE.Vector3()
        const v = new THREE.Vector3()
        if (Math.abs(axis.x) < 0.9) u.set(1, 0, 0)
        else u.set(0, 1, 0)
        u.cross(axis).normalize()
        v.copy(axis).cross(u).normalize()
        const p = new THREE.Vector3()
          .copy(origin)
          .addScaledVector(u, Math.cos(t) * r)
          .addScaledVector(v, Math.sin(t) * r)
        return p
      }
      case EmitterShape.SPHERE: {
        const dir = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
        ).normalize()
        const r = (cfg.sphereRadius ?? emitterRadius) * Math.cbrt(Math.random())
        return new THREE.Vector3().copy(origin).addScaledVector(dir, r)
      }
      case EmitterShape.BOX: {
        const size = cfg.boxSize ?? new THREE.Vector3(1, 1, 1)
        return new THREE.Vector3(
          origin.x + (Math.random() - 0.5) * size.x,
          origin.y + (Math.random() - 0.5) * size.y,
          origin.z + (Math.random() - 0.5) * size.z,
        )
      }
      default:
        return origin.clone()
    }
  }

  function respawn(i: number, origin: THREE.Vector3 = burstOrigin) {
    const idx = i * 3
    const p = sampleSpawnPosition(origin)
    positions[idx + 0] = p.x
    positions[idx + 1] = p.y
    positions[idx + 2] = p.z

    const dir = sampleDirection(p)
    const speed = randRange(speedRange)
    velocities[idx + 0] = dir.x * speed
    velocities[idx + 1] = dir.y * speed
    velocities[idx + 2] = dir.z * speed

    ages[i] = 0
    lifetimes[i] = Math.max(0.0001, randRange(lifeRange))
    // Randomize starting frame a bit so not all particles are in sync
    if (cfg.spriteSheet) {
      const total =
        cfg.spriteSheet.frameCount ??
        (cfg.spriteSheet.columns ?? 1) * (cfg.spriteSheet.rows ?? 1)
      instanceFrame[i] = Math.floor(Math.random() * total)
    } else {
      instanceFrame[i] = 0
    }
    bounceCount[i] = 0

    sizeStart[i] = randRange(sizeRangeStart)
    sizeEnd[i] = randRange(sizeRangeEnd)
    spinAngle[i] = randRange(rotAngleRange)
    spinVelocity[i] = randRange(rotVelRange)

    const c0 = randVec4(colorStartRange)
    const c1 = colorMidRange ? randVec4(colorMidRange) : c0.clone()
    const c2 = randVec4(colorEndRange)
    const base = i * 4
    color0[base + 0] = c0.x
    color0[base + 1] = c0.y
    color0[base + 2] = c0.z
    color0[base + 3] = c0.w
    color1[base + 0] = c1.x
    color1[base + 1] = c1.y
    color1[base + 2] = c1.z
    color1[base + 3] = c1.w
    color2[base + 0] = c2.x
    color2[base + 1] = c2.y
    color2[base + 2] = c2.z
    color2[base + 3] = c2.w
  }

  for (let i = 0; i < particleCount; i++) {
    ages[i] = 10
    lifetimes[i] = 0
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
    if (currentSpawnRate > 0) {
      spawnAccumulator += currentSpawnRate * dt
      const toSpawn = Math.floor(spawnAccumulator)
      if (toSpawn > 0) {
        spawnAccumulator -= toSpawn
        // Spawn without resetting sprite animation timeline
        let spawned = 0
        for (let i = 0; i < particleCount && spawned < toSpawn; i++) {
          if (ages[i] >= lifetimes[i]) {
            respawn(i, burstOrigin)
            spawned++
          }
        }
      }
    }

    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    up.setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    forward.setFromMatrixColumn(camera.matrixWorld, 2).normalize()
    viewDir.copy(forward).negate()

    let aliveCount = 0
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3

      velocities[idx + 0] += gravity.x * dt
      velocities[idx + 1] += gravity.y * dt
      velocities[idx + 2] += gravity.z * dt
      positions[idx + 0] += velocities[idx + 0] * dt
      positions[idx + 1] += velocities[idx + 1] * dt
      positions[idx + 2] += velocities[idx + 2] * dt
      ages[i] += dt
      spinAngle[i] += spinVelocity[i] * dt

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
        }
      }

      if (ages[i] >= lifetimes[i]) {
        mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0))
        continue
      }
      aliveCount++

      pos.set(positions[idx + 0], positions[idx + 1], positions[idx + 2])

      let angle = 0
      const velAlign = cfg.alignment?.enableVelocityAlignment ?? false
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

      const velStretchEnabled = cfg.alignment?.enableVelocityStretch ?? false
      currentVelocityScale = velStretchEnabled
        ? (cfg.alignment?.velocityScale ?? currentVelocityScale)
        : 0
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

      const base = i * 4
      tmp4a.set(
        color0[base + 0],
        color0[base + 1],
        color0[base + 2],
        color0[base + 3],
      )
      tmp4b.set(
        color2[base + 0],
        color2[base + 1],
        color2[base + 2],
        color2[base + 3],
      )
      if (colorMidRange) {
        const cm = new THREE.Vector4(
          color1[base + 0],
          color1[base + 1],
          color1[base + 2],
          color1[base + 3],
        )
        if (lifeRatio < 0.5) {
          lerpVec4(tmp4a, cm, lifeRatio * 2, tmp4a)
        } else {
          lerpVec4(cm, tmp4b, (lifeRatio - 0.5) * 2, tmp4a)
        }
      } else {
        lerpVec4(tmp4a, tmp4b, lifeRatio, tmp4a)
      }
      mesh.setColorAt(i, new THREE.Color(tmp4a.x, tmp4a.y, tmp4a.z))
      instanceOpacity[i] = tmp4a.w

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
      mesh.setMatrixAt(i, m4)

      // Per-particle sprite frame from lifetime
      if (cfg.spriteSheet) {
        const total =
          cfg.spriteSheet.frameCount ??
          (cfg.spriteSheet.columns ?? 1) * (cfg.spriteSheet.rows ?? 1)
        const fps = cfg.spriteSheet.fps ?? 15
        const loop = cfg.spriteSheet.loop ?? true
        let frameF = ages[i] * fps
        if (loop) {
          frameF = frameF % total
        } else {
          frameF = Math.min(frameF, total - 0.01)
        }
        instanceFrame[i] = frameF
      }
    }

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

  return {
    object: mesh,
    update,
    burst,
    setSpawnRate,
    setOrigin,
    config: cfg,
    setTexture,
  }
}
