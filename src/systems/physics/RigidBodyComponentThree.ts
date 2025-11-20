import * as THREE from "three"
import { Component, GameObject } from "@engine/core"
import { PhysicsSystem } from "./PhysicsSystem"
//
import {
    ActiveCollisionTypes,
    ActiveEvents,
    Collider,
    ColliderDesc,
    Cuboid,
    RigidBody,
    RigidBodyDesc,
    ShapeType,
} from "@dimforge/rapier3d"

export enum RigidBodyType {
    DYNAMIC = "dynamic",
    STATIC = "static",
    KINEMATIC = "kinematic",
}

export enum ColliderShape {
    BOX = "box",
    SPHERE = "sphere",
    CAPSULE = "capsule",
}

// General collision group utilities (game-agnostic)

// Helper function to create collision group value (membership in high 16 bits, filter in low 16 bits)
export function createCollisionGroup(
    membership: number,
    filter: number,
): number {
    return (membership << 16) | filter
}

export interface RigidBodyOptions {
    type?: RigidBodyType
    shape?: ColliderShape
    size?: THREE.Vector3 // For box: width, height, depth
    radius?: number // For sphere/capsule
    height?: number // For capsule
    mass?: number
    restitution?: number // Bounciness
    friction?: number
    isSensor?: boolean // For trigger colliders

    // Auto-sizing from mesh bounds
    fitToMesh?: boolean // If true, automatically calculate size from mesh bounds

    // Collider center positioning
    centerOffset?: THREE.Vector3 // Offset for collider center relative to GameObject

    // Damping for smoother movement
    linearDamping?: number // Damping for linear velocity (0-1, higher = more damping)
    angularDamping?: number // Damping for angular velocity (0-1, higher = more damping)

    // Rotation locking options
    lockRotationX?: boolean // Lock rotation around X axis
    lockRotationY?: boolean // Lock rotation around Y axis
    lockRotationZ?: boolean // Lock rotation around Z axis

    // Translation locking options
    lockTranslationX?: boolean // Lock translation along X axis
    lockTranslationY?: boolean // Lock translation along Y axis
    lockTranslationZ?: boolean // Lock translation along Z axis

    // Collision event generation (automatically handles ActiveEvents + ActiveCollisionTypes)
    enableCollisionEvents?: boolean // Enable collision events (defaults: true for kinematic/dynamic, false for static)

    // Collision groups for filtering interactions (16-bit membership + 16-bit filter)
    collisionGroups?: number // Packed 32-bit: membership (high 16 bits) + filter (low 16 bits)
}

/**
 * Simple component for adding Rapier physics to GameObjects
 * Automatically syncs GameObject position with physics body
 */
export class RigidBodyComponentThree extends Component {
    private rigidBody: RigidBody | null = null
    private collider: Collider | null = null
    private options: RigidBodyOptions
    private bodyId: string

    // Trigger event callbacks - use proper type for GameObject
    private onTriggerEnterCallback: ((other: any) => void) | null = null
    private onTriggerExitCallback: ((other: any) => void) | null = null
    private isRegisteredWithPhysics: boolean = false

    constructor(options: RigidBodyOptions = {}) {
        super()
        this.options = {
            type: RigidBodyType.DYNAMIC,
            shape: ColliderShape.BOX,
            size: new THREE.Vector3(1, 1, 1),
            radius: 0.5,
            height: 1,
            mass: 1,
            restitution: 0.2,
            friction: 0.5,
            isSensor: false,
            linearDamping: 0.0, // Default no damping
            angularDamping: 0.0, // Default no damping
            ...options,
        }

        // Generate unique ID for this physics body
        this.bodyId = `rb_${Math.random().toString(36).substr(2, 9)}`
    }

