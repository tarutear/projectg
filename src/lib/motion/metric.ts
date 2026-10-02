import type { Point2D } from './geometry'
import type { Session } from '@/types/session'

export interface FrameSize { width: number; height: number }

interface MetricMarker {
  x: number
  y: number
  radius: number
  missingFrames?: number
}

// Typical frame-to-frame radius noise (px). Radius differences within this are treated as noise,
// not as a depth difference between the two markers.
const RADIUS_NOISE_PX = 0.3

/**
 * Image point → cm in the plane of that marker (pinhole model, principal point at frame centre).
 * Each marker's own apparent radius is its depth cue: cm-per-px at that depth = R / r.
 * Since (u - cx) = f·X/Z and r = f·R/Z, (u - cx)·R/r = X — independent of camera distance.
 */
export function markerPlaneCm(m: MetricMarker, frame: FrameSize, radiusCm: number): Point2D {
  const k = radiusCm / m.radius
  return { x: (m.x - frame.width / 2) * k, y: (m.y - frame.height / 2) * k }
}

/**
 * Depth-compensated distance (cm) between two markers, measured in the plane parallel to the sensor.
 * Returns null when either marker is a ghost (not detected this frame) or has no usable radius.
 *
 * The per-marker difference R·(ub/rb − ua/ra) splits exactly into a pair-scale term R·inv·(ub − ua)
 * and a depth-difference term R·half·(ua + ub) (offsets u from the frame centre). The second term
 * multiplies radius error by the pair's distance from the centre, so it is weighted by how far the
 * radius difference stands above noise: same-depth pairs stay low-noise, real depth gaps are corrected.
 */
export function pairDistanceCm(
  a: MetricMarker,
  b: MetricMarker,
  frame: FrameSize,
  radiusCm: number,
): number | null {
  if ((a.missingFrames ?? 0) > 0 || (b.missingFrames ?? 0) > 0) return null
  if (a.radius <= 0 || b.radius <= 0) return null
  const ia = 1 / a.radius, ib = 1 / b.radius
  const inv  = (ia + ib) / 2
  const half = (ib - ia) / 2
  const dr = (a.radius - b.radius) / 2
  const w  = (dr * dr) / (dr * dr + RADIUS_NOISE_PX * RADIUS_NOISE_PX)
  const cx = frame.width / 2, cy = frame.height / 2
  const ax = a.x - cx, ay = a.y - cy, bx = b.x - cx, by = b.y - cy
  const dx = radiusCm * (inv * (bx - ax) + w * half * (bx + ax))
  const dy = radiusCm * (inv * (by - ay) + w * half * (by + ay))
  return Math.hypot(dx, dy)
}

/** Unit of stored distance values. Sessions recorded before distanceUnit existed stored px unless coordMode was on. */
export function sessionDistanceUnit(s: Session): 'cm' | 'px' {
  return s.distanceUnit ?? (s.coordMode ? 'cm' : 'px')
}
