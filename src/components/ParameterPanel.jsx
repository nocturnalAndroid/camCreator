const UNITS = ['px', 'cm', 'in']

function toPixels(value, unit, dpi) {
  if (unit === 'px') return value
  if (unit === 'cm') return (value / 2.54) * dpi
  if (unit === 'in') return value * dpi
  return value
}

export default function ParameterPanel({ params, setParams, image, dpi }) {
  const imageWidthPx = image?.width ?? 0

  function handleColSpacing(value, unit) {
    const colPx = toPixels(value, unit, dpi)
    const transAngle = imageWidthPx > 0 && colPx > 0
      ? 360 / (imageWidthPx / colPx)
      : params.transitionAngleDeg
    setParams(p => ({ ...p, colSpacing: value, colUnit: unit, transitionAngleDeg: +transAngle.toFixed(2) }))
  }

  function handleTransAngle(value) {
    const colPx = imageWidthPx > 0 && value > 0
      ? imageWidthPx / (360 / value)
      : toPixels(params.colSpacing, params.colUnit, dpi)
    const colInUnit = params.colUnit === 'px' ? colPx
      : params.colUnit === 'cm' ? (colPx / dpi) * 2.54
      : colPx / dpi
    setParams(p => ({ ...p, transitionAngleDeg: +value, colSpacing: +colInUnit.toFixed(3) }))
  }

  const colPx = toPixels(params.colSpacing, params.colUnit, dpi)
  const rowPx = toPixels(params.rowSpacing, params.rowUnit, dpi)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
      <label>
        Row spacing&nbsp;
        <input type="number" min={1} value={params.rowSpacing}
          onChange={e => setParams(p => ({ ...p, rowSpacing: +e.target.value }))} style={{ width: 70 }} />
        <select value={params.rowUnit}
          onChange={e => setParams(p => ({ ...p, rowUnit: e.target.value }))}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      </label>

      <label>
        Col spacing&nbsp;
        <input type="number" min={0.1} step={0.1} value={params.colSpacing}
          onChange={e => handleColSpacing(+e.target.value, params.colUnit)} style={{ width: 70 }} />
        <select value={params.colUnit}
          onChange={e => handleColSpacing(params.colSpacing, e.target.value)}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      </label>
      <span style={{ alignSelf: 'center' }}>⇔</span>
      <label>
        Transition angle (°)&nbsp;
        <input type="number" min={0.1} step={0.1} value={params.transitionAngleDeg}
          onChange={e => handleTransAngle(+e.target.value)} style={{ width: 70 }} />
      </label>

      <label>
        Inner radius (mm)&nbsp;
        <input type="number" min={1} value={params.innerRadius}
          onChange={e => setParams(p => ({ ...p, innerRadius: +e.target.value }))} style={{ width: 70 }} />
      </label>
      <label>
        Outer radius (mm)&nbsp;
        <input type="number" min={1} value={params.outerRadius}
          onChange={e => setParams(p => ({ ...p, outerRadius: +e.target.value }))} style={{ width: 70 }} />
      </label>

      <label>
        Sampling&nbsp;
        <select value={params.mode} onChange={e => setParams(p => ({ ...p, mode: e.target.value }))}>
          <option value="exact">Exact pixel</option>
          <option value="convolution">Convolution</option>
        </select>
      </label>

      {params.mode === 'convolution' && <>
        <label>
          Conv width (px)&nbsp;
          <input type="number" min={1} value={params.convW}
            onChange={e => setParams(p => ({ ...p, convW: +e.target.value }))} style={{ width: 60 }} />
          <button onClick={() => setParams(p => ({ ...p, convW: Math.max(1, Math.round(colPx)) }))}>
            Set to cover
          </button>
        </label>
        <label>
          Conv height (px)&nbsp;
          <input type="number" min={1} value={params.convH}
            onChange={e => setParams(p => ({ ...p, convH: +e.target.value }))} style={{ width: 60 }} />
          <button onClick={() => setParams(p => ({ ...p, convH: Math.max(1, Math.round(rowPx)) }))}>
            Set to cover
          </button>
        </label>
        <label>
          Threshold&nbsp;
          <input type="range" min={0} max={1} step={0.01} value={params.threshold}
            onChange={e => setParams(p => ({ ...p, threshold: +e.target.value }))} />
          &nbsp;{params.threshold}
        </label>
      </>}

      <label>
        <input type="checkbox" checked={params.blackIsOuter}
          onChange={e => setParams(p => ({ ...p, blackIsOuter: e.target.checked }))} />
        &nbsp;Black = outer radius
      </label>

      <label>
        Ease-in tension&nbsp;
        <input type="range" min={0} max={1} step={0.01} value={params.easeIn}
          onChange={e => setParams(p => ({ ...p, easeIn: +e.target.value }))} />
        &nbsp;{params.easeIn}
      </label>
      <label>
        Ease-out tension&nbsp;
        <input type="range" min={0} max={1} step={0.01} value={params.easeOut}
          onChange={e => setParams(p => ({ ...p, easeOut: +e.target.value }))} />
        &nbsp;{params.easeOut}
      </label>
    </div>
  )
}
