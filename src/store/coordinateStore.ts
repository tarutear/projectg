import { create } from 'zustand'

export const MARKER_RADIUS_CM = 1.0  // half of 2cm diameter

interface CoordinateStore {
  enabled: boolean
  originPx: { x: number; y: number } | null
  pxPerCm: number | null
  /** User-set calibration: overrides auto-estimated scale when present */
  calibratedPxPerCm: number | null

  toggle: () => void
  setReference: (origin: { x: number; y: number }, pxPerCm: number) => void
  clearReference: () => void
  setCalibration: (pxPerCm: number) => void
  clearCalibration: () => void
}

export const useCoordinateStore = create<CoordinateStore>((set) => ({
  enabled: false,
  originPx: null,
  pxPerCm: null,
  calibratedPxPerCm: null,

  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setReference: (originPx, pxPerCm) => set({ originPx, pxPerCm }),
  clearReference: () => set({ originPx: null, pxPerCm: null }),
  setCalibration: (pxPerCm) => set({ calibratedPxPerCm: pxPerCm }),
  clearCalibration: () => set({ calibratedPxPerCm: null }),
}))

/** Estimate px-per-cm from visible marker radii. Returns null if no markers. */
export function estimatePxPerCm(radii: number[]): number | null {
  if (radii.length === 0) return null
  const avg = radii.reduce((s, r) => s + r, 0) / radii.length
  return avg / MARKER_RADIUS_CM
}

/**
 * Compute the effective px/cm scale for a distance pair.
 * Uses the average of each marker's individual radius-based scale,
 * which compensates for markers at different depths from the camera.
 * Falls back to calibratedPxPerCm when provided.
 */
export function pairScale(
  radiusA: number,
  radiusB: number,
  calibratedPxPerCm: number | null,
): number {
  if (calibratedPxPerCm) return calibratedPxPerCm
  return ((radiusA + radiusB) / 2) / MARKER_RADIUS_CM
}
