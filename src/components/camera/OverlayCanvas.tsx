'use client'

import { forwardRef } from 'react'

interface OverlayCanvasProps {
  width?: number
  height?: number
  className?: string
  onCanvasClick?: (x: number, y: number) => void
}

// Standalone overlay canvas — used in Phase 1-3+ when the canvas is
// separated from CameraView for independent marker/angle rendering.
export const OverlayCanvas = forwardRef<HTMLCanvasElement, OverlayCanvasProps>(
  ({ width, height, className, onCanvasClick }, ref) => {
    function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
      if (!onCanvasClick) return
      const rect = e.currentTarget.getBoundingClientRect()
      const scaleX = (e.currentTarget.width ?? 1) / rect.width
      const scaleY = (e.currentTarget.height ?? 1) / rect.height
      onCanvasClick((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    }

    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        className={className}
        style={{ pointerEvents: onCanvasClick ? 'auto' : 'none', cursor: onCanvasClick ? 'crosshair' : 'default' }}
        onClick={handleClick}
      />
    )
  }
)

OverlayCanvas.displayName = 'OverlayCanvas'
