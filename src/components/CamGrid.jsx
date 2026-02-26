import CamPreview from './CamPreview'

export default function CamGrid({ profiles, params }) {
  if (!profiles || profiles.length === 0) return null

  return (
    <div>
      <h3>Cam profiles ({profiles.length} rows)</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {profiles.map((p, i) => (
          <CamPreview
            key={i}
            profile={p}
            label={`Row ${i}`}
            outerRadius={params.outerRadius}
          />
        ))}
      </div>
    </div>
  )
}