    protected onCreate(): void {
        if (!PhysicsSystem.isReady()) {
            console.warn(
                "⚠️ PhysicsSystem not ready - physics body will not be created",
            )
            return
        }

        this.createPhysicsBody()

        if (this.rigidBody) {
            // Apply rotation locking after body creation
            if (
                this.options.lockRotationX ||
                this.options.lockRotationY ||
                this.options.lockRotationZ
            ) {
                // Enable/disable rotations - false means locked
                this.rigidBody.setEnabledRotations(
                    !this.options.lockRotationX, // if lockRotationX is true, enable should be false
                    !this.options.lockRotationY,
                    !this.options.lockRotationZ,
                    true, // wake up
                )
            }

            // Apply translation locking after body creation
            if (
                this.options.lockTranslationX ||
                this.options.lockTranslationY ||
                this.options.lockTranslationZ
            ) {
                // Enable/disable translations - false means locked
                this.rigidBody.setEnabledTranslations(
                    !this.options.lockTranslationX, // if lockTranslationX is true, enable should be false
                    !this.options.lockTranslationY,
                    !this.options.lockTranslationZ,
                    true, // wake up
                )
            }

            // Set initial enabled state based on GameObject's enabled state
            this.setEnabled(this.gameObject.isEnabled())

            // Always register GameObject mapping (for collision detection)
            PhysicsSystem.registerGameObject(this.bodyId, this.gameObject)

            // Physics body created
        } else {
            console.error(
                `❌ Failed to create rigid body for ${this.gameObject.name}`,
            )
        }
    }

    private createPhysicsBody(): void {
        // Create rigid body descriptor
        let bodyDesc: RigidBodyDesc

        switch (this.options.type) {
            case RigidBodyType.STATIC:
                bodyDesc = RigidBodyDesc.fixed()
                break
            case RigidBodyType.KINEMATIC:
                bodyDesc = RigidBodyDesc.kinematicPositionBased()
                break
            case RigidBodyType.DYNAMIC:
            default:
                bodyDesc = RigidBodyDesc.dynamic()
                break
        }

        // Set initial position from GameObject with proper offset for mesh-based objects
        // Use world position to account for parent transformations (important for child objects)
        // Update matrix world first to ensure transforms are current
        this.gameObject.updateMatrixWorld(true)
        const pos = this.gameObject.getWorldPosition(new THREE.Vector3())

        // Calculate collider center offset
        let yOffset = 0

        // Use custom center offset if provided
        if (this.options.centerOffset) {
            yOffset = this.options.centerOffset.y
        } else {
            // Default behavior: offset by half the height so bottom sits at GameObject position
            // For box shapes, offset by half the height so bottom sits at GameObject position
            if (this.options.shape === ColliderShape.BOX) {
                yOffset = this.options.size!.y / 2
            }
            // For capsules, offset by half height so bottom sits at GameObject position
            else if (this.options.shape === ColliderShape.CAPSULE) {
                yOffset = this.options.height! / 2
            }
            // For spheres, offset by radius so bottom sits at GameObject position
            else if (this.options.shape === ColliderShape.SPHERE) {
                yOffset = this.options.radius!
            }
        }

        bodyDesc.setTranslation(pos.x, pos.y + yOffset, pos.z)

        // Set initial rotation from GameObject
        // Use world rotation to account for parent transformations (important for child objects)
        const worldQuat = this.gameObject.getWorldQuaternion(
            new THREE.Quaternion(),
        )
        bodyDesc.setRotation({
            x: worldQuat.x,
            y: worldQuat.y,
            z: worldQuat.z,
            w: worldQuat.w,
        })

        // Calculate size from mesh bounds if requested
        if (this.options.fitToMesh) {
            const meshBounds = RigidBodyComponentThree.getMeshBounds(
                this.gameObject,
            )
            this.options.size = meshBounds

            // For sphere and capsule, calculate radius/height from bounds
            if (this.options.shape === ColliderShape.SPHERE) {
                this.options.radius =
                    Math.max(meshBounds.x, meshBounds.y, meshBounds.z) / 2
            } else if (this.options.shape === ColliderShape.CAPSULE) {
                this.options.height = meshBounds.y
                this.options.radius = Math.max(meshBounds.x, meshBounds.z) / 2
            }
        }

        // Create collider descriptor
        let colliderDesc: ColliderDesc

        switch (this.options.shape) {
            case ColliderShape.SPHERE:
                colliderDesc = ColliderDesc.ball(this.options.radius!)
                break
            case ColliderShape.CAPSULE:
                colliderDesc = ColliderDesc.capsule(
                    this.options.height! / 2,
                    this.options.radius!,
                )
                break
            case ColliderShape.BOX:
            default:
                const size = this.options.size!
                colliderDesc = ColliderDesc.cuboid(
                    size.x / 2,
                    size.y / 2,
                    size.z / 2,
                )
                break
        }

        // Set collider properties
        colliderDesc.setRestitution(this.options.restitution!)
        colliderDesc.setFriction(this.options.friction!)
        colliderDesc.setSensor(this.options.isSensor!)

        // Auto-configure collision events based on body type (smart defaults)
        const shouldEnableCollisionEvents =
            this.options.enableCollisionEvents ??
            this.options.type !== RigidBodyType.STATIC // Default: true for kinematic/dynamic, false for static

        if (shouldEnableCollisionEvents) {
            // Enable collision events for all interactions
            colliderDesc.setActiveEvents(ActiveEvents.COLLISION_EVENTS)

            // For kinematic bodies, also enable collision with static bodies (sensors)
            if (this.options.type === RigidBodyType.KINEMATIC) {
                colliderDesc.setActiveCollisionTypes(
                    ActiveCollisionTypes.DEFAULT |
                        ActiveCollisionTypes.KINEMATIC_FIXED,
                )
            }
        }

        // Set collision groups if specified (for filtering what can collide with what)
        if (this.options.collisionGroups !== undefined) {
            colliderDesc.setCollisionGroups(this.options.collisionGroups)
        }

        // Create the physics body
        const result = PhysicsSystem.createRigidBody(
            this.bodyId,
            bodyDesc,
            colliderDesc,
        )

        if (result) {
            this.rigidBody = result.rigidBody
            this.collider = result.collider!

            // Set mass for dynamic bodies
            if (this.options.type === RigidBodyType.DYNAMIC) {
                this.rigidBody.setAdditionalMass(this.options.mass!, true)

                // Apply damping for smoother movement
                if (
                    this.options.linearDamping !== undefined &&
                    this.options.linearDamping > 0
                ) {
                    this.rigidBody.setLinearDamping(this.options.linearDamping)
                }
                if (
                    this.options.angularDamping !== undefined &&
                    this.options.angularDamping > 0
                ) {
                    this.rigidBody.setAngularDamping(
                        this.options.angularDamping,
                    )
                }
            }
        }
    }

