import { useEffect, useRef } from 'react'
import { useCameraStore } from '@/store/cameraStore'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { selectedDeviceId, setStream, setDevices, setError } = useCameraStore()

  useEffect(() => {
    let active = true
    let currentStream: MediaStream | null = null

    async function start() {
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        currentStream = stream
        setStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Device labels are only populated after getUserMedia succeeds
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        if (active) {
          setDevices(allDevices.filter((d) => d.kind === 'videoinput'))
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Camera access failed')
        }
      }
    }

    start()

    return () => {
      active = false
      currentStream?.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [selectedDeviceId, setStream, setDevices, setError])

  return { videoRef }
}
