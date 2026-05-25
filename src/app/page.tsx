'use client'

import { useCamera } from '@/hooks/useCamera'
import { useMarkerTracking } from '@/hooks/useMarkerTracking'
import { useMarkerStore } from '@/store/markerStore'
import { CameraView } from '@/components/camera/CameraView'
import { CameraSelector } from '@/components/camera/CameraSelector'
import { MarkerList } from '@/components/markers/MarkerList'
import { AngleGroupBuilder } from '@/components/angles/AngleGroupBuilder'
import { AngleGroupList } from '@/components/angles/AngleGroupList'
import { SessionControls } from '@/components/session/SessionControls'
import { AngleTimelineChart } from '@/components/charts/AngleTimelineChart'
import { DistanceTimelineChart } from '@/components/charts/DistanceTimelineChart'

export default function Home() {
  const { videoRef } = useCamera()
  useMarkerTracking(videoRef)

  const { tracked, manual, workerState, latencyMs, addManual } = useMarkerStore()
  const totalMarkers = tracked.length + manual.length

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
              {workerState === 'ready' && (
                <span className="text-xs text-gray-500 ml-auto">
                  Click video to place marker manually
                </span>
              )}
            </div>
            <CameraView videoRef={videoRef} onCanvasClick={addManual} />
            <AngleTimelineChart />
            <DistanceTimelineChart />
          </div>

          {/* Sidebar */}
          <aside className="w-72 shrink-0 space-y-4">
            <section className="bg-gray-900 rounded-lg p-3">
              <SessionControls />
            </section>

            <section className="bg-gray-900 rounded-lg p-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Markers ({totalMarkers})
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
          </aside>
        </div>
      </div>
    </main>
  )
}
