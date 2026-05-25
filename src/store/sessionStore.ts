import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Session, FrameData } from '@/types/session'
import { saveSession } from '@/lib/storage/indexeddb'

interface SessionStore {
  current: Session | null
  isRecording: boolean

  startSession: (name?: string) => void
  stopSession: () => Promise<void>
  addFrame: (f: FrameData) => void
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  current: null,
  isRecording: false,

  startSession: (name = 'Session') => {
    set({
      current: { id: nanoid(), name, startedAt: Date.now(), frames: [] },
      isRecording: true,
    })
  },

  stopSession: async () => {
    const { current } = get()
    if (!current) return
    const done = { ...current, endedAt: Date.now() }
    set({ current: done, isRecording: false })
    await saveSession(done).catch(console.error)
  },

  addFrame: (f) =>
    set((s) =>
      s.current ? { current: { ...s.current, frames: [...s.current.frames, f] } } : s
    ),

  reset: () => set({ current: null, isRecording: false }),
}))
