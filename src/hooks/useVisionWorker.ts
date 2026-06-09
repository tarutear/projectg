'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RawMarker } from '@/lib/opencv/detector'

export type WorkerState = 'idle' | 'initializing' | 'ready' | 'error'

type ResultHandler = (markers: RawMarker[], frameId: number, latencyMs: number) => void

export function useVisionWorker() {
  const [state, setState] = useState<WorkerState>('idle')
  const workerRef = useRef<Worker | null>(null)
  const handlerRef = useRef<ResultHandler | null>(null)

  useEffect(() => {
    setState('initializing')
    // Use classic worker (no { type: 'module' }) so importScripts is available
    // for loading OpenCV.js at runtime. webpack bundles our TS imports inline.
    const worker = new Worker(
      new URL('../workers/vision.worker.ts', import.meta.url)
    )
    console.log('[useVisionWorker] worker created')

    worker.onmessage = ({ data }) => {
      console.log('[useVisionWorker] message:', data.type)
      if (data.type === 'READY') {
        console.log('[useVisionWorker] -> setState(ready)')
        setState('ready')
      } else if (data.type === 'DETECTION_RESULT') {
        handlerRef.current?.(data.markers, data.frameId, data.latencyMs)
      } else if (data.type === 'ERROR') {
        console.error('[VisionWorker]', data.message)
        if (!data.message.includes('not ready')) setState('error')
      }
    }

    worker.onerror = (e) => {
      console.error('[VisionWorker] fatal', e)
      setState('error')
    }

    workerRef.current = worker
    const opencvUrl =
      process.env.NEXT_PUBLIC_OPENCV_URL ??
      (process.env.NODE_ENV === 'production'
        ? 'https://docs.opencv.org/4.x/opencv.js'
        : '/opencv/opencv.js')
    worker.postMessage({ type: 'INIT', opencvUrl })

    return () => {
      console.log('[useVisionWorker] cleanup -> worker.terminate()')
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const processFrame = useCallback(
    (buffer: ArrayBuffer, width: number, height: number, frameId: number) => {
      workerRef.current?.postMessage(
        { type: 'PROCESS_FRAME', frameId, buffer, width, height },
        [buffer]
      )
    },
    []
  )

  const onResult = useCallback((handler: ResultHandler) => {
    handlerRef.current = handler
  }, [])

  return { state, processFrame, onResult }
}
