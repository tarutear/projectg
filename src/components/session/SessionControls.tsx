'use client'

import { useSessionStore } from '@/store/sessionStore'
import { useMarkerStore } from '@/store/markerStore'
import { useAngleStore } from '@/store/angleStore'
import { useCoordinateStore, useMarkerRadiusCm } from '@/store/coordinateStore'
import { sessionToCsv, downloadCsv } from '@/lib/export/csvExporter'

interface SessionControlsProps {
  onOpenReplay?: () => void
  onReset?: () => void
}

export function SessionControls({ onOpenReplay, onReset }: SessionControlsProps) {
  const { current, isRecording, startSession, stopSession } = useSessionStore()
  const names = useMarkerStore((s) => s.names)
  const { detectorMode, setDetectorMode } = useMarkerStore()
  const groups = useAngleStore((s) => s.groups)
  const { enabled: coordEnabled, toggle: toggleCoord, calibration } = useCoordinateStore()
  const markerRadiusCm = useMarkerRadiusCm()

  const toggleDetector = () =>
    setDetectorMode(detectorMode === 'yellow' ? 'sticker' : 'yellow')

  // Settings that change units/scale are frozen into the session and locked while recording
  const start = () => startSession('Session', {
    coordMode: coordEnabled,
    markerRadiusCm,
    calibrated: calibration?.detectorMode === detectorMode,
    detectorMode,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button
            onClick={start}
            className="flex-1 text-xs bg-green-700 hover:bg-green-600 rounded py-1.5 font-medium"
          >
            ● Record
          </button>
        ) : (
          <button
            onClick={() => stopSession()}
            className="flex-1 text-xs bg-red-700 hover:bg-red-600 rounded py-1.5 font-medium"
          >
            ■ Stop
          </button>
        )}
        {current && !isRecording && current.frames.length > 0 && (
          <button
            onClick={() => {
              const ts = new Date(current.startedAt)
                .toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
              const nameMap = Object.fromEntries(names.map((n) => [n.markerId, n.name]))
              downloadCsv(sessionToCsv(current, nameMap, groups), `motion-${ts}.csv`)
            }}
            className="text-xs bg-gray-600 hover:bg-gray-500 rounded py-1.5 px-3"
          >
            Export CSV
          </button>
        )}
        {isRecording && (
          <span className="text-xs text-red-400 animate-pulse ml-1">
            {current?.frames.length ?? 0} frames
          </span>
        )}
      </div>
      {/* Reference coordinate toggle */}
      <button
        onClick={toggleCoord}
        disabled={isRecording}
        title="기준점 좌표 적용: 녹화 시작 위치를 (0,0)으로 하는 cm 좌표로 마커 위치를 기록합니다 (거리는 항상 cm)"
        className={`text-xs rounded py-1.5 font-medium w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          coordEnabled
            ? 'bg-blue-700 hover:bg-blue-600 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      >
        {coordEnabled ? '📐 기준점 좌표 ON' : '📐 기준점 좌표 적용'}
      </button>

      {/* Detector mode toggle */}
      <button
        onClick={toggleDetector}
        disabled={isRecording}
        title="검출 마커 종류를 전환합니다"
        className={`text-xs rounded py-1.5 font-medium w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          detectorMode === 'sticker'
            ? 'bg-purple-700 hover:bg-purple-600 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      >
        {detectorMode === 'sticker'
          ? '⬤ 스티커 인식 ON (회색·검정 동심원)'
          : '● 노랑 마커 인식'}
      </button>

      <div className="flex gap-2">
        {onOpenReplay && (
          <button
            onClick={onOpenReplay}
            className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 rounded py-1.5 font-medium"
          >
            ▶ Sessions 재생
          </button>
        )}
        {onReset && !isRecording && (
          <button
            onClick={onReset}
            title="추적 상태를 초기화하고 마커를 다시 인식합니다"
            className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 rounded py-1.5 font-medium text-yellow-400"
          >
            ↺ 초기화
          </button>
        )}
      </div>
    </div>
  )
}
