'use client'

import { useState } from 'react'
import { nanoid } from 'nanoid'
import { useAngleStore, type GroupType } from '@/store/angleStore'
import { useMarkerStore } from '@/store/markerStore'

export function AngleGroupBuilder() {
  const [name, setName]     = useState('')
  const [type, setType]     = useState<GroupType>('angle')
  const [selected, setSelected] = useState<number[]>([])

  const { addGroup } = useAngleStore()
  const { tracked, names, manual } = useMarkerStore()
  const nameMap = new Map(names.map((n) => [n.markerId, n.name]))

  const all      = [...tracked.map((m) => m.id), ...manual.map((m) => m.id)]
  const required = type === 'angle' ? 3 : 2

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < required ? [...prev, id] : prev
    )

  const canAdd = name.trim().length > 0 && selected.length === required

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
      {all.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {all.map((id) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`text-xs rounded px-2 py-0.5 ${
                selected.includes(id)
                  ? 'bg-yellow-400 text-black font-medium'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {nameMap.get(id) ?? `#${id}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Add markers first</p>
      )}
      <button
        onClick={() => {
          if (!canAdd) return
          addGroup({ id: nanoid(), name: name.trim(), type, markerIds: selected })
          setName(''); setSelected([])
        }}
        disabled={!canAdd}
        className="w-full text-xs rounded py-1 bg-blue-600 text-white disabled:opacity-40 hover:enabled:bg-blue-500"
      >
        Add Group
      </button>
    </div>
  )
}
