'use client'

import { useAngleStore } from '@/store/angleStore'
import { useMarkerStore } from '@/store/markerStore'
import { useCameraStore } from '@/store/cameraStore'
import { useMarkerRadiusCm } from '@/store/coordinateStore'
import { computeAngle } from '@/lib/motion/geometry'
import { pairDistanceCm } from '@/lib/motion/metric'

export function AngleGroupList() {
  const { groups, removeGroup } = useAngleStore()
  const tracked = useMarkerStore((s) => s.tracked)
  const frameSize = useCameraStore((s) => s.frameSize)
  const markerRadiusCm = useMarkerRadiusCm()

  const posMap = new Map<number, { x: number; y: number }>(
    tracked.map((m) => [m.id, { x: m.x, y: m.y }])
  )
  const markerMap = new Map(tracked.map((m) => [m.id, m]))

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
          } else if (g.type === 'distance' && pts.length === 2 && frameSize) {
            const d = pairDistanceCm(
              markerMap.get(g.markerIds[0])!, markerMap.get(g.markerIds[1])!, frameSize, markerRadiusCm,
            )
            if (d != null) val = `${d.toFixed(2)} cm`
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
