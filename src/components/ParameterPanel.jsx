export default function ParameterPanel({ params, setParams, image, dpi, setDpi }) {
  const imageWidthPx = image?.width ?? 0

  function handleColSpacingPx(px) {
    const transAngleDeg = imageWidthPx > 0 && px > 0
      ? 360 / (imageWidthPx / px)
      : (params.transitionDistanceMm / params.outerRadius) * (180 / Math.PI)
    const transDistMm = params.outerRadius * transAngleDeg * Math.PI / 180
    setParams(p => ({ ...p, colSpacingPx: +parseFloat(px).toFixed(2), transitionDistanceMm: +transDistMm.toFixed(2) }))
  }

  function handleTransDist(value) {
    const transAngleDeg = params.outerRadius > 0 ? (value / params.outerRadius) * (180 / Math.PI) : 0
    const colPx = imageWidthPx > 0 && transAngleDeg > 0
      ? imageWidthPx / (360 / transAngleDeg)
      : params.colSpacingPx
    setParams(p => ({ ...p, transitionDistanceMm: +value, colSpacingPx: +parseFloat(colPx).toFixed(2) }))
  }

  const rowCm = (params.rowSpacingPx / dpi * 2.54).toFixed(2)
  const rowIn = (params.rowSpacingPx / dpi).toFixed(3)
  const colCm = (params.colSpacingPx / dpi * 2.54).toFixed(2)
  const colIn = (params.colSpacingPx / dpi).toFixed(3)

  const inp = { type: 'number', style: { width: 58 } }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16, alignItems: 'center' }}>

      {/* DPI */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        DPI
        <input {...inp} min={1} step={1} value={dpi}
          onChange={e => setDpi(+e.target.value)} />
      </label>

      <span style={{ color: '#ccc' }}>|</span>

      {/* Row spacing */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>Row spacing</span>
        <input {...inp} min={1} step={1} value={Math.round(params.rowSpacingPx)}
          onChange={e => setParams(p => ({ ...p, rowSpacingPx: +e.target.value }))} />
        <span>px</span>
        <input {...inp} min={0.01} step={0.01} value={rowCm}
          onChange={e => setParams(p => ({ ...p, rowSpacingPx: +(+e.target.value / 2.54 * dpi).toFixed(2) }))} />
        <span>cm</span>
        <input {...inp} min={0.001} step={0.001} value={rowIn}
          onChange={e => setParams(p => ({ ...p, rowSpacingPx: +(+e.target.value * dpi).toFixed(2) }))} />
        <span>in</span>
      </div>

      {/* Col spacing ↔ transition distance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>Col spacing</span>
        <input {...inp} min={1} step={1} value={Math.round(params.colSpacingPx)}
          onChange={e => handleColSpacingPx(+e.target.value)} />
        <span>px</span>
        <input {...inp} min={0.01} step={0.01} value={colCm}
          onChange={e => handleColSpacingPx(+(+e.target.value / 2.54 * dpi).toFixed(2))} />
        <span>cm</span>
        <input {...inp} min={0.001} step={0.001} value={colIn}
          onChange={e => handleColSpacingPx(+(+e.target.value * dpi).toFixed(2))} />
        <span>in</span>
      </div>
      <span style={{ alignSelf: 'center' }}>⇔</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Transition dist (mm)
        <input {...inp} min={0.1} step={0.1} value={params.transitionDistanceMm}
          onChange={e => handleTransDist(+e.target.value)} />
      </label>

      {/* Radii */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Inner radius (mm)
        <input {...inp} min={1} value={params.innerRadius}
          onChange={e => setParams(p => ({ ...p, innerRadius: +e.target.value }))} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Outer radius (mm)
        <input {...inp} min={1} value={params.outerRadius}
          onChange={e => setParams(p => ({ ...p, outerRadius: +e.target.value }))} />
      </label>

      {/* Sampling mode */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Sampling
        <select value={params.mode} onChange={e => setParams(p => ({ ...p, mode: e.target.value }))}>
          <option value="exact">Exact pixel</option>
          <option value="convolution">Convolution</option>
        </select>
      </label>

      {params.mode === 'convolution' && <>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Conv width (px)
          <input {...inp} min={1} value={params.convW}
            onChange={e => setParams(p => ({ ...p, convW: +e.target.value }))} />
          <button onClick={() => setParams(p => ({ ...p, convW: Math.max(1, Math.round(p.colSpacingPx)) }))}>
            Set to cover
          </button>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Conv height (px)
          <input {...inp} min={1} value={params.convH}
            onChange={e => setParams(p => ({ ...p, convH: +e.target.value }))} />
          <button onClick={() => setParams(p => ({ ...p, convH: Math.max(1, Math.round(p.rowSpacingPx)) }))}>
            Set to cover
          </button>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Threshold
          <input type="range" min={0} max={1} step={0.01} value={params.threshold}
            onChange={e => setParams(p => ({ ...p, threshold: +e.target.value }))} />
          {params.threshold}
        </label>
      </>}

      {/* Black = outer */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="checkbox" checked={params.blackIsOuter}
          onChange={e => setParams(p => ({ ...p, blackIsOuter: e.target.checked }))} />
        Black = outer radius
      </label>

      {/* Ease tensions */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Ease-in
        <input type="range" min={0} max={1} step={0.01} value={params.easeIn}
          onChange={e => setParams(p => ({ ...p, easeIn: +e.target.value }))} />
        {params.easeIn}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        Ease-out
        <input type="range" min={0} max={1} step={0.01} value={params.easeOut}
          onChange={e => setParams(p => ({ ...p, easeOut: +e.target.value }))} />
        {params.easeOut}
      </label>
    </div>
  )
}
