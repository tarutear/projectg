import type { DetectorMode } from '@/store/markerStore'

export interface FrameData {
  frameId: number
  timestamp: number
  /** angleGroup.id → value in degrees (angle) or distanceUnit (distance) */
  angles: Record<string, number>
  markerPositions: Record<number, { x: number; y: number }>
}

export interface Session {
  id: string
  name: string
  startedAt: number
  endedAt?: number
  frames: FrameData[]
  /** true when recorded with reference coordinate mode (x right=+, y up=+, unit=cm) */
  coordMode?: boolean
  /** Unit of distance values; absent in older sessions (see sessionDistanceUnit) */
  distanceUnit?: 'cm' | 'px'
  /** Marker radius (cm) used for px → cm conversion */
  markerRadiusCm?: number
  /** true when markerRadiusCm came from a calibration rather than the detector default */
  calibrated?: boolean
  detectorMode?: DetectorMode
}
