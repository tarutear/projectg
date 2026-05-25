import type { DetectedMarker } from './marker'
import type { AngleResult } from './geometry'

export interface FrameData {
  timestamp: number
  frameIndex: number
  markers: DetectedMarker[]
  angles: AngleResult[]
  mmPerPx: number
}

export interface Rep {
  label: string
  startTime: number
  endTime: number | null
  frames: FrameData[]
}

export interface Session {
  sessionId: string
  createdAt: number
  reps: Rep[]
}
