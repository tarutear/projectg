'use client'

import { useState } from 'react'
import { useMarkerStore } from '@/store/markerStore'
import { useCoordinateStore } from '@/store/coordinateStore'
import { distancePx } from '@/lib/motion/geometry'

export function CalibrationPanel() {
  const { tracked, confirmedIds } = useMarkerStore()
  const { calibratedPxPerCm, setCalibration, clearCalibration } = useCoordinateStore()

  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [realCm, setRealCm] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    if (!mA || !mB) { setError('선택한 마커가 화면에 없습니다'); return }

    const pxDist = distancePx({ x: mA.x, y: mA.y }, { x: mB.x, y: mB.y })
    if (pxDist < 10) { setError('두 마커가 너무 가깝습니다'); return }

    setCalibration(pxDist / cm)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">
        두 마커를 알려진 거리에 놓고 기준 스케일을 설정합니다.
        설정하면 마커 반지름 추정값 대신 이 값이 거리 계산에 사용됩니다.
      </p>

      {calibratedPxPerCm && (
        <div className="flex items-center justify-between bg-blue-900/40 rounded px-2 py-1.5">
          <span className="text-xs text-blue-300">
            보정 적용 중 · {calibratedPxPerCm.toFixed(2)} px/cm
          </span>
          <button
            onClick={clearCalibration}
            className="text-xs text-blue-400 hover:text-red-400 transition-colors ml-2"
          >
            해제
          </button>
        </div>
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
          className="text-xs bg-blue-700 hover:bg-blue-600 rounded px-3 py-1 font-medium shrink-0"
        >
          설정
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
