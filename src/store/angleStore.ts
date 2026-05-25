import { create } from 'zustand'

export type GroupType = 'angle' | 'distance'

export interface AngleGroup {
  id: string
  name: string
  type: GroupType
  // 3 marker IDs for angle (proximal, vertex, distal); 2 for distance
  markerIds: number[]
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
