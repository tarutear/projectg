'use client'

import { useSessionStore } from '@/store/sessionStore'
import { sessionToCsv, downloadCsv } from '@/lib/export/csvExporter'

export function SessionControls() {
  const { current, isRecording, startSession, stopSession } = useSessionStore()

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <button
          onClick={() => startSession()}
          className="flex-1 text-xs bg-green-700 hover:bg-green-600 rounded py-1.5 font-medium"
        >
          ● Record
        </button>
      ) : (
        <button
          onClick={() => stopSession()}
          className="flex-1 text-xs bg-red-700 hover:bg-red-600 rounded py-1.5 font-medium"
        >
          ■ Stop
        </button>
      )}
      {current && !isRecording && current.frames.length > 0 && (
        <button
          onClick={() => {
            const ts = new Date(current.startedAt)
              .toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
            downloadCsv(sessionToCsv(current), `motion-${ts}.csv`)
          }}
          className="text-xs bg-gray-600 hover:bg-gray-500 rounded py-1.5 px-3"
        >
          Export CSV
        </button>
      )}
      {isRecording && (
        <span className="text-xs text-red-400 animate-pulse ml-1">
          {current?.frames.length ?? 0} frames
        </span>
      )}
    </div>
  )
}
