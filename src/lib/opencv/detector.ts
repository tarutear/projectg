import type { OpenCV } from './types'

// HSV range for 20 mm yellow circular markers under typical indoor lighting.
// OpenCV uses H: 0-180, S/V: 0-255.
const H_LOW = 18,  H_HIGH = 38
const S_LOW = 80,  S_HIGH = 255
const V_LOW = 80,  V_HIGH = 255

const MIN_RADIUS = 4    // px — ignore tiny noise
const MAX_RADIUS = 120  // px — ignore very large blobs
const MIN_CIRCULARITY = 0.45

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
  const results: RawMarker[] = []

  try {
    cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR)
    cv.cvtColor(bgr, hsv, cv.COLOR_BGR2HSV)

    // cv.inRange in OpenCV.js requires Mat bounds, not Scalar.
    // Use 1×1 single-channel Mats; inRange broadcasts them to the full frame.
    const low  = cv.matFromArray(1, 1, cv.CV_8UC3, [H_LOW,  S_LOW,  V_LOW])
    const high = cv.matFromArray(1, 1, cv.CV_8UC3, [H_HIGH, S_HIGH, V_HIGH])
    cv.inRange(hsv, low, high, mask)
    low.delete()
    high.delete()

    // Remove speckle noise, fill small holes
    cv.morphologyEx(mask, morphed, cv.MORPH_OPEN,  kernel)
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel)

    cv.findContours(
      morphed, contours, hierarchy,
      cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE
    )

    for (let i = 0; i < contours.size(); i++) {
      const cnt    = contours.get(i)
      const area   = cv.contourArea(cnt)
      const radius = Math.sqrt(area / Math.PI)

      if (radius < MIN_RADIUS || radius > MAX_RADIUS) continue
      // Circularity: ratio of contour area to enclosing-circle area
      if (area / (Math.PI * radius * radius) < MIN_CIRCULARITY) continue

      const m = cv.moments(cnt)
      if (m.m00 === 0) continue

      results.push({ x: m.m10 / m.m00, y: m.m01 / m.m00, radius })
    }
  } finally {
    src.delete(); bgr.delete(); hsv.delete()
    mask.delete(); morphed.delete()
    contours.delete(); hierarchy.delete(); kernel.delete()
  }

  return results
}
