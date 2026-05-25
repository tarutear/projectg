import type { OpenCV } from './types'

type WorkerScope = typeof globalThis & {
  cv?: OpenCV
  Module?: { onRuntimeInitialized?: () => void }
  importScripts?: (...urls: string[]) => void
}

let cached: OpenCV | null = null
let pending: Promise<OpenCV> | null = null

export function loadOpenCVInWorker(src = '/opencv/opencv.js'): Promise<OpenCV> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = new Promise<OpenCV>((resolve, reject) => {
    const scope = globalThis as WorkerScope

    const timer = setTimeout(
      () => reject(new Error('OpenCV.js load timeout (30s)')),
      30_000
    )

    const finish = (cv: OpenCV) => {
      clearTimeout(timer)
      cached = cv
      resolve(cv)
    }

    // OpenCV.js calls Module.onRuntimeInitialized when WASM heap is ready
    scope.Module = {
      onRuntimeInitialized() {
        const cv = (globalThis as WorkerScope).cv
        if (cv) finish(cv)
        else reject(new Error('cv not set after onRuntimeInitialized'))
      },
    }

    try {
      if (!scope.importScripts) {
        throw new Error('importScripts not available — must run in a classic Worker')
      }
      scope.importScripts(src)
      // Some prebuilt binaries skip async init and set cv synchronously
      if (scope.cv) finish(scope.cv)
    } catch (e) {
      clearTimeout(timer)
      reject(new Error(`importScripts('${src}') failed: ${e}`))
    }
  })

  return pending
}
