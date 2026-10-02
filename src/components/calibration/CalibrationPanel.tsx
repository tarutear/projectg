'use client'

import { useEffect, useRef, useState } from 'react'
import { useMarkerStore } from '@/store/markerStore'
import { useCameraStore } from '@/store/cameraStore'
import { useSessionStore } from '@/store/sessionStore'
import { useCoordinateStore, useMarkerRadiusCm, DEFAULT_MARKER_RADIUS_CM } from '@/store/coordinateStore'
import { distancePx } from '@/lib/motion/geometry'
import { pairDistanceCm } from '@/lib/motion/metric'

const CAL_FRAMES     = 20    // tracking results averaged per calibration (~1.3 s at 15 fps)
const CAL_TIMEOUT_MS = 5000

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function CalibrationPanel() {
  const { tracked, confirmedIds, detectorMode } = useMarkerStore()
  const isRecording = useSessionStore((s) => s.isRecording)
  const { calibration, setCalibration, clearCalibration } = useCoordinateStore()
  const markerRadiusCm = useMarkerRadiusCm()
  const isCalibrated = calibration?.detectorMode === detectorMode

  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [realCm, setRealCm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)  // samples collected while calibrating
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => () => stopRef.current?.(), [])
  // Recording freezes the scale: abort a calibration still collecting when Record is pressed
  useEffect(() => {
    if (isRecording && stopRef.current) {
      stopRef.current()
      setError('녹화가 시작되어 보정이 취소되었습니다')
    }
  }, [isRecording])

  const visibleMarkers = confirmedIds.length > 0
    ? tracked.filter((m) => confirmedIds.includes(m.id))
    : tracked

  function handleCalibrate() {
    setError(null)
    const a = parseInt(idA), b = parseInt(idB), cm = parseFloat(realCm)
    if (isNaN(a) || isNaN(b) || a === b) { setError('서로 다른 마커 ID를 선택하세요'); return }
    if (isNaN(cm) || cm <= 0) { setError('실제 거리(cm)를 입력하세요'); return }

    const mA = tracked.find((m) => m.id === a)
    const mB = tracked.find((m) => m.id === b)
    if (!mA || !mB || mA.missingFrames > 0 || mB.missingFrames > 0) {
      setError('선택한 마커가 화면에 없습니다'); return
    }
    if (distancePx(mA, mB) < 10) { setError('두 마커가 너무 가깝습니다'); return }

    // Each sample: realCm / (distance measured in marker radii) = marker radius in cm.
    // Median over several frames rejects jitter and momentary misdetections.
    const samples: number[] = []
    const mode = detectorMode

    const stop = (radiusCm?: number) => {
      unsub()
      clearTimeout(timer)
      stopRef.current = null
      setProgress(null)
      if (radiusCm != null && !useSessionStore.getState().isRecording) {
        setCalibration({ radiusCm, detectorMode: mode })
      }
    }

    const unsub = useMarkerStore.subscribe((state, prev) => {
      if (state.tracked === prev.tracked) return  // not a new tracking result (e.g. setLatency)
      const frameSize = useCameraStore.getState().frameSize
      const sA = state.tracked.find((m) => m.id === a)
      const sB = state.tracked.find((m) => m.id === b)
      if (!sA || !sB || !frameSize || distancePx(sA, sB) < 10) return
      const radii = pairDistanceCm(sA, sB, frameSize, 1)  // null while either is a ghost
      if (!radii) return
      samples.push(cm / radii)
      setProgress(samples.length)
      if (samples.length >= CAL_FRAMES) stop(median(samples))
    })

    const timer = setTimeout(() => {
      stop()
      setError('마커가 충분히 인식되지 않았습니다. 두 마커가 화면에 보이는지 확인하세요')
    }, CAL_TIMEOUT_MS)

    stopRef.current = () => stop()
    setProgress(0)
  }

  const calibrating = progress !== null
  const ratio = markerRadiusCm / DEFAULT_MARKER_RADIUS_CM[detectorMode]

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        두 마커를 자 위에 알려진 간격으로 놓고 설정하면 마커의 실제 크기를 학습합니다.
        이후에는 카메라 거리가 바뀌어도 각 마커의 크기로 거리를 자동 보정합니다.
        측정할 장소·거리에서, 마커가 카메라를 정면으로 향하고 화면 중앙 가까이 있을 때 보정·측정하세요.
      </p>
      {detectorMode === 'sticker' && (
        <p className="text-xs text-amber-400">
          스티커는 화면에서 매우 작아(반지름 수 px) 카메라 거리가 보정 위치와 많이 다르면 오차가 커집니다.
          측정 거리에서 보정하세요.
        </p>
      )}

      <div className="flex items-center justify-between bg-gray-800/60 rounded px-2 py-1.5">
        <span className={`text-xs ${isCalibrated ? 'text-blue-300' : 'text-gray-400'}`}>
          마커 반지름 {markerRadiusCm.toFixed(3)} cm · {isCalibrated ? '보정됨' : '기본값'}
          {' '}({detectorMode === 'yellow' ? '노랑' : '스티커'})
        </span>
        {isCalibrated && (
          <button
            onClick={clearCalibration}
            disabled={isRecording}
            className="text-xs text-blue-400 hover:text-red-400 transition-colors ml-2 disabled:opacity-50"
          >
            해제
          </button>
        )}
      </div>
      {isCalibrated && (ratio < 0.67 || ratio > 1.5) && (
        <p className="text-xs text-amber-400">
          기본값과 차이가 큽니다. 선택한 마커와 입력한 거리를 확인하세요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">마커 A</label>
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="w-full bg-gray-800 text-xs rounded px-2 py-1 text-white border border-gray-700"
          >
            <option value="">선택</option>
            {visibleMarkers.map((m) => (
              <option key={m.id} value={m.id}>#{m.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">마커 B</label>
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="w-full bg-gray-800 text-xs rounded px-2 py-1 text-white border border-gray-700"
          >
            <option value="">선택</option>
            {visibleMarkers.map((m) => (
              <option key={m.id} value={m.id}>#{m.id}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1.5 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-0.5">실제 거리 (cm)</label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={realCm}
            onChange={(e) => setRealCm(e.target.value)}
            placeholder="예) 30"
            className="w-full bg-gray-800 text-xs rounded px-2 py-1 text-white border border-gray-700 placeholder-gray-600"
          />
        </div>
        <button
          onClick={handleCalibrate}
          disabled={calibrating || isRecording}
          className="text-xs bg-blue-700 hover:bg-blue-600 rounded px-3 py-1 font-medium shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calibrating ? `측정 중 ${progress}/${CAL_FRAMES}` : '설정'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