    /**
     * Update syncs between GameObject and physics body based on rigidbody type
     * - DYNAMIC: Physics drives GameObject position (physics simulation)
     * - KINEMATIC: GameObject drives physics position (nav agents, scripts)
     * - STATIC: No updates needed
     */
    public update(_: number): void {
        if (!this.rigidBody) return

        if (this.options.type === RigidBodyType.DYNAMIC) {
            // DYNAMIC: Update GameObject position from physics body
            // Interpolate between previous and current physics states for smooth visuals
            const alpha = PhysicsSystem.getInterpolationAlpha?.() ?? 1

            // Current transform
            const curPos = this.rigidBody.translation()
            const curRot = this.rigidBody.rotation()

            // For simplicity, use body's predicted next position by integrating linear velocity
            // This gives a lightweight approximation for interpolation when alpha > 0
            const linvel = this.rigidBody.linvel()
            const angvel = this.rigidBody.angvel()
            const h = (PhysicsSystem as any).fixedTimeStep || 1 / 120

            const nextPos = new THREE.Vector3(
                curPos.x + linvel.x * h,
                curPos.y + linvel.y * h,
                curPos.z + linvel.z * h,
            )

            const curQuat = new THREE.Quaternion(
                curRot.x,
                curRot.y,
                curRot.z,
                curRot.w,
            )
            const angAxis = new THREE.Vector3(angvel.x, angvel.y, angvel.z)
            const angSpeed = angAxis.length()
            const nextQuat = curQuat.clone()
            if (angSpeed > 0.0001) {
                angAxis.normalize()
                const angle = angSpeed * h
                const deltaQ = new THREE.Quaternion().setFromAxisAngle(
                    angAxis,
                    angle,
                )
                nextQuat.multiply(deltaQ).normalize()
            }

            // Lerp/Slerp by alpha
            const lerpPos = new THREE.Vector3(
                curPos.x,
                curPos.y,
                curPos.z,
            ).lerp(nextPos, alpha)
            const slerpQuat = curQuat.clone().slerp(nextQuat, alpha)

            // Apply centerOffset compensation for DYNAMIC bodies
            // Physics body center is offset, but GameObject should represent feet/bottom position
            if (this.options.centerOffset) {
                lerpPos.y -= this.options.centerOffset.y
            } else {
                // Default behavior: compensate for automatic center offset
                let defaultYOffset = 0
                if (this.options.shape === ColliderShape.BOX) {
                    defaultYOffset = this.options.size!.y / 2
                } else if (this.options.shape === ColliderShape.CAPSULE) {
                    defaultYOffset = this.options.height! / 2
                } else if (this.options.shape === ColliderShape.SPHERE) {
                    defaultYOffset = this.options.radius!
                }
                lerpPos.y -= defaultYOffset
            }

            this.gameObject.position.copy(lerpPos)
            this.gameObject.quaternion.copy(slerpQuat)
        } else if (this.options.type === RigidBodyType.KINEMATIC) {
            // KINEMATIC: Update physics body position from GameObject
            // This is for nav agents, scripted movement, etc.

            // For kinematic bodies, we need to account for the physics body center offset
            const position = this.gameObject.position
            const quaternion = this.gameObject.quaternion

            // Calculate the physics body center offset
            let yOffset = 0

            // Use custom center offset if provided
            if (this.options.centerOffset) {
                yOffset = this.options.centerOffset.y
            } else {
                // Default behavior: For capsules and cylinders, center at half the height above GameObject
                if (
                    this.options.shape === ColliderShape.CAPSULE ||
                    this.options.shape === ColliderShape.BOX
                ) {
                    // Use height if specified, otherwise use size.y, otherwise default to half of 3 (matching visual mesh)
                    const height =
                        this.options.height || this.options.size?.y || 3
                    yOffset = height / 2
                }
            }

            // Update physics body position with offset
            this.rigidBody.setTranslation(
                {
                    x: position.x,
                    y: position.y + yOffset,
                    z: position.z,
                },
                true,
            )
            this.rigidBody.setRotation(
                {
                    x: quaternion.x,
                    y: quaternion.y,
                    z: quaternion.z,
                    w: quaternion.w,
                },
                true,
            )
        }

        // STATIC bodies don't need updates - they never move
    }

