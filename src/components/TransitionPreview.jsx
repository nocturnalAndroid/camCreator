import { useMemo } from 'react'
import { buildCamProfile } from '../lib/camGeometry'
import { profileToSvgPath } from '../lib/svgExport'

const TEST_BOOLS = [false, false, true, true, false, true, false, false, true, false]

export default function TransitionPreview({ params, image }) {
  const totalCols = image
    ? Math.max(11, Math.round(image.width / Math.max(1, params.colSpacingPx)))
    : 10
  const showAngleDeg = (10 / totalCols) * 360
  const transitionAngleDeg = params.outerRadius > 0
    ? (params.transitionDistanceMm / params.outerRadius) * (180 / Math.PI)
    : 0

  const profile = useMemo(() => {
    const seq = totalCols > 10
      ? [...TEST_BOOLS, ...new Array(totalCols - 10).fill(false)]
      : TEST_BOOLS
    return buildCamProfile(seq, {
      innerRadius: params.innerRadius,
      outerRadius: params.outerRadius,
      transitionAngleDeg,
      easeIn: params.easeIn,
      easeOut: params.easeOut,
    })
  }, [params.innerRadius, params.outerRadius, transitionAngleDeg, params.easeIn, params.easeOut, totalCols])

  const path = profileToSvgPath(profile)
  const ro = params.outerRadius
  const ri = params.innerRadius
  const sw = ro * 0.015

  // Full-circle view (no image loaded)
  if (showAngleDeg >= 359.9) {
    const v = ro * 1.25
    return (
      <div>
        <h3>Transition preview · F·F·T·T·F·T·F·F·T·F</h3>
        <svg viewBox={`${-v} ${-v} ${v * 2} ${v * 2}`} style={{ width: '100%', maxWidth: 280, display: 'block' }}>
          <circle cx={0} cy={0} r={ro} fill="none" stroke="#ddd" strokeWidth={sw} strokeDasharray={`${ro * 0.05} ${ro * 0.03}`} />
          <circle cx={0} cy={0} r={ri} fill="none" stroke="#ddd" strokeWidth={sw} strokeDasharray={`${ro * 0.05} ${ro * 0.03}`} />
          <path d={path} fill="rgba(100,160,255,0.15)" stroke="navy" strokeWidth={sw * 1.5} />
        </svg>
      </div>
    )
  }

  // Proportional clipped arc view
  const showAngleRad = showAngleDeg * Math.PI / 180
  const cos = Math.cos(showAngleRad)
  const sin = Math.sin(showAngleRad)
  const pad = (ro - ri) * 0.6

  // Bounding box: arc between ri and ro from 0° to showAngleDeg
  const pts = [[ro, 0], [ri, 0], [ro * cos, ro * sin], [ri * cos, ri * sin]]
  if (showAngleDeg > 90)  { pts.push([0, ro],  [0, ri]) }
  if (showAngleDeg > 180) { pts.push([-ro, 0], [-ri, 0]) }
  if (showAngleDeg > 270) { pts.push([0, -ro], [0, -ri]) }

  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const vx = Math.min(...xs) - pad
  const vy = Math.min(...ys) - pad
  const vw = Math.max(...xs) - Math.min(...xs) + 2 * pad
  const vh = Math.max(...ys) - Math.min(...ys) + 2 * pad

  const clipR = ro * 2
  const largeArc = showAngleDeg > 180 ? 1 : 0
  const clipD = `M 0 0 L ${clipR} 0 A ${clipR} ${clipR} 0 ${largeArc} 1 ${clipR * cos} ${clipR * sin} Z`

  return (
    <div>
      <h3>Transition preview · F·F·T·T·F·T·F·F·T·F · {10}/{totalCols} cols</h3>
      <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{ width: '100%', maxWidth: 480, display: 'block' }}>
        <defs>
          <clipPath id="tp-sector">
            <path d={clipD} />
          </clipPath>
        </defs>
        {/* Full guide circles for context */}
        <circle cx={0} cy={0} r={ro} fill="none" stroke="#eee" strokeWidth={sw} clipPath="url(#tp-sector)" />
        <circle cx={0} cy={0} r={ri} fill="none" stroke="#eee" strokeWidth={sw} clipPath="url(#tp-sector)" />
        {/* Cam profile clipped to sector */}
        <g clipPath="url(#tp-sector)">
          <path d={path} fill="rgba(100,160,255,0.2)" stroke="navy" strokeWidth={sw * 1.5} />
        </g>
        {/* Radial boundary lines ri → ro */}
        <line x1={ri} y1={0} x2={ro * 1.08} y2={0}
          stroke="#bbb" strokeWidth={sw} strokeDasharray={`${ro * 0.04} ${ro * 0.025}`} />
        <line x1={ri * cos} y1={ri * sin} x2={ro * 1.08 * cos} y2={ro * 1.08 * sin}
          stroke="#bbb" strokeWidth={sw} strokeDasharray={`${ro * 0.04} ${ro * 0.025}`} />
      </svg>
    </div>
  )
}
