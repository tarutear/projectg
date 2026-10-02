import { create } from 'zustand'
import { useCoordinateStore } from '@/store/coordinateStore'
import type { FrameSize } from '@/lib/motion/metric'

interface CameraState {
  selectedDeviceId: string | null
  devices: MediaDeviceInfo[]
  stream: MediaStream | null
  error: string | null
  /** Native video resolution — the pixel space markers are detected in */
  frameSize: FrameSize | null
  setSelectedDeviceId: (id: string) => void
  setDevices: (devices: MediaDeviceInfo[]) => void
  setStream: (stream: MediaStream | null) => void
  setError: (error: string | null) => void
  setFrameSize: (size: FrameSize) => void
}

export const useCameraStore = create<CameraState>((set, get) => ({
  selectedDeviceId: null,
  devices: [],
  stream: null,
  error: null,
  frameSize: null,
  setSelectedDeviceId: (id) => {
    // Calibration also absorbs the camera's pixel-level radius bias (blur, ISP), so it is per-camera
    if (id !== get().selectedDeviceId) useCoordinateStore.getState().clearCalibration()
    set({ selectedDeviceId: id, error: null })
  },
  setDevices: (devices) => set({ devices }),
  setStream: (stream) => set({ stream }),
  setError: (error) => set({ error }),
  setFrameSize: (size) => {
    const prev = get().frameSize
    if (prev && prev.width === size.width && prev.height === size.height) return
    // The absorbed radius bias is a fixed px amount, so it no longer fits at another resolution
    if (prev) useCoordinateStore.getState().clearCalibration()
    set({ frameSize: size })
  },
}))
