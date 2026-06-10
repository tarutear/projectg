'use client'

import { useState, useCallback } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { useMarkerTracking } from '@/hooks/useMarkerTracking'
import { useMarkerStore } from '@/store/markerStore'
import { useReplay } from '@/hooks/useReplay'
import { deleteSession } from '@/lib/storage/indexeddb'
import { CameraView } from '@/components/camera/CameraView'
import { CameraSelector } from '@/components/camera/CameraSelector'
import { MarkerList } from '@/components/markers/MarkerList'
import { AngleGroupBuilder } from '@/components/angles/AngleGroupBuilder'
import { AngleGroupList } from '@/components/angles/AngleGroupList'
import { SessionControls } from '@/components/session/SessionControls'
import { ReplayModal } from '@/components/session/ReplayModal'
import { AngleTimelineChart } from '@/components/charts/AngleTimelineChart'
import { DistanceTimelineChart } from '@/components/charts/DistanceTimelineChart'
import { CalibrationPanel } from '@/components/calibration/CalibrationPanel'

export default function Home() {
  const { videoRef } = useCamera()
  const { resetTracking } = useMarkerTracking(videoRef)

  const { tracked, confirmedIds, workerState, latencyMs, confirmMarker } = useMarkerStore()
  const names = useMarkerStore((s) => s.names)
  const markerNames = Object.fromEntries(names.map((n) => [n.markerId, n.name]))

  const [replayOpen, setReplayOpen] = useState(false)
  const replay = useReplay()

  const handleOpenReplay = useCallback(async () => {
    await replay.loadSessions()
    setReplayOpen(true)
  }, [replay])

  const handleCloseReplay = useCallback(() => {
    replay.closeSession()
    setReplayOpen(false)
  }, [replay])

  const handleDeleteSession = useCallback(async (id: string) => {
    await deleteSession(id)
    await replay.loadSessions()
    if (replay.session?.id === id) replay.closeSession()
  }, [replay])
  const totalMarkers = confirmedIds.length

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto p-4">
        <header className="mb-4 flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">Motion Analysis</h1>
            <p className="text-gray-400 text-xs mt-0.5">Marker-based joint motion measurement</p>
          </div>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded font-mono ${
              workerState === 'ready'        ? 'bg-green-900 text-green-300' :
              workerState === 'initializing' ? 'bg-yellow-900 text-yellow-300' :
              workerState === 'error'        ? 'bg-red-900 text-red-300' :
              'bg-gray-800 text-gray-500'
            }`}
          >
            {workerState === 'ready'        ? `OpenCV • ${latencyMs.toFixed(0)} ms/frame` :
             workerState === 'initializing' ? 'Loading OpenCV…' :
             workerState === 'error'        ? 'OpenCV error — check console' :
             'OpenCV idle'}
          </span>
        </header>

        <div className="flex gap-4">
          {/* Video + charts */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <CameraSelector />
              {workerState === 'ready' && tracked.length > 0 && confirmedIds.length === 0 && (
                <span className="text-xs text-yellow-600 ml-auto animate-pulse">
                  Click on a marker to confirm it
                </span>
              )}
            </div>
            <CameraView videoRef={videoRef} onMarkerConfirm={confirmMarker} />
            <AngleTimelineChart />
            <DistanceTimelineChart />
          </div>

          {/* Sidebar */}
          <aside className="w-72 shrink-0 space-y-4">
            <section className="bg-gray-900 rounded-lg p-3">
              <SessionControls onOpenReplay={handleOpenReplay} onReset={resetTracking} />
            </section>

            <section className="bg-gray-900 rounded-lg p-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Markers {totalMarkers > 0 ? `(${totalMarkers} confirmed)` : ''}
              </h2>
              <MarkerList />
            </section>

            <section className="bg-gray-900 rounded-lg p-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Angle Groups
              </h2>
              <AngleGroupBuilder />
              <AngleGroupList />
            </section>

            <section className="bg-gray-900 rounded-lg p-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                거리 보정 (Calibration)
              </h2>
              <CalibrationPanel />
            </section>
          </aside>
        </div>
      </div>

      {replayOpen && (
        <ReplayModal
          sessions={replay.sessions}
          session={replay.session}
          frameIndex={replay.frameIndex}
          isPlaying={replay.isPlaying}
          speed={replay.speed}
          markerNames={markerNames}
          onOpen={replay.openSession}
          onClose={handleCloseReplay}
          onSeek={replay.seek}
          onTogglePlay={replay.togglePlay}
          onSpeedChange={replay.setSpeed}
          onDeleteSession={handleDeleteSession}
        />
      )}
    </main>
  )
}
