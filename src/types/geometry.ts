export interface AngleGroup {
  id: string
  name: string
  proximalMarkerId: string
  apexMarkerId: string
  distalMarkerId: string
}

export interface AngleResult {
  groupId: string
  angleDeg: number
  timestamp: number
}
