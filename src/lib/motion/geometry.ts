export interface Point2D { x: number; y: number }

/** Interior angle at vertex `b` formed by rays b→a and b→c, in degrees (0–180). */
export function angleDeg(a: Point2D, b: Point2D, c: Point2D): number {
  const ax = a.x - b.x, ay = a.y - b.y
  const cx = c.x - b.x, cy = c.y - b.y
  const dot   = ax * cx + ay * cy
  const cross = Math.abs(ax * cy - ay * cx)
  return Math.atan2(cross, dot) * (180 / Math.PI)
}

/**
 * Compute angle for 3 points with configurable vertex and variant.
 * vertexIndex: which of the 3 points is the pivot (0, 1, or 2).
 * variant: 'interior' returns 0-180°; 'supplement' returns 180° - interior.
 */
export function computeAngle(
  pts: [Point2D, Point2D, Point2D],
  vertexIndex: 0 | 1 | 2 = 1,
  variant: 'interior' | 'supplement' = 'interior',
): number {
  const others = ([0, 1, 2] as const).filter((i) => i !== vertexIndex) as [number, number]
  const interior = angleDeg(pts[others[0]], pts[vertexIndex], pts[others[1]])
  return variant === 'supplement' ? 180 - interior : interior
}

/** Euclidean distance in pixels. */
export function distancePx(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/** Convert a pixel distance to millimetres using a known scale factor. */
export function pxToMm(px: number, mmPerPx: number): number {
  return px * mmPerPx
}
