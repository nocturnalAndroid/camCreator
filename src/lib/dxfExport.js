/**
 * Convert a cam profile to an array of DXF entity strings.
 * @param {object} profile - from buildCamProfile
 * @param {string} layerName
 * @returns {string[]}
 */
export function profileToDxf(profile, layerName) {
  return profile.segments.map(seg => {
    if (seg.type === 'arc') return arcToDxf(seg, layerName)
    if (seg.type === 'bezier') return bezierToDxf(seg, layerName)
    return ''
  })
}

function arcToDxf({ radius, startDeg, endDeg }, layer) {
  const start = startDeg % 360
  const end = endDeg % 360
  return [
    '  0', 'ARC',
    '  8', layer,
    ' 10', '0.0',
    ' 20', '0.0',
    ' 30', '0.0',
    ' 40', radius.toFixed(6),
    ' 50', start.toFixed(6),
    ' 51', end.toFixed(6),
  ].join('\n')
}

function bezierToDxf({ points }, layer) {
  const knots = [0, 0, 0, 0, 1, 1, 1, 1]
  const lines = [
    '  0', 'SPLINE',
    '  8', layer,
    ' 70', '8',
    ' 71', '3',
    ' 72', String(knots.length),
    ' 73', String(points.length),
    ' 74', '0',
  ]
  knots.forEach(k => { lines.push(' 40'); lines.push(k.toFixed(6)) })
  points.forEach(p => {
    lines.push(' 10'); lines.push(p.x.toFixed(6))
    lines.push(' 20'); lines.push(p.y.toFixed(6))
    lines.push(' 30'); lines.push('0.000000')
  })
  return lines.join('\n')
}

/**
 * Wrap entity arrays into a complete DXF file string.
 * @param {string[][]} allEntities - array of entity arrays (one array per cam)
 * @param {string[]} layerNames
 * @returns {string}
 */
export function buildDxfFile(allEntities, layerNames) {
  const header = [
    '  0', 'SECTION',
    '  2', 'HEADER',
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'TABLES',
    '  0', 'TABLE',
    '  2', 'LAYER',
    ...layerNames.flatMap(name => [
      '  0', 'LAYER',
      '  2', name,
      ' 70', '0',
      ' 62', '7',
      '  6', 'CONTINUOUS',
    ]),
    '  0', 'ENDTAB',
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'ENTITIES',
  ].join('\n')

  const entityBlock = allEntities.flat().join('\n')
  const footer = ['  0', 'ENDSEC', '  0', 'EOF'].join('\n')

  return [header, entityBlock, footer].join('\n')
}
