import type { OpenCV } from './types'

type G = typeof self & {
  cv?: OpenCV & { Mat?: unknown; calledRun?: boolean; then?: unknown }
  Module?: { onRuntimeInitialized?: () => void; locateFile?: (f: string) => string }
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

    // Set Module.onRuntimeInitialized BEFORE importScripts.
    // opencv.js (Emscripten UMD) reads the global Module and preserves
    // onRuntimeInitialized, calling it once WASM is fully instantiated.
    ;(self as G).Module = {
      locateFile: (f: string) => `/opencv/${f}`,
      onRuntimeInitialized() {
        const cv = (self as G).cv
        // cv.Mat is the canary: only defined after WASM API is ready
        if (cv?.Mat) finish(cv as OpenCV)
      },
    }

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch opencv.js → HTTP ${res.status}`)
        return res.text()
      })
      .then((code) => {
        // Blob URL avoids MIME-type enforcement of importScripts
        const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
        try {
          ;(self as unknown as { importScripts(...u: string[]): void }).importScripts(url)
        } finally {
          URL.revokeObjectURL(url)
        }

        const g = self as G

        // Some builds return cv as a Promise (factory pattern)
        if (typeof g.cv?.then === 'function') {
          ;(g.cv as unknown as Promise<OpenCV>).then(finish)
          return
        }

        // Already fully initialised (asm.js or very fast WASM)
        if (g.cv?.Mat) {
          finish(g.cv as OpenCV)
          return
        }

        // Async WASM path: onRuntimeInitialized is the primary trigger;
        // poll every 200 ms as a failsafe in case the callback was missed.
        pollId = setInterval(() => {
          if ((self as G).cv?.Mat) finish((self as G).cv as OpenCV)
        }, 200)
      })
      .catch((e: unknown) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error(String(e)))
        }
      })
  })

  return pending
}
