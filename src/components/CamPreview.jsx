import { profileToSvgPath } from '../lib/svgExport'

export default function CamPreview({ profile, label, outerRadius }) {
  if (!profile) return null
  const path = profileToSvgPath(profile)
  const v = outerRadius * 1.3

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={`${-v} ${-v} ${v*2} ${v*2}`} width={160} height={160}
        style={{ border: '1px solid #ccc', borderRadius: 4 }}>
        <path d={path} fill="rgba(100,160,255,0.15)" stroke="navy" strokeWidth={outerRadius * 0.02} />
        <circle cx={0} cy={0} r={outerRadius} fill="none" stroke="#ccc" strokeWidth={0.5} strokeDasharray="2,2"/>
        <circle cx={0} cy={0} r={profile.innerRadius ?? 0} fill="none" stroke="#ccc" strokeWidth={0.5} strokeDasharray="2,2"/>
      </svg>
      <p style={{ fontSize: 11, margin: 4, color: '#555' }}>{label}</p>
    </div>
  )
}
