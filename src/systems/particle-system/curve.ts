/**
 * Animation Curve System for Particle Effects
 *
 * Provides cubic Hermite interpolation similar to Unity's AnimationCurve.
 * Used for "X over Lifetime" properties like size, speed, opacity, rotation.
 */

/**
 * A single keyframe on an animation curve.
 */
export interface CurveKeyframe {
	/** Time position on the curve (0-1 normalized) */
	time: number
	/** Output value at this keyframe */
	value: number
	/** Left tangent slope (controls curve shape approaching this point) */
	inTangent: number
	/** Right tangent slope (controls curve shape leaving this point) */
	outTangent: number
}

/**
 * An animation curve defined by keyframes with tangent handles.
 */
export interface AnimationCurve {
	/** Sorted array of keyframes (by time) */
	keys: CurveKeyframe[]
}

/**
 * CurveableValue - a property that can be either a constant or a curve.
 * Used in EmitterConfig for properties that support "over lifetime" curves.
 */
export type CurveableValue = number | { curve: AnimationCurve }

/**
 * Evaluates an animation curve at a given time using cubic Hermite interpolation.
 *
 * @param curve - The animation curve to evaluate
 * @param t - Time value (typically 0-1 for particle lifetime)
 * @returns The interpolated value at time t
 */
export function evaluateCurve(curve: AnimationCurve, t: number): number {
	const keys = curve.keys

	// Handle edge cases
	if (keys.length === 0) {
		return 0
	}

	if (keys.length === 1) {
		return keys[0].value
	}

	// Clamp t to curve range
	const firstKey = keys[0]
	const lastKey = keys[keys.length - 1]

	if (t <= firstKey.time) {
		return firstKey.value
	}

	if (t >= lastKey.time) {
		return lastKey.value
	}

	// Find the segment containing t using binary search
	let left = 0
	let right = keys.length - 1

	while (right - left > 1) {
		const mid = Math.floor((left + right) / 2)
		if (keys[mid].time <= t) {
			left = mid
		} else {
			right = mid
		}
	}

	const k0 = keys[left]
	const k1 = keys[right]

	// Compute normalized position within segment
	const dt = k1.time - k0.time
	const u = dt > 0 ? (t - k0.time) / dt : 0

	// Cubic Hermite interpolation
	// H(u) = (2u³ - 3u² + 1)p0 + (u³ - 2u² + u)m0 + (-2u³ + 3u²)p1 + (u³ - u²)m1
	// where p0, p1 are values and m0, m1 are tangents scaled by segment duration

	const u2 = u * u
	const u3 = u2 * u

	const h00 = 2 * u3 - 3 * u2 + 1 // Hermite basis function for p0
	const h10 = u3 - 2 * u2 + u // Hermite basis function for m0
	const h01 = -2 * u3 + 3 * u2 // Hermite basis function for p1
	const h11 = u3 - u2 // Hermite basis function for m1

	// Scale tangents by segment duration
	const m0 = k0.outTangent * dt
	const m1 = k1.inTangent * dt

	return h00 * k0.value + h10 * m0 + h01 * k1.value + h11 * m1
}

/**
 * Evaluates a CurveableValue (constant or curve) at a given time.
 *
 * @param value - Either a constant number or an object with a curve
 * @param t - Time value (0-1 for particle lifetime)
 * @param defaultValue - Value to return if value is undefined
 * @returns The evaluated value
 */
export function evaluateCurveableValue(
	value: CurveableValue | undefined,
	t: number,
	defaultValue: number = 1
): number {
	if (value === undefined) {
		return defaultValue
	}

	if (typeof value === 'number') {
		return value
	}

	return evaluateCurve(value.curve, t)
}

/**
 * Creates a keyframe with auto-calculated tangents for smooth interpolation.
 */
export function createKeyframe(
	time: number,
	value: number,
	inTangent: number = 0,
	outTangent: number = 0
): CurveKeyframe {
	return { time, value, inTangent, outTangent }
}

/**
 * Creates a simple curve from an array of [time, value] pairs.
 * Tangents are automatically calculated for smooth interpolation.
 */
export function createCurveFromPoints(
	points: Array<[number, number]>
): AnimationCurve {
	if (points.length === 0) {
		return { keys: [createKeyframe(0, 1, 0, 0)] }
	}

	if (points.length === 1) {
		return { keys: [createKeyframe(points[0][0], points[0][1], 0, 0)] }
	}

	// Sort points by time
	const sorted = [...points].sort((a, b) => a[0] - b[0])

	// Create keyframes with auto-smooth tangents
	const keys: CurveKeyframe[] = sorted.map((point, i) => {
		const [time, value] = point

		// Calculate tangent using Catmull-Rom style
		let tangent = 0

		if (i === 0) {
			// First point: use slope to next point
			const next = sorted[i + 1]
			tangent = (next[1] - value) / (next[0] - time || 1)
		} else if (i === sorted.length - 1) {
			// Last point: use slope from previous point
			const prev = sorted[i - 1]
			tangent = (value - prev[1]) / (time - prev[0] || 1)
		} else {
			// Middle point: average of slopes
			const prev = sorted[i - 1]
			const next = sorted[i + 1]
			const slopeBefore = (value - prev[1]) / (time - prev[0] || 1)
			const slopeAfter = (next[1] - value) / (next[0] - time || 1)
			tangent = (slopeBefore + slopeAfter) / 2
		}

		return createKeyframe(time, value, tangent, tangent)
	})

	return { keys }
}

