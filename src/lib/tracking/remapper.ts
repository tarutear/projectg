export interface TrackedMarker {
  id: number
  x: number
  y: number
  radius: number
  lastSeenFrame: number
  missingFrames: number
}

interface RawMarker {
  x: number
  y: number
  radius: number
}

const MAX_MATCH_DIST = 80  // px: max displacement between consecutive frames
const MAX_MISSING   = 10  // frames before dropping a lost marker

let nextId = 1

/** Assign stable integer IDs to detected blobs using nearest-neighbour matching. */
export function remapMarkers(
  tracked: TrackedMarker[],
  detected: RawMarker[],
  frameId: number
): TrackedMarker[] {
  const usedTracked = new Set<number>()
  const result: TrackedMarker[] = []

  for (const raw of detected) {
    let bestIdx = -1, bestDist = MAX_MATCH_DIST + 1

    for (let i = 0; i < tracked.length; i++) {
      if (usedTracked.has(i)) continue
      const dx = raw.x - tracked[i].x
      const dy = raw.y - tracked[i].y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }

    if (bestIdx >= 0 && bestDist <= MAX_MATCH_DIST) {
      usedTracked.add(bestIdx)
      result.push({
        ...tracked[bestIdx],
        x: raw.x, y: raw.y, radius: raw.radius,
        lastSeenFrame: frameId, missingFrames: 0,
      })
    } else {
      result.push({
        id: nextId++, x: raw.x, y: raw.y, radius: raw.radius,
        lastSeenFrame: frameId, missingFrames: 0,
      })
    }
  }

  // Keep recently visible markers that weren't matched this frame
  for (let i = 0; i < tracked.length; i++) {
    if (usedTracked.has(i)) continue
    const missing = tracked[i].missingFrames + 1
    if (missing <= MAX_MISSING) result.push({ ...tracked[i], missingFrames: missing })
  }

  return result
}
