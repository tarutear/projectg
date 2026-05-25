export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}
