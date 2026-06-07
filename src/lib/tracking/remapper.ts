export interface TrackedMarker {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  lastSeenFrame: number
  missingFrames: number
}

interface RawMarker {
  x: number
  y: number
  radius: number
}

const MAX_MATCH_DIST  = 80    // px: base match radius for visible markers
const MAX_MISSING     = 60    // frames before dropping a lost marker (~2s @ 30fps)
const VELOCITY_DECAY  = 0.85  // per-frame velocity decay for ghost prediction

let nextId = 1

/** Predict ghost marker position with decaying velocity.
 *  Uses geometric-series sum so prediction converges instead of drifting unboundedly. */
function predictPos(m: TrackedMarker): { x: number; y: number } {
  const n     = m.missingFrames
  const scale = n <= 0 ? 0 : (1 - Math.pow(VELOCITY_DECAY, n)) / (1 - VELOCITY_DECAY)
  return { x: m.x + m.vx * scale, y: m.y + m.vy * scale }
}

/** Assign stable integer IDs to detected blobs using nearest-neighbour matching.
 *  Ghost markers use velocity-predicted positions and an expanded match radius.
 *  When confirmedIds is provided and non-empty, unmatched detections are ignored
 *  (no new IDs created), keeping the tracked set frozen to confirmed markers. */
export function remapMarkers(
  tracked: TrackedMarker[],
  detected: RawMarker[],
  frameId: number,
  confirmedIds?: ReadonlySet<number>
): TrackedMarker[] {
  const lockdown = (confirmedIds?.size ?? 0) > 0
  const usedTracked = new Set<number>()
  const result: TrackedMarker[] = []

  for (const raw of detected) {
    let bestIdx = -1, bestDist = Infinity

    for (let i = 0; i < tracked.length; i++) {
      if (usedTracked.has(i)) continue
      // Ghost markers: use predicted position and allow a larger radius
      const pos   = tracked[i].missingFrames > 0 ? predictPos(tracked[i]) : tracked[i]
      const limit = MAX_MATCH_DIST + tracked[i].missingFrames * 3
      const dx = raw.x - pos.x
      const dy = raw.y - pos.y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < limit && d < bestDist) { bestDist = d; bestIdx = i }
    }

    if (bestIdx >= 0) {
      const prev = tracked[bestIdx]
      usedTracked.add(bestIdx)
      result.push({
        ...prev,
        x: raw.x, y: raw.y,
        vx: raw.x - prev.x,
        vy: raw.y - prev.y,
        radius: raw.radius,
        lastSeenFrame: frameId, missingFrames: 0,
      })
    } else if (!lockdown) {
      // Only create new IDs during the detection phase (before any confirmation)
      result.push({
        id: nextId++, x: raw.x, y: raw.y, vx: 0, vy: 0,
        radius: raw.radius, lastSeenFrame: frameId, missingFrames: 0,
      })
    }
  }

  // Keep recently lost markers as ghosts so they can be re-matched
  for (let i = 0; i < tracked.length; i++) {
    if (usedTracked.has(i)) continue
    const missing = tracked[i].missingFrames + 1
    if (missing <= MAX_MISSING) result.push({ ...tracked[i], missingFrames: missing })
  }

  return result
}
