'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useSessionStore } from '@/store/sessionStore'
import { useAngleStore } from '@/store/angleStore'

const COLORS = ['#60a5fa', '#34d399', '#f87171', '#facc15']

export function DistanceTimelineChart() {
  const current  = useSessionStore((s) => s.current)
  const mmPerPx  = useAngleStore((s) => s.mmPerPx)
  const groups   = useAngleStore((s) => s.groups.filter((g) => g.type === 'distance'))

  const data = useMemo(() => {
    if (!current || current.frames.length === 0) return []
    return current.frames.map((f) => ({
      t: +((f.timestamp - current.startedAt) / 1000).toFixed(2),
      ...Object.fromEntries(
        groups.map((g) => {
          const v = f.angles[g.id]
          return [g.name, v != null ? +((mmPerPx ? v * mmPerPx : v)).toFixed(1) : null]
        })
      ),
    }))
  }, [current, groups, mmPerPx])

  if (!data.length || !groups.length) return null
  const unit = mmPerPx ? 'mm' : 'px'

  return (
    <div className="bg-gray-900 rounded-lg p-3 mt-2">
      <p className="text-xs text-gray-400 mb-2">Distances ({unit})</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#6b7280' }} unit="s" />
          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} unit={unit} width={36} />
          <Tooltip
            contentStyle={{ background: '#1f2937', border: 'none', fontSize: 10 }}
            formatter={(v: number) => v != null ? `${v.toFixed(1)} ${unit}` : '—'}
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
