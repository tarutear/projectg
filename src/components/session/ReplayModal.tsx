'use client'

import { useEffect, useRef, useMemo } from 'react'
import type { Session, FrameData } from '@/types/session'
import type { PlaybackSpeed } from '@/hooks/useReplay'

const TRAIL_FRAMES = 30
const MARKER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFD93D', '#C77DFF', '#06D6A0', '#F4A261',
]

function markerColor(id: number) {
  return MARKER_COLORS[id % MARKER_COLORS.length]
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(start: number, end?: number) {
  if (!end) return '-'
  const s = Math.round((end - start) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatTimestamp(frames: FrameData[], index: number) {
  if (frames.length === 0) return '0:00.0'
  const ms = frames[index].timestamp - frames[0].timestamp
  const s = Math.floor(ms / 1000)
  const tenth = Math.floor((ms % 1000) / 100)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenth}`
}

function computeScale(
  session: Session,
  canvasW: number,
  canvasH: number,
  padding = 48,
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const frame of session.frames) {
    for (const pos of Object.values(frame.markerPositions)) {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x)
      maxY = Math.max(maxY, pos.y)
    }
  }
  if (!isFinite(minX)) return { scale: 1, offsetX: canvasW / 2, offsetY: canvasH / 2 }

  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const drawW = canvasW - padding * 2
  const drawH = canvasH - padding * 2
  const scale = Math.min(drawW / spanX, drawH / spanY)
  const offsetX = padding + (drawW - spanX * scale) / 2 - minX * scale
  const offsetY = padding + (drawH - spanY * scale) / 2 - minY * scale
  return { scale, offsetX, offsetY }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  session: Session,
  frameIndex: number,
  markerNames: Record<number, string>,
) {
  const { width, height } = ctx.canvas
  const { scale, offsetX, offsetY } = computeScale(session, width, height)
  const frames = session.frames
  const startIdx = Math.max(0, frameIndex - TRAIL_FRAMES)
  const coordMode = session.coordMode ?? false

  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, width, height)

  // Grid dots
  ctx.fillStyle = '#1a1a1a'
  for (let gx = 40; gx < width; gx += 40) {
    for (let gy = 40; gy < height; gy += 40) {
      ctx.fillRect(gx - 1, gy - 1, 2, 2)
    }
  }

  const markerIds = new Set<number>()
  for (let i = startIdx; i <= frameIndex; i++) {
    Object.keys(frames[i].markerPositions).forEach((k) => markerIds.add(Number(k)))
  }

  // coordMode=false: raw pixel coords → mirror x to match flipped live view, y as-is
  // coordMode=true : cm coords with x right=+, y up=+ → no x mirror, flip y for canvas
  const toCanvas = (pos: { x: number; y: number }) =>
    coordMode
      ? { cx: pos.x * scale + offsetX, cy: height - (pos.y * scale + offsetY) }
      : { cx: width - (pos.x * scale + offsetX), cy: pos.y * scale + offsetY }

  for (const id of markerIds) {
    const color = markerColor(id)
    const positions: { cx: number; cy: number }[] = []

    for (let i = startIdx; i <= frameIndex; i++) {
      const pos = frames[i].markerPositions[id]
      if (pos) {
        positions.push(toCanvas(pos))
      }
    }

    // Trail lines
    for (let j = 1; j < positions.length; j++) {
      const progress = j / TRAIL_FRAMES
      const alpha = Math.min(1, progress * 2) * 0.65
      const hex = Math.round(alpha * 255).toString(16).padStart(2, '0')
      ctx.beginPath()
      ctx.strokeStyle = color + hex
      ctx.lineWidth = 1 + progress * 2.5
      ctx.lineCap = 'round'
      ctx.moveTo(positions[j - 1].cx, positions[j - 1].cy)
      ctx.lineTo(positions[j].cx, positions[j].cy)
      ctx.stroke()
    }

    // Current marker dot
    const cur = positions[positions.length - 1]
    if (!cur) continue

    ctx.beginPath()
    ctx.arc(cur.cx, cur.cy, 9, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    // Label (placed to the left since x is mirrored)
    const label = markerNames[id] ?? `M${id}`
    ctx.font = 'bold 11px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = '#000000'
    ctx.shadowBlur = 4
    ctx.fillText(label, cur.cx - 13, cur.cy - 5)
    ctx.shadowBlur = 0
    ctx.textAlign = 'left'
  }
}

interface ReplayModalProps {
  sessions: Session[]
  session: Session | null
  frameIndex: number
  isPlaying: boolean
  speed: PlaybackSpeed
  markerNames: Record<number, string>
  onOpen: (s: Session) => void
  onClose: () => void
  onSeek: (index: number) => void
  onTogglePlay: () => void
  onSpeedChange: (s: PlaybackSpeed) => void
  onDeleteSession?: (id: string) => void
}

export function ReplayModal({
  sessions,
  session,
  frameIndex,
  isPlaying,
  speed,
  markerNames,
  onOpen,
  onClose,
  onSeek,
  onTogglePlay,
  onSpeedChange,
  onDeleteSession,
}: ReplayModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const totalDuration = useMemo(() => {
    if (!session || session.frames.length < 2) return '-'
    return formatTimestamp(session.frames, session.frames.length - 1)
  }, [session])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !session || session.frames.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawFrame(ctx, session, frameIndex, markerNames)
  }, [session, frameIndex, markerNames])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl shadow-2xl flex overflow-hidden w-[900px] max-w-[95vw] h-[600px] max-h-[90vh]">
        {/* Session list */}
        <div className="w-52 shrink-0 border-r border-gray-800 flex flex-col">
          <div className="px-3 py-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">저장된 세션</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 && (
              <p className="text-xs text-gray-600 p-3">저장된 세션이 없습니다</p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpen(s)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800 transition-colors group ${
                  session?.id === s.id ? 'bg-gray-800 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <p className="text-xs font-medium text-gray-200 truncate">{formatDate(s.startedAt)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {formatDuration(s.startedAt, s.endedAt)} · {s.frames.length}프레임
                </p>
                {onDeleteSession && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id) }}
                    className="text-[10px] text-red-600 hover:text-red-400 opacity-0 group-hover:opacity-100 mt-0.5"
                  >
                    삭제
                  </button>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Replay area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-sm font-semibold">
              {session ? formatDate(session.startedAt) : '세션을 선택하세요'}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-lg leading-none px-1"
            >
              ✕
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center bg-gray-950 relative overflow-hidden">
            {!session ? (
              <p className="text-gray-600 text-sm">왼쪽에서 세션을 선택하세요</p>
            ) : session.frames.length === 0 ? (
              <p className="text-gray-600 text-sm">프레임 데이터가 없습니다</p>
            ) : (
              <canvas
                ref={canvasRef}
                width={640}
                height={420}
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </div>

          {/* Controls */}
          {session && session.frames.length > 0 && (
            <div className="shrink-0 border-t border-gray-800 px-4 py-3 space-y-2">
              {/* Scrubber */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 tabular-nums w-12 text-right">
                  {formatTimestamp(session.frames, frameIndex)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={session.frames.length - 1}
                  value={frameIndex}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-gray-500 tabular-nums w-12">
                  {totalDuration}
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                {/* Rewind */}
                <button
                  onClick={() => onSeek(0)}
                  className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-800"
                >
                  ⏮
                </button>
                {/* Play/Pause */}
                <button
                  onClick={onTogglePlay}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-1 rounded font-medium"
                >
                  {isPlaying ? '⏸ 일시정지' : '▶ 재생'}
                </button>
                {/* Speed */}
                <div className="ml-auto flex gap-1">
                  {([0.5, 1, 2] as PlaybackSpeed[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => onSpeedChange(s)}
                      className={`text-[10px] px-2 py-1 rounded font-mono ${
                        speed === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                {/* Frame info */}
                <span className="text-[10px] text-gray-600 tabular-nums">
                  {frameIndex + 1} / {session.frames.length}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
