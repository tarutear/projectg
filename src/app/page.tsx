import { CameraView } from '@/components/camera/CameraView'
import { CameraSelector } from '@/components/camera/CameraSelector'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Motion Analysis</h1>
          <p className="text-gray-400 text-sm mt-1">Marker-based joint motion measurement</p>
        </header>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-3 h-8 flex items-center">
              <CameraSelector />
            </div>
            <CameraView />
          </div>

          <aside className="w-72 shrink-0 space-y-4">
            <section className="bg-gray-900 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Markers</h2>
              <p className="text-gray-500 text-sm">No markers detected</p>
            </section>
            <section className="bg-gray-900 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Angle Groups</h2>
              <p className="text-gray-500 text-sm">No angle groups defined</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
