import type { OpenCV } from './types'

type G = typeof self & {
  cv?: OpenCV & { calledRun?: boolean; then?: (fn: (cv: OpenCV) => void) => void }
  Module?: {
    onRuntimeInitialized?: () => void
    locateFile?: (f: string) => string
  }
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

    // Set Module before script runs so Emscripten picks up our callbacks
    g.Module = {
      locateFile: (filename: string) => `/opencv/${filename}`,
      onRuntimeInitialized() {
        const cv = (self as G).cv
        if (cv) finish(cv)
      },
    }

    // Use fetch + Blob URL instead of importScripts to avoid MIME-type and
    // COEP/CORP header requirements that block importScripts in practice.
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`fetch ${src} failed: HTTP ${res.status}`)
        return res.text()
      })
      .then((code) => {
        const blob = new Blob([code], { type: 'text/javascript' })
        const blobUrl = URL.createObjectURL(blob)
        try {
          // importScripts with a blob: URL always works — no MIME check
          ;(self as unknown as { importScripts: (...u: string[]) => void }).importScripts(
            blobUrl
          )
        } finally {
          URL.revokeObjectURL(blobUrl)
        }

        const cv = (self as G).cv

        // Case 1: newer builds expose cv as a Promise
        if (cv?.then) {
          cv.then((resolved: OpenCV) => finish(resolved))
          return
        }

        // Case 2: asm.js / synchronous init
        if (cv) {
          finish(cv)
          return
        }

        // Case 3: async WASM init — poll until cv is populated
        pollId = setInterval(() => {
          const ready = (self as G).cv
          if (ready && !ready.then) finish(ready)
        }, 200)
      })
      .catch((e) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error(String(e)))
        }
      })
  })

  return pending
}
