'use client'

import { useMarkerStore } from '@/store/markerStore'

const SUGGESTIONS = ['Hip', 'Knee', 'Ankle', 'Shoulder', 'Elbow', 'Wrist', 'Head']

export function MarkerList() {
  const { tracked, names, manual, setName, removeName, removeManual } = useMarkerStore()
  const nameMap = new Map(names.map((n) => [n.markerId, n.name]))

  const all = [
    ...tracked.map((m) => ({ id: m.id, badge: `#${m.id}`, type: 'auto'   as const })),
    ...manual.map((m)  => ({ id: m.id, badge: `M${m.id - 1000}`, type: 'manual' as const })),
  ]

  if (all.length === 0) {
    return (
      <p className="text-xs text-gray-500 mt-1">
        No markers detected. Click the video to place markers manually.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5 mt-1">
      {all.map((m) => (
        <li key={m.id} className="flex items-center gap-2">
          <span className="text-yellow-400 font-mono text-xs w-8 shrink-0">{m.badge}</span>
          <input
            list={`sl-${m.id}`}
            value={nameMap.get(m.id) ?? ''}
            placeholder="Label…"
            onChange={(e) =>
              e.target.value ? setName(m.id, e.target.value) : removeName(m.id)
            }
            className="flex-1 min-w-0 bg-gray-700 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
          <datalist id={`sl-${m.id}`}>
            {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
          {m.type === 'manual' && (
            <button
              onClick={() => removeManual(m.id)}
              className="text-red-400 hover:text-red-300 text-xs leading-none"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
