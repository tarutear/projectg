import type { Session } from '@/types/session'

export function sessionToCsv(session: Session): string {
  const groupIds = [
    ...new Set(session.frames.flatMap((f) => Object.keys(f.angles))),
  ]
  const header = ['frameId', 'timestamp_ms', ...groupIds].join(',')
  const rows   = session.frames.map((f) =>
    [f.frameId, f.timestamp, ...groupIds.map((id) => f.angles[id] ?? '')].join(',')
  )
  return [header, ...rows].join('\n')
}

export function downloadCsv(content: string, filename: string): void {
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
  a.download = filename
  a.click()
}
