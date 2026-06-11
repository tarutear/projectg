import { loadOpenCVInWorker } from '../lib/opencv/loader'
import { detectYellowMarkers, detectStickerMarkers, type RawMarker } from '../lib/opencv/detector'
import type { OpenCV } from '../lib/opencv/types'
import type { DetectorMode } from '../store/markerStore'

type InMsg =
  | { type: 'INIT'; opencvUrl?: string }
  | { type: 'PROCESS_FRAME'; frameId: number; buffer: ArrayBuffer; width: number; height: number; mode: DetectorMode }

type OutMsg =
  | { type: 'READY' }
  | { type: 'ERROR'; message: string; code?: string }
  | { type: 'DETECTION_RESULT'; frameId: number; markers: RawMarker[]; latencyMs: number }

let cv: OpenCV | null = null
const TAG = Math.random().toString(36).slice(2, 6)
console.log(`[Worker ${TAG}] script loaded`)

self.onmessage = async ({ data }: MessageEvent<InMsg>) => {
  if (data.type === 'INIT') {
    console.log(`[Worker ${TAG}] INIT received, loading OpenCV...`)
    try {
      cv = await loadOpenCVInWorker(data.opencvUrl)
      console.log(`[Worker ${TAG}] OpenCV resolved, posting READY`)
      self.postMessage({ type: 'READY' } satisfies OutMsg)
    } catch (e) {
      console.error(`[Worker ${TAG}] INIT failed:`, e)
      self.postMessage({ type: 'ERROR', message: String(e) } satisfies OutMsg)
    }
    return
  }

  if (data.type === 'PROCESS_FRAME') {
    if (!cv) {
      self.postMessage({ type: 'ERROR', message: 'OpenCV not ready', code: 'not_ready' } satisfies OutMsg)
      return
    }
    const t0 = performance.now()
    try {
      const imageData = new ImageData(
        new Uint8ClampedArray(data.buffer),
        data.width,
        data.height
      )
      const markers = data.mode === 'sticker'
        ? detectStickerMarkers(cv, imageData)
        : detectYellowMarkers(cv, imageData)
      self.postMessage({
        type: 'DETECTION_RESULT',
        frameId: data.frameId,
        markers,
        latencyMs: performance.now() - t0,
      } satisfies OutMsg)
    } catch (e) {
      self.postMessage({ type: 'ERROR', message: String(e) } satisfies OutMsg)
    }
  }
}
