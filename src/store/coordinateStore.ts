import { create } from 'zustand'

export const MARKER_RADIUS_CM = 0.75  // half of 1.5cm diameter

interface CoordinateStore {
  enabled: boolean
  originPx: { x: number; y: number } | null
  pxPerCm: number | null

  toggle: () => void
  setReference: (origin: { x: number; y: number }, pxPerCm: number) => void
  clearReference: () => void
}

export const useCoordinateStore = create<CoordinateStore>((set) => ({
  enabled: false,
  originPx: null,
  pxPerCm: null,

  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setReference: (originPx, pxPerCm) => set({ originPx, pxPerCm }),
  clearReference: () => set({ originPx: null, pxPerCm: null }),
}))

/** Estimate px-per-cm from visible marker radii. Returns null if no markers. */
export function estimatePxPerCm(radii: number[]): number | null {
  if (radii.length === 0) return null
  const avg = radii.reduce((s, r) => s + r, 0) / radii.length
  return avg / MARKER_RADIUS_CM
}
