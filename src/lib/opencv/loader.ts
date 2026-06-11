import type { OpenCV } from './types'

type G = typeof self & {
  cv?: unknown
  Module?: { onRuntimeInitialized?: () => void }
}

let cached: OpenCV | null = null
let pending: Promise<OpenCV> | null = null

function isThenable(v: unknown): v is PromiseLike<OpenCV> {
  return v != null && typeof (v as Record<string, unknown>).then === 'function'
}

function isCvReady(v: unknown): v is OpenCV {
  return v != null && typeof v === 'object' && Boolean((v as Record<string, unknown>).Mat)
}

export function loadOpenCVInWorker(src = '/opencv/opencv.js'): Promise<OpenCV> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = new Promise<OpenCV>((resolve, reject) => {
    let settled = false
    let pollId: ReturnType<typeof setInterval> | null = null

    const timer = setTimeout(() => {
      if (!settled) {
        const g = self as G
        console.error(
          '[OpenCV] 30s timeout | cv type:', typeof g.cv,
          '| thenable:', isThenable(g.cv),
          '| ready:', isCvReady(g.cv)
        )
        cleanup()
        reject(new Error('OpenCV.js init timeout (30s)'))
      }
    }, 30_000)

    const cleanup = () => {
      clearTimeout(timer)
      if (pollId) clearInterval(pollId)
    }

    const finish = (cv: OpenCV) => {
      if (settled) return
      settled = true
      cleanup()
      // The OpenCV.js Module is itself a thenable (Emscripten MODULARIZE adds a
      // `then`). Resolving a Promise with a thenable makes the JS runtime try to
      // assimilate it by calling cv.then(), which for this build never completes
      // -> `await loadOpenCVInWorker()` would hang forever even though init is
      // done. Strip `then` so cv resolves as a plain value.
      const anyCv = cv as unknown as Record<string, unknown>
      try {
        delete anyCv.then
      } catch {
        /* property may be non-configurable; fall through to overwrite */
      }
      anyCv.then = undefined
      cached = cv
      console.log('[OpenCV] ready (then stripped:', typeof anyCv.then, ')')
      resolve(cv)
    }

    const fail = (msg: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(msg))
    }

    const afterImport = () => {
      if (settled) return  // fetch completed after timeout; avoid orphaned setInterval
      const g = self as G
      console.log(
        '[OpenCV] afterImport | cv type:', typeof g.cv,
        '| thenable:', isThenable(g.cv),
        '| ready:', isCvReady(g.cv)
      )

      if (!g.cv) { fail('cv not defined after importScripts'); return }

      // Case A: cv is a Promise (OpenCV.js 4.x factory)
      if (isThenable(g.cv)) {
        console.log('[OpenCV] cv is thenable, awaiting...')
        ;(g.cv as PromiseLike<OpenCV>).then(
          (cv) => { ;(self as G).cv = cv; finish(cv) },
          (err) => fail(`cv Promise rejected: ${err}`)
        )
        return
      }

      // Case B: already ready
      if (isCvReady(g.cv)) {
        finish(g.cv as unknown as OpenCV)
        return
      }

      // Case C: cv exists but WASM still loading
      console.log('[OpenCV] waiting for onRuntimeInitialized...')
      ;(g.cv as Record<string, unknown>).onRuntimeInitialized = () => {
        console.log('[OpenCV] cv.onRuntimeInitialized fired')
        const cv = (self as G).cv
        if (isCvReady(cv)) finish(cv as unknown as OpenCV)
      }
      pollId = setInterval(() => {
        const cv = (self as G).cv
        if (!isThenable(cv) && isCvReady(cv)) finish(cv as unknown as OpenCV)
      }, 200)
    }

    // Pre-configure Module so Emscripten picks up our callback even before
    // the cv object is available.
    ;(self as G).Module = {
      onRuntimeInitialized: () => {
        console.log('[OpenCV] Module.onRuntimeInitialized fired')
        const cv = (self as G).cv
        if (isCvReady(cv)) finish(cv as unknown as OpenCV)
      },
    }

    // Fetch the script as binary, then re-wrap it as a Blob with an explicit
    // text/javascript MIME type before calling importScripts.  This bypasses
    // any server Content-Type mismatch that would cause importScripts to throw
    // a NetworkError (browsers enforce MIME types for importScripts but not
    // for ordinary file downloads).
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${src}`)
        return r.arrayBuffer()
      })
      .then((buf) => {
        const blobUrl = URL.createObjectURL(
          new Blob([buf], { type: 'text/javascript' })
        )
        try {
          ;(self as unknown as { importScripts(...u: string[]): void }).importScripts(blobUrl)
        } finally {
          URL.revokeObjectURL(blobUrl)
        }
        afterImport()
      })
      .catch((err) => fail(`Failed to load ${src}: ${err}`))
  })

  return pending
}
