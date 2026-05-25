'use client'

import { useRef, useEffect } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { useCameraStore } from '@/store/cameraStore'

export function CameraView() {
  const { videoRef } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { error, stream } = useCameraStore()

  // Keep canvas pixel dimensions in sync with the video's native resolution.
  // CSS scaling handles display; pixel coords stay accurate for marker detection.
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    function syncSize() {
      if (!video || !canvas || video.videoWidth === 0) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) syncSize()
    video.addEventListener('loadedmetadata', syncSize)
    return () => video.removeEventListener('loadedmetadata', syncSize)
  }, [videoRef])

  if (error) {
    return (
      <div className="flex items-center justify-center bg-gray-900 rounded-lg aspect-video text-sm">
        <div className="text-center">
          <p className="text-red-400 mb-1">Camera error</p>
          <p className="text-gray-500 text-xs max-w-xs">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      {/* Overlay canvas — drawn in video-pixel coordinates, CSS-scaled to container */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      />
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Initializing camera…
        </div>
      )}
    </div>
  )
}
