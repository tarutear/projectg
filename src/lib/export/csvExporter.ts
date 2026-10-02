import type { Session } from '@/types/session'
import type { AngleGroup } from '@/store/angleStore'
import { sessionDistanceUnit } from '@/lib/motion/metric'

// Prevent CSV formula injection (Excel/Sheets treat cells starting with =,+,-,@ as formulas)
function escapeCsv(value: string | number | undefined): string {
  const str = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(str) || str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Local wall-clock time, e.g. "2026-10-01 14:03:27.415"
function formatLocalTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

export function sessionToCsv(
  session: Session,
  markerNames?: Record<number, string>,
  groups?: AngleGroup[],
): string {
  // Collect all marker IDs that appear in any frame, in stable order
  const markerIdSet = new Set<number>()
  for (const f of session.frames) {
    for (const k of Object.keys(f.markerPositions)) markerIdSet.add(Number(k))
  }
  const markerIds = [...markerIdSet].sort((a, b) => a - b)

  const groupIds = [
    ...new Set(session.frames.flatMap((f) => Object.keys(f.angles))),
  ]

  // Units go in the column names: positions are cm only in coordinate mode
  const posUnit = session.coordMode ? 'cm' : 'px'
  const markerCols = markerIds.flatMap((id) => {
    const name = markerNames?.[id] ?? `M${id}`
    return [escapeCsv(`${name}_x_${posUnit}`), escapeCsv(`${name}_y_${posUnit}`)]
  })

  const groupMap = new Map(groups?.map((g) => [g.id, g]))
  const distUnit = sessionDistanceUnit(session)
  const seen = new Map<string, number>()
  const groupCols = groupIds.map((id) => {
    const g = groupMap.get(id)
    let col = g ? `${g.name}_${g.type === 'angle' ? 'deg' : distUnit}` : id  // id: group deleted since recording
    const n = (seen.get(col) ?? 0) + 1  // group names need not be unique
    seen.set(col, n)
    if (n > 1) col = `${col}_${n}`
    return escapeCsv(col)
  })

  const header = ['frameId', 'timestamp', 'elapsed_s', ...markerCols, ...groupCols].join(',')

  const rows = session.frames.map((f) => [
    f.frameId,
    formatLocalTime(f.timestamp),
    ((f.timestamp - session.startedAt) / 1000).toFixed(3),
    ...markerIds.flatMap((id) => {
      const pos = f.markerPositions[id]
      return pos ? [pos.x.toFixed(1), pos.y.toFixed(1)] : ['', '']
    }),
    ...groupIds.map((id) => escapeCsv(f.angles[id])),
  ].join(','))

  return [header, ...rows].join('\n')
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
