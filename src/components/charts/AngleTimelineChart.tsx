'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useSessionStore } from '@/store/sessionStore'
import { useAngleStore } from '@/store/angleStore'

const COLORS = ['#facc15', '#60a5fa', '#34d399', '#f87171', '#a78bfa']

export function AngleTimelineChart() {
  const current = useSessionStore((s) => s.current)
  const groups  = useAngleStore((s) => s.groups.filter((g) => g.type === 'angle'))

  const data = useMemo(() => {
    if (!current || current.frames.length === 0) return []
    return current.frames.map((f) => ({
      t: +((f.timestamp - current.startedAt) / 1000).toFixed(2),
      ...Object.fromEntries(
        groups.map((g) => [
          g.name,
          f.angles[g.id] != null ? +f.angles[g.id].toFixed(1) : null,
        ])
      ),
    }))
  }, [current, groups])

  if (!data.length || !groups.length) return null

  return (
    <div className="bg-gray-900 rounded-lg p-3 mt-3">
      <p className="text-xs text-gray-400 mb-2">Angles (°)</p>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#6b7280' }} unit="s" />
          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} unit="°" width={32} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: 'none', fontSize: 10 }}
            formatter={(v: number) => v != null ? `${v.toFixed(1)}°` : '—'}
          />
          {groups.map((g, i) => (
            <Line
              key={g.id}
              dataKey={g.name}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
