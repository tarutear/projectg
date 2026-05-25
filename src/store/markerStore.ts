import { create } from 'zustand'
import type { TrackedMarker } from '@/lib/tracking/remapper'
import type { WorkerState } from '@/hooks/useVisionWorker'

export interface MarkerName {
  markerId: number
  name: string
}

export interface ManualMarker {
  id: number
  x: number
  y: number
  radius: number
}

interface MarkerStore {
  tracked: TrackedMarker[]
  names: MarkerName[]
  manual: ManualMarker[]
  workerState: WorkerState
  latencyMs: number

  setTracked: (markers: TrackedMarker[]) => void
  setName: (markerId: number, name: string) => void
  removeName: (markerId: number) => void
  addManual: (x: number, y: number) => void
  removeManual: (id: number) => void
  setWorkerState: (s: WorkerState) => void
  setLatency: (ms: number) => void
  reset: () => void
}

let manualSeq = 1000

export const useMarkerStore = create<MarkerStore>((set) => ({
  tracked: [],
  names: [],
  manual: [],
  workerState: 'idle',
  latencyMs: 0,

  setTracked: (tracked) => set({ tracked }),
  setName: (markerId, name) =>
    set((s) => ({
      names: [...s.names.filter((n) => n.markerId !== markerId), { markerId, name }],
    })),
  removeName: (markerId) =>
    set((s) => ({ names: s.names.filter((n) => n.markerId !== markerId) })),
  addManual: (x, y) =>
    set((s) => ({ manual: [...s.manual, { id: manualSeq++, x, y, radius: 12 }] })),
  removeManual: (id) =>
    set((s) => ({ manual: s.manual.filter((m) => m.id !== id) })),
  setWorkerState: (workerState) => set({ workerState }),
  setLatency: (latencyMs) => set({ latencyMs }),
  reset: () => set({ tracked: [], names: [], manual: [], latencyMs: 0 }),
}))
