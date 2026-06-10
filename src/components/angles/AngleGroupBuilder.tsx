'use client'

import { useState } from 'react'
import { nanoid } from 'nanoid'
import { useAngleStore, type GroupType, type AngleVariant } from '@/store/angleStore'
import { useMarkerStore } from '@/store/markerStore'

export function AngleGroupBuilder() {
  const [name, setName]         = useState('')
  const [type, setType]         = useState<GroupType>('angle')
  const [selected, setSelected] = useState<number[]>([])
  const [vertexIndex, setVertexIndex] = useState<0 | 1 | 2>(1)
  const [angleVariant, setAngleVariant] = useState<AngleVariant>('interior')

  const { addGroup } = useAngleStore()
  const { tracked, confirmedIds, names } = useMarkerStore()
  const nameMap = new Map(names.map((n) => [n.markerId, n.name]))

  const ids      = confirmedIds.length > 0 ? confirmedIds : tracked.map((m) => m.id)
  const required = type === 'angle' ? 3 : 2

  const toggle = (id: number) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length < required) return [...prev, id]
      return prev
    })

  const markerLabel = (id: number) => nameMap.get(id) ?? `#${id}`

  const canAdd = name.trim().length > 0 && selected.length === required

  const handleAdd = () => {
    if (!canAdd) return
    addGroup({
      id: nanoid(),
      name: name.trim(),
      type,
      markerIds: selected,
      ...(type === 'angle' && { vertexIndex, angleVariant }),
    })
    setName('')
    setSelected([])
    setVertexIndex(1)
    setAngleVariant('interior')
  }

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Knee Flexion"
        className="w-full bg-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="flex gap-1">
        {(['angle', 'distance'] as GroupType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setType(t); setSelected([]) }}
            className={`flex-1 text-xs rounded py-1 ${
              type === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {t === 'angle' ? '∠ Angle (3 pts)' : '↔ Distance (2 pts)'}
          </button>
        ))}
      </div>

      {/* Marker selection */}
      {ids.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`text-xs rounded px-2 py-0.5 ${
                selected.includes(id)
                  ? 'bg-yellow-400 text-black font-medium'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {markerLabel(id)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Add markers first</p>
      )}

      {/* Angle options — shown only after 3 markers are selected */}
      {type === 'angle' && selected.length === 3 && (
        <div className="space-y-1.5 border border-gray-700 rounded p-2">
          {/* Vertex selector */}
          <div>
            <p className="text-xs text-gray-500 mb-1">꼭짓점 (vertex)</p>
            <div className="flex gap-1">
              {([0, 1, 2] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setVertexIndex(i)}
                  className={`flex-1 text-xs rounded py-1 transition-colors ${
                    vertexIndex === i
                      ? 'bg-orange-500 text-white font-semibold'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {vertexIndex === i ? '★ ' : ''}{markerLabel(selected[i])}
                </button>
              ))}
            </div>
          </div>

          {/* Interior / Supplement */}
          <div>
            <p className="text-xs text-gray-500 mb-1">각도 종류</p>
            <div className="flex gap-1">
              {([
                ['interior',   '내각 (0–180°)'],
                ['supplement', '보각 (180°–)'],
              ] as [AngleVariant, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setAngleVariant(v)}
                  className={`flex-1 text-xs rounded py-1 transition-colors ${
                    angleVariant === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={!canAdd}
        className="w-full text-xs rounded py-1 bg-blue-600 text-white disabled:opacity-40 hover:enabled:bg-blue-500"
      >
        Add Group
      </button>
    </div>
  )
}
