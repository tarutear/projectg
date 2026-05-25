'use client'

import { useRef, useEffect } from 'react'
import type { RefObject } from 'react'
import { useCameraStore } from '@/store/cameraStore'
import { useMarkerStore } from '@/store/markerStore'
import { useAngleStore } from '@/store/angleStore'
import { angleDeg, distancePx } from '@/lib/motion/geometry'

interface Props {
  videoRef: RefObject<HTMLVideoElement>
  onCanvasClick?: (x: number, y: number) => void
}

export function CameraView({ videoRef, onCanvasClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { error, stream } = useCameraStore()
  const { tracked, names, manual } = useMarkerStore()
  const { groups, mmPerPx } = useAngleStore()

  // Keep canvas pixel dimensions in sync with the video native resolution
  useEffect(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const sync = () => {
      if (!video || !canvas || video.videoWidth === 0) return
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) sync()
    video.addEventListener('loadedmetadata', sync)
    return () => video.removeEventListener('loadedmetadata', sync)
  }, [videoRef])

  // Redraw marker overlay whenever tracking state or groups change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const nameMap = new Map(names.map((n) => [n.markerId, n.name]))
    const allMarkers = [
      ...tracked.map((m) => ({ id: m.id, x: m.x, y: m.y, radius: m.radius, faded: m.missingFrames > 0 })),
      ...manual.map((m)  => ({ id: m.id, x: m.x, y: m.y, radius: m.radius, faded: false })),
    ]
    const posMap = new Map(allMarkers.map((m) => [m.id, m]))

    // Draw angle / distance group lines
    for (const g of groups) {
      const pts = g.markerIds.map((id) => posMap.get(id)).filter(Boolean)
      if (pts.length < 2) continue

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(96,165,250,0.75)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
      ctx.stroke()
      ctx.setLineDash([])

      if (g.type === 'angle' && pts.length === 3) {
        const val = angleDeg(pts[0]!, pts[1]!, pts[2]!).toFixed(1)
        drawBadge(ctx, `${val}°`, pts[1]!.x, pts[1]!.y - Math.max(pts[1]!.radius, 16) - 4, '#93c5fd')
      } else if (g.type === 'distance' && pts.length === 2) {
        const px  = distancePx(pts[0]!, pts[1]!)
        const val = mmPerPx ? `${(px * mmPerPx).toFixed(1)} mm` : `${px.toFixed(0)} px`
        drawBadge(
          ctx, val,
          (pts[0]!.x + pts[1]!.x) / 2,
          (pts[0]!.y + pts[1]!.y) / 2 - 14,
          '#93c5fd'
        )
      }
    }

    // Draw marker circles
    for (const m of allMarkers) {
      const alpha = m.faded ? 0.3 : 0.9
      const r     = Math.max(m.radius, 8)
      ctx.beginPath()
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(250,204,21,${alpha})`
      ctx.lineWidth = 2
      ctx.stroke()
      if (!m.faded) {
        ctx.fillStyle = 'rgba(250,204,21,0.10)'
        ctx.fill()
      }
      drawBadge(ctx, nameMap.get(m.id) ?? `#${m.id}`, m.x, m.y - r - 4, '#fde68a')
    }
  }, [tracked, manual, names, groups, mmPerPx])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCanvasClick || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left)  * (canvas.width  / rect.width)
    const y = (e.clientY - rect.top)   * (canvas.height / rect.height)
    onCanvasClick(x, y)
  }

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onClick={handleClick}
      />
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Initializing camera…
        </div>
      )}
    </div>
  )
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
) {
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const w = ctx.measureText(text).width + 8
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - w / 2, y - 14, w, 15)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}
