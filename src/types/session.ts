export interface FrameData {
  frameId: number
  timestamp: number
  /** angleGroup.id → value in degrees (angle) or pixels (distance) */
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
}