    /**
     * Apply force to the rigid body
     */
    public applyForce(force: THREE.Vector3, point?: THREE.Vector3): void {
        if (!this.rigidBody || this.options.type !== RigidBodyType.DYNAMIC)
            return

        if (point) {
            this.rigidBody.addForceAtPoint(
                { x: force.x, y: force.y, z: force.z },
                { x: point.x, y: point.y, z: point.z },
                true,
            )
        } else {
            this.rigidBody.addForce(
                { x: force.x, y: force.y, z: force.z },
                true,
            )
        }
    }

    /**
     * Apply impulse to the rigid body
     */
    public applyImpulse(impulse: THREE.Vector3, point?: THREE.Vector3): void {
        if (!this.rigidBody || this.options.type !== RigidBodyType.DYNAMIC)
            return

        if (point) {
            this.rigidBody.applyImpulseAtPoint(
                { x: impulse.x, y: impulse.y, z: impulse.z },
                { x: point.x, y: point.y, z: point.z },
                true,
            )
        } else {
            this.rigidBody.applyImpulse(
                { x: impulse.x, y: impulse.y, z: impulse.z },
                true,
            )
        }
    }

    /**
     * Set the velocity of the rigid body
     */
    public setVelocity(velocity: THREE.Vector3): void {
        if (this.rigidBody && this.options.type === RigidBodyType.DYNAMIC) {
            this.rigidBody.setLinvel(
                { x: velocity.x, y: velocity.y, z: velocity.z },
                true,
            )
        }
    }

    /**
     * Get linear velocity
     */
    public getVelocity(): THREE.Vector3 {
        if (!this.rigidBody) return new THREE.Vector3()

        const vel = this.rigidBody.linvel()
        return new THREE.Vector3(vel.x, vel.y, vel.z)
    }

