import { create } from 'zustand'

export type GroupType = 'angle' | 'distance'
export type AngleVariant = 'interior' | 'supplement'

export interface AngleGroup {
  id: string
  name: string
  type: GroupType
  markerIds: number[]
  /** Index into markerIds that is the vertex (default 1 = middle) */
  vertexIndex?: 0 | 1 | 2
  /** interior: 0-180°  supplement: 180° - interior (default interior) */
  angleVariant?: AngleVariant
}

interface AngleStore {
  groups: AngleGroup[]
  mmPerPx: number | null

  addGroup: (g: AngleGroup) => void
  removeGroup: (id: string) => void
  setMmPerPx: (v: number) => void
}

export const useAngleStore = create<AngleStore>((set) => ({
  groups: [],
  mmPerPx: null,

  addGroup: (g) => set((s) => ({ groups: [...s.groups, g] })),
  removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),
  setMmPerPx: (mmPerPx) => set({ mmPerPx }),
}))
