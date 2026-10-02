import { create } from 'zustand'
import { useMarkerStore, type DetectorMode } from '@/store/markerStore'

/** Nominal physical marker radius (cm) per detector, used until the user calibrates. */
export const DEFAULT_MARKER_RADIUS_CM: Record<DetectorMode, number> = {
  yellow: 1.0,   // 2 cm diameter disc
  sticker: 0.3,  // 6 mm sticker (outer edge of the black ring)
}

export interface MarkerCalibration {
  /** Effective marker radius (cm) learned from a pair at a known distance */
  radiusCm: number
  /** Calibration only applies to the marker type it was taken with */
  detectorMode: DetectorMode
}

interface CoordinateStore {
  /** Record marker positions in cm relative to the first recorded frame's centroid */
  enabled: boolean
  calibration: MarkerCalibration | null

  toggle: () => void
  setCalibration: (c: MarkerCalibration) => void
  clearCalibration: () => void
}

export const useCoordinateStore = create<CoordinateStore>((set) => ({
  enabled: false,
  calibration: null,

  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setCalibration: (calibration) => set({ calibration }),
  clearCalibration: () => set({ calibration: null }),
}))

export function resolveMarkerRadiusCm(
  mode: DetectorMode,
  calibration: MarkerCalibration | null,
): number {
  return calibration?.detectorMode === mode ? calibration.radiusCm : DEFAULT_MARKER_RADIUS_CM[mode]
}

/** Marker radius (cm) currently used for px → cm conversion. */
export function useMarkerRadiusCm(): number {
  const mode        = useMarkerStore((s) => s.detectorMode)
  const calibration = useCoordinateStore((s) => s.calibration)
  return resolveMarkerRadiusCm(mode, calibration)
}
