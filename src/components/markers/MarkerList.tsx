'use client'

import { useMarkerStore } from '@/store/markerStore'

const SUGGESTIONS = ['Hip', 'Knee', 'Ankle', 'Shoulder', 'Elbow', 'Wrist', 'Head']

export function MarkerList() {
  const { tracked, confirmedIds, names, setName, removeName, confirmMarker, unconfirmMarker } =
    useMarkerStore()

  const confirmedSet = new Set(confirmedIds)
  const nameMap      = new Map(names.map((n) => [n.markerId, n.name]))

  const confirmed   = tracked.filter((m) => confirmedSet.has(m.id))
  const unconfirmed = tracked.filter((m) => !confirmedSet.has(m.id) && m.missingFrames === 0)

  if (tracked.length === 0) {
    return (
      <p className="text-xs text-gray-500 mt-1">
        No markers detected. Point the camera at yellow markers.
      </p>
    )
  }

  return (
    <div className="space-y-3 mt-1">
      {/* Confirmed markers */}
      {confirmed.length > 0 && (
        <div>
          <p className="text-xs text-green-400 font-medium mb-1.5">Confirmed ({confirmed.length})</p>
          <ul className="space-y-1.5">
            {confirmed.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="text-green-400 font-mono text-xs w-8 shrink-0">#{m.id}</span>
                <input
                  list={`sl-${m.id}`}
                  value={nameMap.get(m.id) ?? ''}
                  placeholder="Label…"
                  onChange={(e) =>
                    e.target.value ? setName(m.id, e.target.value) : removeName(m.id)
                  }
                  className="flex-1 min-w-0 bg-gray-700 rounded px-2 py-0.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-400"
                />
                <datalist id={`sl-${m.id}`}>
                  {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
                <button
                  onClick={() => unconfirmMarker(m.id)}
                  title="Remove confirmation"
                  className="text-gray-500 hover:text-red-400 text-xs leading-none"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unconfirmed / detected markers */}
      {unconfirmed.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">
            {confirmedIds.length === 0
              ? `Detected (${unconfirmed.length}) — click on video to confirm`
              : `Unconfirmed (${unconfirmed.length})`}
          </p>
          <ul className="space-y-1">
            {unconfirmed.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="text-yellow-600 font-mono text-xs w-8 shrink-0">#{m.id}</span>
                <span className="flex-1 text-xs text-gray-500 italic">not confirmed</span>
                <button
                  onClick={() => confirmMarker(m.id)}
                  title="Confirm this marker"
                  className="text-xs text-yellow-500 hover:text-yellow-300 font-medium"
                >
                  ✓
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmed.length === 0 && unconfirmed.length === 0 && (
        <p className="text-xs text-gray-500">
          Waiting for markers to appear…
        </p>
      )}
    </div>
  )
}
