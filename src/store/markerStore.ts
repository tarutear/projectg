import { create } from 'zustand'
import type { TrackedMarker } from '@/lib/tracking/remapper'
import type { WorkerState } from '@/hooks/useVisionWorker'

export interface MarkerName {
  markerId: number
  name: string
}

interface MarkerStore {
  tracked: TrackedMarker[]
  confirmedIds: number[]
  names: MarkerName[]
  workerState: WorkerState
  latencyMs: number

  setTracked: (markers: TrackedMarker[]) => void
  confirmMarker: (id: number) => void
  unconfirmMarker: (id: number) => void
  setName: (markerId: number, name: string) => void
  removeName: (markerId: number) => void
  setWorkerState: (s: WorkerState) => void
  setLatency: (ms: number) => void
  resetTracking: () => void
  reset: () => void
}

export const useMarkerStore = create<MarkerStore>((set) => ({
  tracked: [],
  confirmedIds: [],
  names: [],
  workerState: 'idle',
  latencyMs: 0,

  setTracked: (tracked) => set({ tracked }),
  confirmMarker: (id) =>
    set((s) =>
      s.confirmedIds.includes(id) ? s : { confirmedIds: [...s.confirmedIds, id] }
    ),
  unconfirmMarker: (id) =>
    set((s) => ({ confirmedIds: s.confirmedIds.filter((i) => i !== id) })),
  setName: (markerId, name) =>
    set((s) => ({
      names: [...s.names.filter((n) => n.markerId !== markerId), { markerId, name }],
    })),
  removeName: (markerId) =>
    set((s) => ({ names: s.names.filter((n) => n.markerId !== markerId) })),
  setWorkerState: (workerState) => set({ workerState }),
  setLatency: (latencyMs) => set({ latencyMs }),
  // Reset tracking state (confirmedIds + tracked) while keeping marker names
  resetTracking: () => set({ tracked: [], confirmedIds: [] }),
  reset: () => set({ tracked: [], confirmedIds: [], names: [], latencyMs: 0 }),
}))
