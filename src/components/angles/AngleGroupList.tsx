'use client'

import { useAngleStore } from '@/store/angleStore'
import { useMarkerStore } from '@/store/markerStore'
import { useCoordinateStore, estimatePxPerCm } from '@/store/coordinateStore'
import { angleDeg, distancePx } from '@/lib/motion/geometry'

export function AngleGroupList() {
  const { groups, removeGroup, mmPerPx } = useAngleStore()
  const { tracked, confirmedIds } = useMarkerStore()
  const { enabled: coordEnabled } = useCoordinateStore()

  const posMap = new Map<number, { x: number; y: number }>(
    tracked.map((m) => [m.id, { x: m.x, y: m.y }])
  )

  // Estimate live pxPerCm from confirmed markers' radii
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
            val = `${angleDeg(pts[0]!, pts[1]!, pts[2]!).toFixed(1)}°`
          } else if (g.type === 'distance' && pts.length === 2) {
            const px = distancePx(pts[0]!, pts[1]!)
            if (coordEnabled && livePxPerCm) {
              val = `${(px / livePxPerCm).toFixed(2)} cm`
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
