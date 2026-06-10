'use client'

import { useAngleStore } from '@/store/angleStore'
import { useMarkerStore } from '@/store/markerStore'
import { useCoordinateStore, estimatePxPerCm, pairScale } from '@/store/coordinateStore'
import { computeAngle, distancePx } from '@/lib/motion/geometry'

export function AngleGroupList() {
  const { groups, removeGroup, mmPerPx } = useAngleStore()
  const { tracked, confirmedIds } = useMarkerStore()
  const { enabled: coordEnabled, calibratedPxPerCm } = useCoordinateStore()

  const posMap = new Map<number, { x: number; y: number }>(
    tracked.map((m) => [m.id, { x: m.x, y: m.y }])
  )
  const markerMap = new Map(tracked.map((m) => [m.id, m]))

  // Estimate live pxPerCm from confirmed markers' radii (fallback when not calibrated)
  const confirmedSet = new Set(confirmedIds)
  const confirmedRadii = tracked.filter((m) => confirmedSet.has(m.id)).map((m) => m.radius)
  const livePxPerCm = estimatePxPerCm(confirmedRadii)

  if (groups.length === 0) return <p className="text-xs text-gray-500 mt-1">No groups yet.</p>

  return (
    <ul className="mt-2 space-y-1">
      {groups.map((g) => {
        const pts = g.markerIds.map((id) => posMap.get(id))
        const ok  = pts.every(Boolean)
        let val   = '—'
        if (ok) {
          if (g.type === 'angle' && pts.length === 3) {
            const deg = computeAngle(
              [pts[0]!, pts[1]!, pts[2]!],
              g.vertexIndex ?? 1,
              g.angleVariant ?? 'interior',
            )
            val = `${deg.toFixed(1)}°`
          } else if (g.type === 'distance' && pts.length === 2) {
            const px = distancePx(pts[0]!, pts[1]!)
            const mA = markerMap.get(g.markerIds[0])
            const mB = markerMap.get(g.markerIds[1])
            // Use per-pair scale when both markers visible; respect calibration first.
            const scale = mA && mB
              ? pairScale(mA.radius, mB.radius, calibratedPxPerCm)
              : (calibratedPxPerCm ?? livePxPerCm)
            if (scale && (calibratedPxPerCm || coordEnabled)) {
              val = `${(px / scale).toFixed(2)} cm`
            } else if (mmPerPx) {
              val = `${(px * mmPerPx).toFixed(1)} mm`
            } else {
              val = `${px.toFixed(0)} px`
            }
          }
        }
        return (
          <li key={g.id} className="flex items-center gap-2">
            <span className="flex-1 text-gray-300 text-xs truncate">{g.name}</span>
            <span className="font-mono text-yellow-300 text-xs w-20 text-right">{val}</span>
            <button
              onClick={() => removeGroup(g.id)}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              ✕
            </button>
          </li>
        )
      })}
    </ul>
  )
}
