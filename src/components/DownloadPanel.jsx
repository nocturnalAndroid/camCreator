import { useState } from 'react'
import JSZip from 'jszip'
import { profileToDxf, buildDxfFile } from '../lib/dxfExport'
import { profileToSvgPath, buildSvgFile } from '../lib/svgExport'

export default function DownloadPanel({ profiles, params }) {
  const [format, setFormat] = useState('dxf')
  const [packaging, setPackaging] = useState('all')

  if (!profiles || profiles.length === 0) return null

  async function handleDownload() {
    const rowLabels = profiles.map((_, i) => `row_${i}`)

    if (packaging === 'all') {
      if (format === 'dxf' || format === 'both') {
        const allEntities = profiles.map((p, i) => profileToDxf(p, rowLabels[i]))
        const dxf = buildDxfFile(allEntities, rowLabels)
        downloadText(dxf, 'cams.dxf')
      }
      if (format === 'svg' || format === 'both') {
        const cams = profiles.map((p, i) => ({ path: profileToSvgPath(p), label: rowLabels[i] }))
        const svg = buildSvgFile(cams, params.outerRadius * 1.3)
        downloadText(svg, 'cams.svg')
      }
    } else {
      const zip = new JSZip()
      profiles.forEach((p, i) => {
        if (format === 'dxf' || format === 'both') {
          const dxf = buildDxfFile([profileToDxf(p, rowLabels[i])], [rowLabels[i]])
          zip.file(`${rowLabels[i]}.dxf`, dxf)
        }
        if (format === 'svg' || format === 'both') {
          const svg = buildSvgFile([{ path: profileToSvgPath(p), label: rowLabels[i] }], params.outerRadius * 1.3)
          zip.file(`${rowLabels[i]}.svg`, svg)
        }
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'cams.zip')
    }
  }

  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3>Download</h3>
      <label>
        Format:&nbsp;
        <select value={format} onChange={e => setFormat(e.target.value)}>
          <option value="dxf">DXF</option>
          <option value="svg">SVG</option>
          <option value="both">Both</option>
        </select>
      </label>
      &nbsp;&nbsp;
      <label>
        Packaging:&nbsp;
        <select value={packaging} onChange={e => setPackaging(e.target.value)}>
          <option value="all">All cams in one file</option>
          <option value="zip">One file per cam (zip)</option>
        </select>
      </label>
      &nbsp;&nbsp;
      <button onClick={handleDownload} style={{ padding: '6px 16px' }}>Download</button>
    </div>
  )
}

function downloadText(text, filename) {
  downloadBlob(new Blob([text], { type: 'text/plain' }), filename)
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
