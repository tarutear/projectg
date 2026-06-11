'use client'

import { useRef, useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import { useCameraStore } from '@/store/cameraStore'
import { useMarkerStore } from '@/store/markerStore'
import { useAngleStore } from '@/store/angleStore'
import { useCoordinateStore, estimatePxPerCm, pairScale } from '@/store/coordinateStore'
import { computeAngle, distancePx } from '@/lib/motion/geometry'

const CLICK_RADIUS = 48  // px in canvas coords — how close a click must be to confirm

interface Props {
  videoRef: RefObject<HTMLVideoElement>
  onMarkerConfirm?: (id: number) => void
}

export function CameraView({ videoRef, onMarkerConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { error, stream } = useCameraStore()
  const { tracked, confirmedIds, names } = useMarkerStore()
  const { groups, mmPerPx } = useAngleStore()
  const { enabled: coordEnabled, calibratedPxPerCm } = useCoordinateStore()

  const confirmedSet = useMemo(() => new Set(confirmedIds), [confirmedIds])

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

    // Mirror x coordinates so the canvas matches the CSS-mirrored video
    const W = canvas.width
    const mx = (x: number) => W - x

    // Estimate live pxPerCm from confirmed markers' radii
    const confirmedRadii = tracked.filter((m) => confirmedSet.has(m.id)).map((m) => m.radius)
    const livePxPerCm = estimatePxPerCm(confirmedRadii)

    const nameMap = new Map(names.map((n) => [n.markerId, n.name]))
    const hasConfirmed = confirmedIds.length > 0
    const posMap = new Map(tracked.map((m) => [m.id, m]))

    // Draw angle / distance group lines
    for (const g of groups) {
      const pts = g.markerIds.map((id) => posMap.get(id)).filter(Boolean)
      if (pts.length < 2) continue

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(96,165,250,0.75)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.moveTo(mx(pts[0]!.x), pts[0]!.y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]!.x), pts[i]!.y)
      ctx.stroke()
      ctx.setLineDash([])

      if (g.type === 'angle' && pts.length === 3) {
        const deg = computeAngle(
          [pts[0]!, pts[1]!, pts[2]!],
          g.vertexIndex ?? 1,
          g.angleVariant ?? 'interior',
        )
        const vx = pts[g.vertexIndex ?? 1]!
        drawBadge(ctx, `${deg.toFixed(1)}°`, mx(vx.x), vx.y - Math.max(vx.radius, 16) - 4, '#93c5fd')
      } else if (g.type === 'distance' && pts.length === 2) {
        const px  = distancePx(pts[0]!, pts[1]!)
        const mA  = pts[0]!, mB = pts[1]!
        const scale = pairScale(mA.radius, mB.radius, calibratedPxPerCm)
        let val: string
        if (scale && (calibratedPxPerCm || coordEnabled)) {
          val = `${(px / scale).toFixed(2)} cm`
        } else if (mmPerPx) {
          val = `${(px * mmPerPx).toFixed(1)} mm`
        } else {
          val = `${px.toFixed(0)} px`
        }
        drawBadge(ctx, val, mx((pts[0]!.x + pts[1]!.x) / 2), (pts[0]!.y + pts[1]!.y) / 2 - 14, '#93c5fd')
      }
    }

    // Draw marker circles
    for (const m of tracked) {
      const isConfirmed = confirmedSet.has(m.id)
      const isGhost     = m.missingFrames > 0

      if (hasConfirmed && !isConfirmed) {
        // Unconfirmed markers: small dim dashed ring — still clickable for confirmation
        const r = Math.max(m.radius, 8)
        ctx.beginPath()
        ctx.arc(mx(m.x), m.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(250,204,21,0.25)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
        continue
      }

      // Confirmed (or detection phase where all shown equally)
      const alpha = isGhost ? 0.3 : (isConfirmed ? 1.0 : 0.75)
      const r     = Math.max(m.radius, 8)

      ctx.beginPath()
      ctx.arc(mx(m.x), m.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = isConfirmed
        ? `rgba(74,222,128,${alpha})`   // green for confirmed
        : `rgba(250,204,21,${alpha})`   // yellow for detection phase
      ctx.lineWidth = isConfirmed ? 2.5 : 2
      ctx.stroke()

      if (!isGhost) {
        ctx.fillStyle = isConfirmed
          ? 'rgba(74,222,128,0.10)'
          : 'rgba(250,204,21,0.10)'
        ctx.fill()
      }

      const label = nameMap.get(m.id) ?? `#${m.id}`
      const badgeColor = isConfirmed ? '#86efac' : '#fde68a'
      drawBadge(ctx, label, mx(m.x), m.y - r - 4, badgeColor)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked, confirmedIds, names, groups, mmPerPx, coordEnabled, calibratedPxPerCm])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onMarkerConfirm || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    // Mirror x to match the CSS-mirrored video
    const x = canvas.width - (e.clientX - rect.left) * (canvas.width  / rect.width)
    const y = (e.clientY - rect.top)   * (canvas.height / rect.height)

    // Find nearest visible (non-ghost) tracked marker within click radius
    let bestId = -1, bestDist = CLICK_RADIUS
    for (const m of tracked) {
      if (m.missingFrames > 0) continue
      const dx = m.x - x, dy = m.y - y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < bestDist) { bestDist = d; bestId = m.id }
    }

    if (bestId >= 0) onMarkerConfirm(bestId)
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
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-pointer"
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
