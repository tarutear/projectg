import { create } from 'zustand'

interface CameraState {
  selectedDeviceId: string | null
  devices: MediaDeviceInfo[]
  stream: MediaStream | null
  error: string | null
  setSelectedDeviceId: (id: string) => void
  setDevices: (devices: MediaDeviceInfo[]) => void
  setStream: (stream: MediaStream | null) => void
  setError: (error: string | null) => void
}

export const useCameraStore = create<CameraState>((set) => ({
  selectedDeviceId: null,
  devices: [],
  stream: null,
  error: null,
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id, error: null }),
  setDevices: (devices) => set({ devices }),
  setStream: (stream) => set({ stream }),
  setError: (error) => set({ error }),
}))