/**
 * Preset curve factories for common curve shapes.
 */
export const CurvePresets = {
	/**
	 * Linear curve from 0 to 1
	 */
	linear(): AnimationCurve {
		return {
			keys: [createKeyframe(0, 0, 1, 1), createKeyframe(1, 1, 1, 1)],
		}
	},

	/**
	 * Linear curve from 1 to 0 (inverse)
	 */
	linearInverse(): AnimationCurve {
		return {
			keys: [createKeyframe(0, 1, -1, -1), createKeyframe(1, 0, -1, -1)],
		}
	},

	/**
	 * Constant value curve
	 */
	constant(value: number = 1): AnimationCurve {
		return {
			keys: [createKeyframe(0, value, 0, 0), createKeyframe(1, value, 0, 0)],
		}
	},

	/**
	 * Ease-in curve (slow start, fast end)
	 */
	easeIn(): AnimationCurve {
		return {
			keys: [createKeyframe(0, 0, 0, 0), createKeyframe(1, 1, 2, 2)],
		}
	},

	/**
	 * Ease-out curve (fast start, slow end)
	 */
	easeOut(): AnimationCurve {
		return {
			keys: [createKeyframe(0, 0, 2, 2), createKeyframe(1, 1, 0, 0)],
		}
	},

	/**
	 * Ease-in-out curve (smooth S-curve)
	 */
	easeInOut(): AnimationCurve {
		return {
			keys: [createKeyframe(0, 0, 0, 0), createKeyframe(1, 1, 0, 0)],
		}
	},

	/**
	 * Bell curve (starts at 0, peaks at 1 in middle, returns to 0)
	 */
	bell(): AnimationCurve {
		return {
			keys: [
				createKeyframe(0, 0, 0, 2),
				createKeyframe(0.5, 1, 0, 0),
				createKeyframe(1, 0, -2, 0),
			],
		}
	},

	/**
	 * Fade-in curve (0 to 1 with smooth ramp)
	 */
	fadeIn(): AnimationCurve {
		return {
			keys: [
				createKeyframe(0, 0, 0, 0),
				createKeyframe(0.3, 1, 2, 0),
				createKeyframe(1, 1, 0, 0),
			],
		}
	},

	/**
	 * Fade-out curve (1 to 0 with smooth ramp)
	 */
	fadeOut(): AnimationCurve {
		return {
			keys: [
				createKeyframe(0, 1, 0, 0),
				createKeyframe(0.7, 1, 0, -2),
				createKeyframe(1, 0, 0, 0),
			],
		}
	},

	/**
	 * Bounce curve (oscillating decay)
	 */
	bounce(): AnimationCurve {
		return {
			keys: [
				createKeyframe(0, 1, 0, -4),
				createKeyframe(0.25, 0.3, 0, 0),
				createKeyframe(0.5, 0.7, 0, 0),
				createKeyframe(0.75, 0.5, 0, 0),
				createKeyframe(1, 0.6, 0, 0),
			],
		}
	},
}

/**
 * Clones an animation curve (deep copy).
 */
export function cloneCurve(curve: AnimationCurve): AnimationCurve {
	return {
		keys: curve.keys.map((k) => ({ ...k })),
	}
}

/**
 * Adds a keyframe to a curve at the specified time.
 * The curve is re-sorted after insertion.
 */
export function addKeyframe(
	curve: AnimationCurve,
	keyframe: CurveKeyframe
): AnimationCurve {
	const newKeys = [...curve.keys, keyframe].sort((a, b) => a.time - b.time)
	return { keys: newKeys }
}

/**
 * Removes a keyframe at the specified index.
 */
export function removeKeyframe(
	curve: AnimationCurve,
	index: number
): AnimationCurve {
	if (curve.keys.length <= 1) {
		// Don't remove the last keyframe
		return curve
	}
	const newKeys = curve.keys.filter((_, i) => i !== index)
	return { keys: newKeys }
}

/**
 * Updates a keyframe at the specified index.
 */
export function updateKeyframe(
	curve: AnimationCurve,
	index: number,
	updates: Partial<CurveKeyframe>
): AnimationCurve {
	const newKeys = curve.keys.map((k, i) => (i === index ? { ...k, ...updates } : k))
	// Re-sort if time changed
	if (updates.time !== undefined) {
		newKeys.sort((a, b) => a.time - b.time)
	}
	return { keys: newKeys }
}
