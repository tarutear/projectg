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
import { useCameraStore } from '@/store/cameraStore'
import { useCoordinateStore, useMarkerRadiusCm } from '@/store/coordinateStore'
import { computeAngle, type Point2D } from '@/lib/motion/geometry'
import { markerPlaneCm, pairDistanceCm } from '@/lib/motion/metric'
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

  const coordEnabled   = useCoordinateStore((s) => s.enabled)
  const markerRadiusCm = useMarkerRadiusCm()
  const frameSize      = useCameraStore((s) => s.frameSize)

  const trackedRef    = useRef<TrackedMarker[]>([])
  // Radius gets its own filter with the same gains as position, so (u − c)/r — the per-marker
  // cm conversion — stays exact while depth changes (a laggier radius filter would bias it).
  const kalmanMap     = useRef(new Map<number, { pos: KalmanFilter2D; rad: KalmanFilter2D }>())
  const modeRef       = useRef(detectorMode)
  // Coordinate-mode origin (cm, marker-plane coords), set on the first recording frame with a visible marker
  const originRef     = useRef<Point2D | null>(null)

  // Keep modeRef in sync so the processFrame wrapper always uses the latest mode
  useEffect(() => { modeRef.current = detectorMode }, [detectorMode])

  // Reset the origin whenever a new recording session begins
  useEffect(() => {
    if (isRecording) originRef.current = null
  }, [isRecording])

  const handleResult = useCallback(
    (rawMarkers: RawMarker[], frameId: number, latencyMs: number) => {
      const confirmedSet = confirmedIds.length > 0 ? new Set(confirmedIds) : undefined
      const remapped = remapMarkers(trackedRef.current, rawMarkers, frameId, confirmedSet)

      const smoothed = remapped.map((m) => {
        if (m.missingFrames > 0) return m
        let kf = kalmanMap.current.get(m.id)
        if (!kf) {
          kf = { pos: new KalmanFilter2D(m.x, m.y), rad: new KalmanFilter2D(m.radius, 0) }
          kalmanMap.current.set(m.id, kf)
        }
        return { ...m, ...kf.pos.update(m.x, m.y), radius: kf.rad.update(m.radius, 0).x }
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
      // Use the scale frozen into the session so one recording never mixes scales
      const radiusCm = useSessionStore.getState().current?.markerRadiusCm ?? markerRadiusCm

      // Coordinate mode: fix the origin at the centroid of the first frame that has a visible marker.
      // Each marker is converted with its own radius, so positions don't drift with camera distance.
      if (coordEnabled && frameSize && !originRef.current) {
        const visible = recordedMarkers
          .filter((m) => m.missingFrames === 0)
          .map((m) => markerPlaneCm(m, frameSize, radiusCm))
        if (visible.length > 0) {
          originRef.current = {
            x: visible.reduce((s, p) => s + p.x, 0) / visible.length,
            y: visible.reduce((s, p) => s + p.y, 0) / visible.length,
          }
        }
      }
      const origin = coordEnabled && frameSize ? originRef.current : null

      const toPos = (m: TrackedMarker): Point2D => {
        if (!origin || !frameSize) return { x: m.x, y: m.y }
        const p = markerPlaneCm(m, frameSize, radiusCm)
        return { x: -(p.x - origin.x), y: -(p.y - origin.y) }
      }

      // In coordinate mode, positions are only recorded once the origin exists — never px under a cm label
      const pos = coordEnabled && !origin
        ? new Map<number, Point2D>()
        : new Map(recordedMarkers.map((m) => [m.id, toPos(m)]))
      const markerMap = new Map(recordedMarkers.map((m) => [m.id, m]))

      const angles: Record<string, number> = {}
      for (const g of groups) {
        if (g.type === 'angle' && g.markerIds.length === 3) {
          // Image coordinates, as before and as shown live — per-marker radius noise must not leak into angles
          const pts = g.markerIds.map((id) => markerMap.get(id))
          if (!pts.every(Boolean)) continue
          angles[g.id] = computeAngle(
            [pts[0]!, pts[1]!, pts[2]!],
            g.vertexIndex ?? 1,
            g.angleVariant ?? 'interior',
          )
        } else if (g.type === 'distance' && g.markerIds.length === 2) {
          const mA = markerMap.get(g.markerIds[0])
          const mB = markerMap.get(g.markerIds[1])
          if (!mA || !mB || !frameSize) continue
          // Always cm, independent of coordinate mode; null while either marker is a ghost
          const d = pairDistanceCm(mA, mB, frameSize, radiusCm)
          if (d != null) angles[g.id] = d
        }
      }

      addFrame({
        frameId,
        timestamp: Date.now(),
        angles,
        markerPositions: Object.fromEntries(pos),
      })
    },
    [setTracked, setLatency, isRecording, sessionId, groups, addFrame, confirmedIds, coordEnabled, markerRadiusCm, frameSize],
  )

  onResult(handleResult)

  useEffect(() => { setWorkerState(state) }, [state, setWorkerState])

  const resetTracking = useCallback(() => {
    trackedRef.current = []
    kalmanMap.current.clear()
    originRef.current = null
    resetRemapper()
    resetMarkers()
  }, [resetMarkers])

  const processFrameWithMode = useCallback(
    (buffer: ArrayBuffer, width: number, height: number, frameId: number) =>
      processFrame(buffer, width, height, frameId, modeRef.current),
    [processFrame]
  )

  useFrameCapture({ videoRef, onFrame: processFrameWithMode, enabled: state === 'ready' })

  return { workerState: state, resetTracking }
}
