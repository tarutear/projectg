import type { OpenCV } from './types'

type G = typeof self & {
  cv?: OpenCV & { calledRun?: boolean; then?: (fn: (cv: OpenCV) => void) => void }
  Module?: { onRuntimeInitialized?: () => void; locateFile?: (f: string) => string }
}

let cached: OpenCV | null = null
let pending: Promise<OpenCV> | null = null

export function loadOpenCVInWorker(src = '/opencv/opencv.js'): Promise<OpenCV> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = new Promise<OpenCV>((resolve, reject) => {
    const g = self as G

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

    // Set Module BEFORE importScripts so Emscripten picks it up
    g.Module = {
      // locateFile ensures opencv_js.wasm is fetched from the same folder as opencv.js
      locateFile: (filename: string) => `/opencv/${filename}`,
      onRuntimeInitialized() {
        const cv = (self as G).cv
        if (cv) finish(cv)
      },
    }

    try {
      ;(self as unknown as { importScripts: (...u: string[]) => void }).importScripts(src)
    } catch (e) {
      settled = true
      clearTimeout(timer)
      reject(new Error(`importScripts('${src}') failed: ${e}`))
      return
    }

    // Case 1: some builds expose cv as a Promise
    const maybeCv = (self as G).cv
    if (maybeCv?.then) {
      maybeCv.then((cv: OpenCV) => finish(cv))
      return
    }

    // Case 2: synchronous init (asm.js builds)
    if (maybeCv) {
      finish(maybeCv)
      return
    }

    // Case 3: async WASM init — poll until cv appears (fallback if callback is missed)
    pollId = setInterval(() => {
      const cv = (self as G).cv
      if (cv && !cv.then) finish(cv)
    }, 200)
  })

  return pending
}
