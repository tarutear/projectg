import type { OpenCV } from './types'

type G = typeof self & {
  cv?: unknown
  Module?: { onRuntimeInitialized?: () => void; locateFile?: (f: string) => string }
}

let cached: OpenCV | null = null
let pending: Promise<OpenCV> | null = null

function isThenable(v: unknown): v is Promise<OpenCV> {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).then === 'function'
}

function isCvReady(v: unknown): v is OpenCV {
  return typeof v === 'object' && v !== null && Boolean((v as Record<string, unknown>).Mat)
}

export function loadOpenCVInWorker(src = '/opencv/opencv.js'): Promise<OpenCV> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = new Promise<OpenCV>((resolve, reject) => {
    let settled = false
    let pollId: ReturnType<typeof setInterval> | null = null

    const timer = setTimeout(() => {
      if (pollId) clearInterval(pollId)
      if (!settled) {
        const g = self as G
        console.error(
          '[OpenCV] 30s timeout. typeof cv:', typeof g.cv,
          '| isThenable:', isThenable(g.cv),
          '| isCvReady:', isCvReady(g.cv)
        )
        reject(new Error('OpenCV.js init timeout (30s)'))
      }
    }, 30_000)

    const finish = (cv: OpenCV) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (pollId) clearInterval(pollId)
      cached = cv
      console.log('[OpenCV] initialized successfully')
      resolve(cv)
    }

    // Belt-and-suspenders: configure Module BEFORE importScripts so Emscripten
    // picks up onRuntimeInitialized even if cv-as-Promise path isn't taken.
    ;(self as G).Module = {
      onRuntimeInitialized() {
        const g = self as G
        console.log('[OpenCV] Module.onRuntimeInitialized fired')
        if (isCvReady(g.cv)) {
          finish(g.cv as unknown as OpenCV)
        }
      },
    }

    // Step 1 — load the script synchronously.
    try {
      ;(self as unknown as { importScripts(...u: string[]): void }).importScripts(src)
    } catch (e) {
      settled = true
      clearTimeout(timer)
      reject(new Error(`importScripts('${src}') failed: ${e}`))
      return
    }

    const g = self as G
    console.log(
      '[OpenCV] importScripts done | typeof cv:', typeof g.cv,
      '| isThenable:', isThenable(g.cv),
      '| isCvReady:', isCvReady(g.cv)
    )

    if (!g.cv) {
      settled = true
      clearTimeout(timer)
      reject(new Error('cv not defined after importScripts'))
      return
    }

    // Case A — cv is a Promise (OpenCV.js 4.x UMD factory returns Promise)
    if (isThenable(g.cv)) {
      console.log('[OpenCV] cv is thenable — awaiting Promise...')
      ;(g.cv as Promise<OpenCV>).then((resolvedCv) => {
        console.log('[OpenCV] Promise resolved | isCvReady:', isCvReady(resolvedCv))
        ;(self as G).cv = resolvedCv
        finish(resolvedCv)
      }).catch((err) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error(`OpenCV.js Promise rejected: ${err}`))
        }
      })
      return
    }

    // Case B — cv is the object and Mat is already defined (asm.js / fast init)
    if (isCvReady(g.cv)) {
      console.log('[OpenCV] cv ready immediately')
      finish(g.cv as unknown as OpenCV)
      return
    }

    // Case C — cv object exists but WASM still loading; set the callback on cv.
    console.log('[OpenCV] waiting for cv.onRuntimeInitialized...')
    ;(g.cv as Record<string, unknown>).onRuntimeInitialized = () => {
      console.log('[OpenCV] cv.onRuntimeInitialized fired')
      const current = (self as G).cv
      if (isCvReady(current)) finish(current as unknown as OpenCV)
    }

    // Polling failsafe — catches builds where callbacks are never fired.
    pollId = setInterval(() => {
      const current = (self as G).cv
      if (!isThenable(current) && isCvReady(current)) {
        console.log('[OpenCV] poll detected cv ready')
        finish(current as unknown as OpenCV)
      }
    }, 200)
  })

  return pending
}
