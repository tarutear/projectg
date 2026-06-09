'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@/types/session'
import { loadAllSessions } from '@/lib/storage/indexeddb'

export type PlaybackSpeed = 0.5 | 1 | 2

export function useReplay() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const frameIndexRef = useRef(0)
  const sessionRef = useRef<Session | null>(null)
  const speedRef = useRef<PlaybackSpeed>(1)

  useEffect(() => { frameIndexRef.current = frameIndex }, [frameIndex])
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { speedRef.current = speed }, [speed])

  const loadSessions = useCallback(async () => {
    const all = await loadAllSessions()
    setSessions([...all].reverse())
  }, [])

  const openSession = useCallback((s: Session) => {
    setSession(s)
    setFrameIndex(0)
    setIsPlaying(false)
  }, [])

  const closeSession = useCallback(() => {
    setSession(null)
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const seek = useCallback((index: number) => {
    setFrameIndex(index)
  }, [])

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  useEffect(() => {
    if (!isPlaying || !session || session.frames.length === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const frames = session.frames
    const avgFrameMs =
      frames.length > 1
        ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / (frames.length - 1)
        : 67

    const tick = (now: number) => {
      const intervalMs = avgFrameMs / speedRef.current
      const elapsed = now - lastTimeRef.current

      if (elapsed >= intervalMs) {
        lastTimeRef.current = now
        const next = frameIndexRef.current + 1
        if (next >= frames.length) {
          setIsPlaying(false)
          return
        }
        setFrameIndex(next)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, session])

  return {
    sessions,
    session,
    frameIndex,
    isPlaying,
    speed,
    loadSessions,
    openSession,
    closeSession,
    seek,
    togglePlay,
    setSpeed: (s: PlaybackSpeed) => setSpeed(s),
  }
}
