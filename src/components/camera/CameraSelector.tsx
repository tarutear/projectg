'use client'

import { useCameraStore } from '@/store/cameraStore'

export function CameraSelector() {
  const { devices, selectedDeviceId, setSelectedDeviceId } = useCameraStore()

  // Show only when multiple cameras are available
  if (devices.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="camera-select" className="text-sm text-gray-400 shrink-0">
        Camera
      </label>
      <select
        id="camera-select"
        value={selectedDeviceId ?? ''}
        onChange={(e) => setSelectedDeviceId(e.target.value)}
        className="bg-gray-800 text-white text-sm rounded px-3 py-1 border border-gray-700 focus:outline-none focus:border-blue-500 min-w-0 max-w-xs"
      >
        {devices.map((device, i) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  )
}
