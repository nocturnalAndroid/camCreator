const DEG = Math.PI / 180

/**
 * Convert a cam profile to an SVG path data string.
 * @param {object} profile - from buildCamProfile
 * @returns {string} SVG path data (d attribute)
 */
export function profileToSvgPath(profile) {
  const cmds = []
  let firstPoint = null

  for (const seg of profile.segments) {
    if (seg.type === 'arc') {
      const r = seg.radius
      if (seg.spanDeg >= 359.99) {
        // Full circle: SVG can't draw as single arc, split into two
        if (!firstPoint) firstPoint = { x: r, y: 0 }
        cmds.push(`M ${fmt(r)} 0`)
        cmds.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r)} 0`)
        cmds.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r)} 0`)
      } else {
        const startRad = seg.startDeg * DEG
        const endRad = seg.endDeg * DEG
        const p0 = { x: r * Math.cos(startRad), y: r * Math.sin(startRad) }
        const p1 = { x: r * Math.cos(endRad), y: r * Math.sin(endRad) }
        const largeArc = seg.spanDeg > 180 ? 1 : 0
        if (!firstPoint) { firstPoint = p0; cmds.push(`M ${fmt(p0.x)} ${fmt(p0.y)}`) }
        else cmds.push(`L ${fmt(p0.x)} ${fmt(p0.y)}`)
        cmds.push(`A ${fmt(r)} ${fmt(r)} 0 ${largeArc} 1 ${fmt(p1.x)} ${fmt(p1.y)}`)
      }
    } else if (seg.type === 'bezier') {
      const [P0, P1, P2, P3] = seg.points
      if (!firstPoint) { firstPoint = P0; cmds.push(`M ${fmt(P0.x)} ${fmt(P0.y)}`) }
      else cmds.push(`L ${fmt(P0.x)} ${fmt(P0.y)}`)
      cmds.push(`C ${fmt(P1.x)} ${fmt(P1.y)} ${fmt(P2.x)} ${fmt(P2.y)} ${fmt(P3.x)} ${fmt(P3.y)}`)
    }
  }

  cmds.push('Z')
  return cmds.join(' ')
}

function fmt(n) { return n.toFixed(4) }

/**
 * Build a complete SVG file string.
 * @param {{ path: string, label: string }[]} cams
 * @param {number} viewBoxSize - half-size for viewBox (e.g. outerRadius * 1.2)
 * @returns {string}
 */
export function buildSvgFile(cams, viewBoxSize) {
  const v = viewBoxSize
  const groups = cams.map(({ path, label }) =>
    `  <g id="${label}" inkscape:label="${label}">\n    <path d="${path}" fill="none" stroke="black" stroke-width="0.5"/>\n  </g>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  viewBox="${-v} ${-v} ${v*2} ${v*2}" width="${v*2}mm" height="${v*2}mm">
${groups}
</svg>`
}
