import type { OpenCV, CvMat } from './types'

// HSV range for yellow markers (OpenCV: H 0–180, S/V 0–255).
// Widened to handle different lighting conditions and shades of yellow.
const H_LOW = 18,  H_HIGH = 38
const S_LOW = 120, S_HIGH = 255
const V_LOW = 80,  V_HIGH = 255

const MIN_RADIUS = 8    // px — filter noise specks
const MAX_RADIUS = 150  // px
const MIN_CIRCULARITY = 0.45  // relaxed from 0.6 to tolerate motion-blur distortion

let _debugFrame = 0

export interface RawMarker {
  x: number
  y: number
  radius: number
}

export function detectYellowMarkers(cv: OpenCV, imageData: ImageData): RawMarker[] {
  const src      = cv.matFromImageData(imageData)
  const bgr      = new cv.Mat()
  const hsv      = new cv.Mat()
  const mask     = new cv.Mat()
  const morphed  = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const kernel   = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5))
  let lowerMat: CvMat | null = null
  let upperMat: CvMat | null = null
  const results: RawMarker[] = []

  try {
    cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR)
    cv.cvtColor(bgr, hsv, cv.COLOR_BGR2HSV)

    // cv.inRange in this OpenCV.js build only accepts Mat (not Scalar).
    // Use the 4-arg Mat constructor to create full-size constant bound Mats.
    lowerMat = new cv.Mat(hsv.rows, hsv.cols, cv.CV_8UC3, new cv.Scalar(H_LOW,  S_LOW,  V_LOW,  0))
    upperMat = new cv.Mat(hsv.rows, hsv.cols, cv.CV_8UC3, new cv.Scalar(H_HIGH, S_HIGH, V_HIGH, 0))
    cv.inRange(hsv, lowerMat, upperMat, mask)

    try {
      const nonZero = cv.countNonZero(mask)
      if (++_debugFrame % 30 === 0) {
        console.log(`[detector] frame=${_debugFrame} nonZero=${nonZero} size=${hsv.cols}x${hsv.rows}`)
      }
    } catch { /* countNonZero not available in all builds */ }

    cv.morphologyEx(mask, morphed, cv.MORPH_OPEN,  kernel)
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel)

    cv.findContours(
      morphed, contours, hierarchy,
      cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE
    )

    if (_debugFrame % 30 === 0) {
      console.log(`[detector] contours=${contours.size()}`)
    }

    for (let i = 0; i < contours.size(); i++) {
      const cnt    = contours.get(i)
      const area   = cv.contourArea(cnt)
      const radius = Math.sqrt(area / Math.PI)

      if (radius < MIN_RADIUS || radius > MAX_RADIUS) continue
      if (area / (Math.PI * radius * radius) < MIN_CIRCULARITY) continue

      const m = cv.moments(cnt)
      if (m.m00 === 0) continue

      results.push({ x: m.m10 / m.m00, y: m.m01 / m.m00, radius })
    }
  } finally {
    src.delete(); bgr.delete(); hsv.delete()
    mask.delete(); morphed.delete()
    contours.delete(); hierarchy.delete(); kernel.delete()
    lowerMat?.delete()
    upperMat?.delete()
  }

  return results
}

// ── Sticker marker detector ────────────────────────────────────────────────
// Target: 6 mm circular sticker — outer 1.5 mm ring is black,
//         inner 3 mm circle is gray.
// Strategy:
//   1. Threshold dark (black) pixels → isolates the outer ring.
//   2. Find circular contours in the dark mask.
//   3. For each candidate, verify the centroid pixel is gray
//      (not black like the ring, not white like background).
//   4. Verify a sample ring at ~70 % radius is darker than the center.

const STICKER_MIN_R    = 3    // px — works from ~30 cm with HD camera
const STICKER_MAX_R    = 50   // px
const STICKER_DARK_THR = 80   // pixels below this are "black"
const STICKER_GRAY_LO  = 55   // center must be brighter than this
const STICKER_GRAY_HI  = 210  // center must be darker than this
const STICKER_MIN_CIRC = 0.50 // relaxed for tiny markers

export function detectStickerMarkers(cv: OpenCV, imageData: ImageData): RawMarker[] {
  const src      = cv.matFromImageData(imageData)
  const bgr      = new cv.Mat()
  const gray     = new cv.Mat()
  const blur     = new cv.Mat()
  const thresh   = new cv.Mat()
  const morphed  = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const results: RawMarker[] = []

  try {
    cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR)
    cv.cvtColor(bgr, gray, cv.COLOR_BGR2GRAY)
    // Small blur to suppress noise while keeping the ring edges sharp
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0)
    // Isolate dark regions (black outer ring of the sticker)
    cv.threshold(blur, thresh, STICKER_DARK_THR, 255, cv.THRESH_BINARY_INV)

    // Close small gaps in the ring outline
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3))
    cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel)
    kernel.delete()

    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    for (let i = 0; i < contours.size(); i++) {
      const cnt  = contours.get(i)
      const area = cv.contourArea(cnt)

      const radius = Math.sqrt(area / Math.PI)
      if (radius < STICKER_MIN_R || radius > STICKER_MAX_R) continue

      const perimeter = cv.arcLength(cnt, true)
      if (perimeter === 0) continue
      const circularity = 4 * Math.PI * area / (perimeter * perimeter)
      if (circularity < STICKER_MIN_CIRC) continue

      const m = cv.moments(cnt)
      if (m.m00 === 0) continue
      const cx = Math.round(m.m10 / m.m00)
      const cy = Math.round(m.m01 / m.m00)
      if (cx < 0 || cx >= gray.cols || cy < 0 || cy >= gray.rows) continue

      // Center must be gray — the hallmark of this sticker pattern
      const centerVal = gray.ucharAt(cy, cx)
      if (centerVal < STICKER_GRAY_LO || centerVal > STICKER_GRAY_HI) continue

      // Ring samples at ~70 % radius must be darker than the center
      const sampleR = Math.max(1, Math.round(radius * 0.7))
      let darkCount = 0
      for (const [dx, dy] of [[sampleR, 0], [-sampleR, 0], [0, sampleR], [0, -sampleR]]) {
        const rx = cx + dx, ry = cy + dy
        if (rx >= 0 && rx < gray.cols && ry >= 0 && ry < gray.rows) {
          if (gray.ucharAt(ry, rx) < STICKER_DARK_THR) darkCount++
        }
      }
      if (darkCount < 2) continue

      results.push({ x: cx, y: cy, radius })
    }
  } finally {
    src.delete(); bgr.delete(); gray.delete(); blur.delete()
    thresh.delete(); morphed.delete()
    contours.delete(); hierarchy.delete()
  }

  return results
}
