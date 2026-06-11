import type { Session } from '@/types/session'

// Prevent CSV formula injection (Excel/Sheets treat cells starting with =,+,-,@ as formulas)
function escapeCsv(value: string | number | undefined): string {
  const str = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(str) || str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function sessionToCsv(
  session: Session,
  markerNames?: Record<number, string>
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

  const markerCols = markerIds.flatMap((id) => {
    const name = markerNames?.[id] ?? `M${id}`
    return [`${escapeCsv(name)}_x`, `${escapeCsv(name)}_y`]
  })

  const header = ['frameId', 'timestamp_ms', ...markerCols, ...groupIds.map(escapeCsv)].join(',')

  const rows = session.frames.map((f) => [
    f.frameId,
    f.timestamp,
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
