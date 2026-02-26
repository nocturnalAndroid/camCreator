/**
 * Build a cam profile from a boolean array.
 *
 * Returns a list of segments. Each segment is one of:
 *   { type: 'arc', radius, startDeg, endDeg, spanDeg }
 *   { type: 'bezier', points: [{x,y},{x,y},{x,y},{x,y}], startDeg, endDeg, spanDeg }
 *
 * Angles are in degrees, measured counter-clockwise from the positive X axis.
 * The cam profile starts at angle 0 and goes counter-clockwise for 360°.
 */
export function buildCamProfile(bools, { innerRadius, outerRadius, transitionAngleDeg, easeIn, easeOut }) {
  const N = bools.length
  const stepDeg = 360 / N
  const halfTransDeg = transitionAngleDeg / 2

  // Find all edge transitions: indices where bools[i] !== bools[(i+1) % N]
  const transitions = []
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N
    if (bools[i] !== bools[next]) {
      // transition happens between sample i and sample next
      // boundary angle = midpoint between the two sample angles
      const angleDeg = (i + 1) * stepDeg // angle at start of next sample
      transitions.push({ angleDeg, fromOuter: bools[i], toOuter: bools[next] })
    }
  }

  // If no transitions, the entire cam is one arc
  if (transitions.length === 0) {
    const radius = bools[0] ? outerRadius : innerRadius
    return {
      segments: [{
        type: 'arc', radius,
        startDeg: 0, endDeg: 360, spanDeg: 360,
      }]
    }
  }

  // Build segments between transitions
  const segments = []
  const nTrans = transitions.length

  for (let ti = 0; ti < nTrans; ti++) {
    const t = transitions[ti]
    const tNext = transitions[(ti + 1) % nTrans]

    // Compute how far we can extend this transition without overlapping neighbors
    const prevT = transitions[(ti - 1 + nTrans) % nTrans]
    const gapBefore = angleDiff(t.angleDeg, prevT.angleDeg) // degrees available before this transition
    const gapAfter = angleDiff(tNext.angleDeg, t.angleDeg)  // degrees available after this transition

    const maxHalfBefore = gapBefore / 2
    const maxHalfAfter = gapAfter / 2
    const actualHalf = Math.min(halfTransDeg, maxHalfBefore, maxHalfAfter)

    const transStartDeg = t.angleDeg - actualHalf
    const transEndDeg = t.angleDeg + actualHalf
    const transSpan = actualHalf * 2

    // Flat arc from end of previous transition to start of this transition
    const prevTransEnd = (() => {
      const prevT2 = transitions[(ti - 1 + nTrans) % nTrans]
      const gapBefore2 = angleDiff(t.angleDeg, prevT2.angleDeg)
      const maxHalf2 = Math.min(halfTransDeg, gapBefore2 / 2, angleDiff(t.angleDeg, prevT2.angleDeg) / 2)
      return (prevT2.angleDeg + maxHalf2) % 360
    })()

    const arcStartDeg = prevTransEnd
    const arcEndDeg = transStartDeg
    const arcSpan = ((arcEndDeg - arcStartDeg) % 360 + 360) % 360

    if (arcSpan > 0.001) {
      const radius = t.fromOuter ? outerRadius : innerRadius
      segments.push({
        type: 'arc', radius,
        startDeg: arcStartDeg, endDeg: arcEndDeg, spanDeg: arcSpan,
      })
    }

    // Bezier transition
    const r1 = t.fromOuter ? outerRadius : innerRadius
    const r2 = t.toOuter ? outerRadius : innerRadius
    const transSpanRad = transSpan * Math.PI / 180
    const startRad = transStartDeg * Math.PI / 180
    const endRad = transEndDeg * Math.PI / 180

    const P0 = { x: r1 * Math.cos(startRad), y: r1 * Math.sin(startRad) }
    const P3 = { x: r2 * Math.cos(endRad), y: r2 * Math.sin(endRad) }

    // Tangent at P0 (perpendicular to radius, in CCW direction)
    const tangent0 = { x: -Math.sin(startRad), y: Math.cos(startRad) }
    // Tangent at P3
    const tangent3 = { x: -Math.sin(endRad), y: Math.cos(endRad) }

    const handleLen1 = easeIn * r1 * transSpanRad / 2
    const handleLen2 = easeOut * r2 * transSpanRad / 2

    const P1 = { x: P0.x + tangent0.x * handleLen1, y: P0.y + tangent0.y * handleLen1 }
    const P2 = { x: P3.x - tangent3.x * handleLen2, y: P3.y - tangent3.y * handleLen2 }

    segments.push({
      type: 'bezier',
      points: [P0, P1, P2, P3],
      startDeg: transStartDeg, endDeg: transEndDeg, spanDeg: transSpan,
    })
  }

  return { segments }
}

/** Positive angular difference from a to b (counter-clockwise), in degrees */
function angleDiff(b, a) {
  return ((b - a) % 360 + 360) % 360
}
