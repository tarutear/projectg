'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { RefObject } from 'react'

interface FrameCaptureOpts {
  videoRef: RefObject<HTMLVideoElement>
  onFrame: (buffer: ArrayBuffer, width: number, height: number, frameId: number) => void
  enabled?: boolean
  targetFps?: number
}

export function useFrameCapture({
  videoRef,
  onFrame,
  enabled = true,
  targetFps = 15,
}: FrameCaptureOpts) {
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const frameIdRef   = useRef(0)
  const lastRef      = useRef(0)
  const rafRef       = useRef(0)

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const now = performance.now()
    if (now - lastRef.current < 1000 / targetFps - 1) return

    const { videoWidth: w, videoHeight: h } = video
    if (w === 0 || h === 0) return

    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas')
    const canvas = offscreenRef.current
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    ctx.drawImage(video, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)
    // Transfer the underlying buffer (zero-copy); imageData is discarded after this
    const buffer = imageData.data.buffer

    lastRef.current = now
    onFrame(buffer, w, h, ++frameIdRef.current)
  }, [videoRef, onFrame, targetFps])

  useEffect(() => {
    if (!enabled) return
    const loop = () => { capture(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled, capture])
}
