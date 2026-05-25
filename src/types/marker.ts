export interface Point {
  x: number
  y: number
}

export interface DetectedMarker {
  id: string
  label: string
  center: Point
  radiusPx: number
  confidence: number
  occluded: boolean
  interpolated: boolean
}

export interface MarkerLabel {
  id: string
  label: string
}