    /**
     * Set angular velocity
     */
    public setAngularVelocity(velocity: THREE.Vector3): void {
        if (!this.rigidBody || this.options.type !== RigidBodyType.DYNAMIC)
            return

        this.rigidBody.setAngvel(
            { x: velocity.x, y: velocity.y, z: velocity.z },
            true,
        )
    }

    /**
     * Get the rigid body for advanced operations
     */
    public getRigidBody(): RigidBody | null {
        return this.rigidBody
    }

    /**
     * Get the collider for advanced operations
     */
    public getCollider(): Collider | null {
        return this.collider
    }

    /**
     * Enable/disable the rigid body
     */
    public setEnabled(enabled: boolean): void {
        if (!this.rigidBody) return

        this.rigidBody.setEnabled(enabled)
        // Physics body enabled/disabled
    }

    /**
     * Check if the rigid body is enabled
     */
    public isEnabled(): boolean {
        if (!this.rigidBody) return false

        return this.rigidBody.isEnabled()
    }

    /**
     * Get the unique body ID for this physics body
     */
    public getBodyId(): string {
        return this.bodyId
    }

    /**
     * Register a callback for when objects enter this trigger
     * @param callback Function to call when an object enters this trigger
     */
    public registerOnTriggerEnter(callback: (other: any) => void): void {
        this.onTriggerEnterCallback = callback
        this.ensureRegisteredWithPhysicsSystem()
    }

    /**
     * Register a callback for when objects exit this trigger
     * @param callback Function to call when an object exits this trigger
     */
    public registerOnTriggerExit(callback: (other: any) => void): void {
        this.onTriggerExitCallback = callback
        this.ensureRegisteredWithPhysicsSystem()
    }

    /**
     * Unregister trigger enter callback
     */
    public unregisterOnTriggerEnter(): void {
        this.onTriggerEnterCallback = null
        this.checkIfShouldUnregisterFromPhysics()
    }

    /**
     * Unregister trigger exit callback
     */
    public unregisterOnTriggerExit(): void {
        this.onTriggerExitCallback = null
        this.checkIfShouldUnregisterFromPhysics()
    }

    /**
     * Called by physics system when an object enters this trigger
     */
    public onTriggerEnter(other: any): void {
        if (this.onTriggerEnterCallback) {
            this.onTriggerEnterCallback(other)
        }
    }

    /**
     * Called by physics system when an object exits this trigger
     */
    public onTriggerExit(other: any): void {
        if (this.onTriggerExitCallback) {
            this.onTriggerExitCallback(other)
        }
    }

    /**
     * Ensure this RigidBody is registered with physics system if it has any trigger callbacks
     */
    private ensureRegisteredWithPhysicsSystem(): void {
        if (
            (this.onTriggerEnterCallback || this.onTriggerExitCallback) &&
            !this.isRegisteredWithPhysics
        ) {
            PhysicsSystem.registerTriggerComponent(this.bodyId, this)
            this.isRegisteredWithPhysics = true
        }
    }

    /**
     * Check if we should unregister from physics system (no more callbacks)
     */
    private checkIfShouldUnregisterFromPhysics(): void {
        if (
            !this.onTriggerEnterCallback &&
            !this.onTriggerExitCallback &&
            this.isRegisteredWithPhysics
        ) {
            PhysicsSystem.unregisterTriggerComponent(this.bodyId)
            this.isRegisteredWithPhysics = false
        }
    }

    /**
     * Create a RigidBodyComponent from bounds size
     * @param bounds The size vector from renderer.getBounds()
     * @param options Physics options (size will be overridden by bounds)
     * @returns A new RigidBodyComponentThree with bounds-fitted size
     */
    public static fromBounds(
        bounds: THREE.Vector3,
        options: Omit<RigidBodyOptions, "fitToMesh" | "size"> = {},
    ): RigidBodyComponentThree {
        return new RigidBodyComponentThree({
            ...options,
            size: bounds,
        })
    }

