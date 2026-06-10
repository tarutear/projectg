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
import { useCoordinateStore, estimatePxPerCm, pairScale } from '@/store/coordinateStore'
import { computeAngle, distancePx } from '@/lib/motion/geometry'
import type { RawMarker } from '@/lib/opencv/detector'

export function useMarkerTracking(videoRef: RefObject<HTMLVideoElement>) {
  const { state, processFrame, onResult } = useVisionWorker()

  const setTracked      = useMarkerStore((s) => s.setTracked)
  const setWorkerState  = useMarkerStore((s) => s.setWorkerState)
  const setLatency      = useMarkerStore((s) => s.setLatency)
  const confirmedIds    = useMarkerStore((s) => s.confirmedIds)
  const detectorMode    = useMarkerStore((s) => s.detectorMode)
  const resetMarkers    = useMarkerStore((s) => s.resetTracking)

  const isRecording = useSessionStore((s) => s.isRecording)
  const addFrame    = useSessionStore((s) => s.addFrame)
  const sessionId   = useSessionStore((s) => s.current?.id)

  const groups = useAngleStore((s) => s.groups)

  const coordEnabled        = useCoordinateStore((s) => s.enabled)
  const calibratedPxPerCm  = useCoordinateStore((s) => s.calibratedPxPerCm)
  const setReference        = useCoordinateStore((s) => s.setReference)
  const clearReference      = useCoordinateStore((s) => s.clearReference)

  const trackedRef    = useRef<TrackedMarker[]>([])
  const kalmanMap     = useRef(new Map<number, KalmanFilter2D>())
  const modeRef       = useRef(detectorMode)
  // Reference coordinate state, set on first recording frame
  const coordRef      = useRef<{ origin: { x: number; y: number }; pxPerCm: number } | null>(null)
  const isFirstFrame  = useRef(true)

  // Keep modeRef in sync so the processFrame wrapper always uses the latest mode
  useEffect(() => { modeRef.current = detectorMode }, [detectorMode])

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

      // Establish origin on first frame; update scale every frame so camera repositioning
      // between sessions doesn't cause drift.
      if (coordEnabled && recordedMarkers.length > 0) {
        const pxPerCm =
          calibratedPxPerCm ??
          estimatePxPerCm(recordedMarkers.map((m) => m.radius)) ?? 1

        if (isFirstFrame.current) {
          const origin = {
            x: recordedMarkers.reduce((s, m) => s + m.x, 0) / recordedMarkers.length,
            y: recordedMarkers.reduce((s, m) => s + m.y, 0) / recordedMarkers.length,
          }
          coordRef.current = { origin, pxPerCm }
          setReference(origin, pxPerCm)
        } else if (coordRef.current) {
          // Keep origin fixed; refresh scale from live marker sizes
          coordRef.current = { ...coordRef.current, pxPerCm }
          setReference(coordRef.current.origin, pxPerCm)
        }
      }
      if (isFirstFrame.current) isFirstFrame.current = false

      const coord = coordEnabled ? coordRef.current : null

      const toPos = (m: TrackedMarker) =>
        coord
          ? { x: -(m.x - coord.origin.x) / coord.pxPerCm, y: -(m.y - coord.origin.y) / coord.pxPerCm }
          : { x: m.x, y: m.y }

      const pos = new Map(recordedMarkers.map((m) => [m.id, toPos(m)]))
      const markerMap = new Map(recordedMarkers.map((m) => [m.id, m]))

      const angles: Record<string, number> = {}
      for (const g of groups) {
        if (g.type === 'angle' && g.markerIds.length === 3) {
          const pts = g.markerIds.map((id) => pos.get(id))
          if (!pts.every(Boolean)) continue
          angles[g.id] = computeAngle(
            [pts[0]!, pts[1]!, pts[2]!],
            g.vertexIndex ?? 1,
            g.angleVariant ?? 'interior',
          )
        } else if (g.type === 'distance' && g.markerIds.length === 2) {
          const mA = markerMap.get(g.markerIds[0])
          const mB = markerMap.get(g.markerIds[1])
          if (!mA || !mB) continue
          const pxDist = distancePx({ x: mA.x, y: mA.y }, { x: mB.x, y: mB.y })
          // Per-pair scale: each marker's radius determines its local depth.
          // This corrects for markers at different distances from the camera.
          angles[g.id] = coord
            ? pxDist / pairScale(mA.radius, mB.radius, calibratedPxPerCm)
            : pxDist
        }
      }

      addFrame({
        frameId,
        timestamp: Date.now(),
        angles,
        markerPositions: Object.fromEntries(pos),
      })
    },
    [setTracked, setLatency, isRecording, sessionId, groups, addFrame, confirmedIds, coordEnabled, calibratedPxPerCm, setReference],
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

  const processFrameWithMode = useCallback(
    (buffer: ArrayBuffer, width: number, height: number, frameId: number) =>
      processFrame(buffer, width, height, frameId, modeRef.current),
    [processFrame]
  )

  useFrameCapture({ videoRef, onFrame: processFrameWithMode, enabled: state === 'ready' })

  return { workerState: state, resetTracking }
}
