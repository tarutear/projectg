import type { OpenCV, CvMat } from './types'

// HSV range for yellow markers (OpenCV: H 0–180, S/V 0–255).
// Widened to handle different lighting conditions and shades of yellow.
const H_LOW = 15,  H_HIGH = 45
const S_LOW = 50,  S_HIGH = 255
const V_LOW = 50,  V_HIGH = 255

const MIN_RADIUS = 3    // px
const MAX_RADIUS = 150  // px
const MIN_CIRCULARITY = 0.3

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
