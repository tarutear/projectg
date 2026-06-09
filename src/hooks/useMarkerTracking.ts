'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useVisionWorker } from './useVisionWorker'
import { useFrameCapture } from './useFrameCapture'
import { remapMarkers, resetRemapper, type TrackedMarker } from '@/lib/tracking/remapper'
import { KalmanFilter2D } from '@/lib/motion/kalman'
import { useMarkerStore } from '@/store/markerStore'
import { useSessionStore } from '@/store/sessionStore'
import { useAngleStore } from '@/store/angleStore'
import { useCoordinateStore, estimatePxPerCm } from '@/store/coordinateStore'
import { angleDeg, distancePx } from '@/lib/motion/geometry'
import type { RawMarker } from '@/lib/opencv/detector'

export function useMarkerTracking(videoRef: RefObject<HTMLVideoElement>) {
  const { state, processFrame, onResult } = useVisionWorker()

  const setTracked      = useMarkerStore((s) => s.setTracked)
  const setWorkerState  = useMarkerStore((s) => s.setWorkerState)
  const setLatency      = useMarkerStore((s) => s.setLatency)
  const confirmedIds    = useMarkerStore((s) => s.confirmedIds)
  const resetMarkers    = useMarkerStore((s) => s.resetTracking)

  const isRecording = useSessionStore((s) => s.isRecording)
  const addFrame    = useSessionStore((s) => s.addFrame)
  const sessionId   = useSessionStore((s) => s.current?.id)

  const groups = useAngleStore((s) => s.groups)

  const coordEnabled    = useCoordinateStore((s) => s.enabled)
  const setReference    = useCoordinateStore((s) => s.setReference)
  const clearReference  = useCoordinateStore((s) => s.clearReference)

  const trackedRef    = useRef<TrackedMarker[]>([])
  const kalmanMap     = useRef(new Map<number, KalmanFilter2D>())
  // Reference coordinate state, set on first recording frame
  const coordRef      = useRef<{ origin: { x: number; y: number }; pxPerCm: number } | null>(null)
  const isFirstFrame  = useRef(true)

  // Reset reference state whenever a new recording session begins
  useEffect(() => {
    if (isRecording) {
      isFirstFrame.current = true
      coordRef.current = null
    } else {
      clearReference()
    }
  }, [isRecording, clearReference])

  const handleResult = useCallback(
    (rawMarkers: RawMarker[], frameId: number, latencyMs: number) => {
      const confirmedSet = confirmedIds.length > 0 ? new Set(confirmedIds) : undefined
      const remapped = remapMarkers(trackedRef.current, rawMarkers, frameId, confirmedSet)

      const smoothed = remapped.map((m) => {
        if (m.missingFrames > 0) return m
        let kf = kalmanMap.current.get(m.id)
        if (!kf) { kf = new KalmanFilter2D(m.x, m.y); kalmanMap.current.set(m.id, kf) }
        return { ...m, ...kf.update(m.x, m.y) }
      })

      // Purge Kalman filters for markers that have been dropped
      const liveIds = new Set(smoothed.map((m) => m.id))
      for (const id of kalmanMap.current.keys()) {
        if (!liveIds.has(id)) kalmanMap.current.delete(id)
      }

      trackedRef.current = smoothed
      setTracked(smoothed)
      setLatency(latencyMs)

      if (!isRecording || !sessionId) return

      const recordSet = confirmedIds.length > 0 ? new Set(confirmedIds) : null
      const recordedMarkers = smoothed.filter((m) => !recordSet || recordSet.has(m.id))

      // On first recording frame with reference coords enabled, establish the coordinate system
      if (coordEnabled && isFirstFrame.current && recordedMarkers.length > 0) {
        isFirstFrame.current = false
        const pxPerCm = estimatePxPerCm(recordedMarkers.map((m) => m.radius)) ?? 1
        const origin = {
          x: recordedMarkers.reduce((s, m) => s + m.x, 0) / recordedMarkers.length,
          y: recordedMarkers.reduce((s, m) => s + m.y, 0) / recordedMarkers.length,
        }
        coordRef.current = { origin, pxPerCm }
        setReference(origin, pxPerCm)
      } else if (isFirstFrame.current) {
        isFirstFrame.current = false
      }

      const coord = coordEnabled ? coordRef.current : null

      const toPos = (m: TrackedMarker) =>
        coord
          ? { x: -(m.x - coord.origin.x) / coord.pxPerCm, y: -(m.y - coord.origin.y) / coord.pxPerCm }
          : { x: m.x, y: m.y }

      const pos = new Map(recordedMarkers.map((m) => [m.id, toPos(m)]))

      const angles: Record<string, number> = {}
      for (const g of groups) {
        const pts = g.markerIds.map((id) => pos.get(id))
        if (!pts.every(Boolean)) continue
        angles[g.id] =
          g.type === 'angle' && pts.length === 3
            ? angleDeg(pts[0]!, pts[1]!, pts[2]!)
            : distancePx(pts[0]!, pts[1]!)
      }

      addFrame({
        frameId,
        timestamp: Date.now(),
        angles,
        markerPositions: Object.fromEntries(pos),
      })
    },
    [setTracked, setLatency, isRecording, sessionId, groups, addFrame, confirmedIds, coordEnabled, setReference],
  )

  onResult(handleResult)

  useEffect(() => { setWorkerState(state) }, [state, setWorkerState])

  const resetTracking = useCallback(() => {
    trackedRef.current = []
    kalmanMap.current.clear()
    coordRef.current = null
    resetRemapper()
    resetMarkers()
    clearReference()
  }, [resetMarkers, clearReference])

  useFrameCapture({ videoRef, onFrame: processFrame, enabled: state === 'ready' })

  return { workerState: state, resetTracking }
}