    /**
     * Get the bounding box dimensions of all meshes in a GameObject hierarchy
     * @param gameObject The GameObject to analyze
     * @returns Vector3 containing width, height, depth of the combined mesh bounds
     */
    public static getMeshBounds(gameObject: GameObject): THREE.Vector3 {
        // Fallback: calculate bounds from instantiated meshes
        const boundingBox = new THREE.Box3()
        let meshCount = 0

        // Force update world matrix first
        gameObject.updateMatrixWorld(true)

        console.log(`🔍 Analyzing mesh bounds for ${gameObject.name}...`)

        // Calculate bounding box for all meshes in the hierarchy
        gameObject.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                meshCount++
                console.log(`  📦 Found mesh: ${child.name || "unnamed"}`)

                // Ensure geometry has bounding box computed
                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox()
                }

                if (child.geometry.boundingBox) {
                    // Get local bounding box size for debugging
                    const localSize = new THREE.Vector3()
                    child.geometry.boundingBox.getSize(localSize)
                    console.log(`    Local geometry size:`, localSize)

                    // Transform bounding box to world space
                    child.updateMatrixWorld(true)
                    const transformedBox = child.geometry.boundingBox
                        .clone()
                        .applyMatrix4(child.matrixWorld)

                    // Get transformed size for debugging
                    const transformedSize = new THREE.Vector3()
                    transformedBox.getSize(transformedSize)
                    console.log(`    World transformed size:`, transformedSize)

                    boundingBox.union(transformedBox)
                } else {
                    console.warn(`    No bounding box for mesh: ${child.name}`)
                }
            }
        })

        console.log(`  📊 Total meshes found: ${meshCount}`)

        // If no meshes found, return default size
        if (boundingBox.isEmpty()) {
            console.warn(
                `❌ No meshes found in ${gameObject.name}, using default size (2,2,2)`,
            )
            return new THREE.Vector3(2, 2, 2) // Larger default
        }

        // Return the size (not the bounds)
        const size = new THREE.Vector3()
        boundingBox.getSize(size)

        console.log(`📏 Final calculated bounds for ${gameObject.name}:`, size)
        console.log(`📏 Bounding box min:`, boundingBox.min)
        console.log(`📏 Bounding box max:`, boundingBox.max)

        return size
    }

    /**
     * Called when GameObject becomes enabled
     */
    public onEnabled(): void {
        // Enhanced logging for debugging table physics issue
        if (
            this.gameObject.name.includes("Station") ||
            this.gameObject.name.includes("Player") ||
            this.gameObject.name.includes("Table")
        ) {
            // Physics enabled
        }
        this.setEnabled(true)
    }

    public getBounds(): THREE.Box3 {
        // TODO: Handle other shapes
        // TODO: Handle MULTIPLE colliders
        const bounds = new THREE.Box3()
        if (!this.collider) return bounds

        const shape = this.collider.shape
        if (shape.type === ShapeType.Cuboid) {
            const cuboid = shape as Cuboid
            const halfExtents = cuboid.halfExtents

            // Center is at 0,0,0
            const center = new THREE.Vector3(); // THREE.Vector3

            bounds.min.set(
                center.x - halfExtents.x,
                center.y - halfExtents.y,
                center.z - halfExtents.z
            );

            bounds.max.set(
                center.x + halfExtents.x,
                center.y + halfExtents.y,
                center.z + halfExtents.z
            );
        }

        return bounds;
    }

    /**
     * Called when GameObject becomes disabled
     */
    public onDisabled(): void {
        // Enhanced logging for debugging table physics issue
        if (
            this.gameObject.name.includes("Station") ||
            this.gameObject.name.includes("Player") ||
            this.gameObject.name.includes("Table")
        ) {
            // Physics disabled
        }
        this.setEnabled(false)
    }

    protected onCleanup(): void {
        if (this.bodyId) {
            // Always unregister GameObject mapping
            PhysicsSystem.unregisterGameObject(this.bodyId)

            // Unregister trigger callbacks
            this.unregisterOnTriggerEnter()
            this.unregisterOnTriggerExit()

            // Reset registration flag
            this.isRegisteredWithPhysics = false

            PhysicsSystem.removeRigidBody(this.bodyId)
        }

        this.rigidBody = null
        this.collider = null
    }
}
