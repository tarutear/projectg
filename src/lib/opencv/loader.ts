import type { OpenCV } from './types'

type G = typeof self & {
  cv?: OpenCV & { Mat?: unknown; onRuntimeInitialized?: () => void }
  Module?: { locateFile?: (f: string) => string }
}

let cached: OpenCV | null = null
let pending: Promise<OpenCV> | null = null

export function loadOpenCVInWorker(src = '/opencv/opencv.js'): Promise<OpenCV> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = new Promise<OpenCV>((resolve, reject) => {
    let settled = false
    let pollId: ReturnType<typeof setInterval> | null = null

    const timer = setTimeout(() => {
      if (pollId) clearInterval(pollId)
      if (!settled) reject(new Error('OpenCV.js init timeout (30s)'))
    }, 30_000)

    const finish = (cv: OpenCV) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (pollId) clearInterval(pollId)
      cached = cv
      resolve(cv)
    }

    // Step 1: load the script synchronously via importScripts.
    // Content-Type must be application/javascript (fixed in next.config.mjs).
    try {
      ;(self as unknown as { importScripts(...u: string[]): void }).importScripts(src)
    } catch (e) {
      settled = true
      clearTimeout(timer)
      reject(new Error(`importScripts('${src}') failed: ${e}`))
      return
    }

    const g = self as G

    // Step 2: after importScripts, cv object exists but WASM may still be
    // loading asynchronously. cv.Mat is only defined once WASM is ready.
    if (!g.cv) {
      settled = true
      clearTimeout(timer)
      reject(new Error('cv not defined after importScripts'))
      return
    }

    // Already fully initialised (asm.js or very fast init)
    if (g.cv.Mat) {
      finish(g.cv as OpenCV)
      return
    }

    // Official OpenCV.js Worker pattern: set the callback on cv itself.
    // Emscripten calls cv['onRuntimeInitialized'] once the WASM heap is ready.
    g.cv.onRuntimeInitialized = () => {
      if (g.cv?.Mat) finish(g.cv as OpenCV)
    }

    // Polling failsafe — catches cases where the callback was already invoked
    // before we registered it, or is never invoked by this build.
    pollId = setInterval(() => {
      if ((self as G).cv?.Mat) finish((self as G).cv as OpenCV)
    }, 250)
  })

  return pending
}
