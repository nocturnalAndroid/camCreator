import { useState, useEffect, useMemo } from 'react'
import ImageUpload from './components/ImageUpload'
import ParameterPanel from './components/ParameterPanel'
import ImagePreview from './components/ImagePreview'
import PatternSkeleton from './components/PatternSkeleton'
import CamGrid from './components/CamGrid'
import DownloadPanel from './components/DownloadPanel'
import TransitionPreview from './components/TransitionPreview'
import { buildCamProfile } from './lib/camGeometry'
import { parseDpi, imageSizeCm } from './lib/imageMeta'
import { sampleImage } from './lib/sampler'

const DEFAULT_PARAMS = {
  rowSpacingPx: 50,
  colSpacingPx: 20,
  transitionDistanceMm: 9.42,
  innerRadius: 95, outerRadius: 100,
  mode: 'exact',
  convW: 20, convH: 50, convAutoSize: true,
  threshold: 0.5,
  blackIsOuter: true,
  easeIn: 0.5, easeOut: 0.5,
  dither: false,
}

function validateParams(params, dpi) {
  if (!dpi || dpi < 1) return 'DPI must be ≥ 1'
  if (!params.rowSpacingPx || params.rowSpacingPx < 1) return 'Row spacing must be ≥ 1 px'
  if (!params.colSpacingPx || params.colSpacingPx < 1) return 'Col spacing must be ≥ 1 px'
  if (!params.innerRadius || params.innerRadius < 1) return 'Inner radius must be ≥ 1 mm'
  if (!params.outerRadius || params.outerRadius <= params.innerRadius)
    return 'Outer radius must be > inner radius'
  if (!params.transitionDistanceMm || params.transitionDistanceMm <= 0)
    return 'Transition distance must be > 0'
  return null
}

export default function App() {
  const [image, setImage] = useState(null)
  const [dpi, setDpi] = useState(96)
  const [params, setParams] = useState(DEFAULT_PARAMS)

  useEffect(() => {
    if (!image) return
    parseDpi(image.file).then(detectedDpi => setDpi(detectedDpi))
  }, [image])

  const validationError = image ? validateParams(params, dpi) : null

  const samples = useMemo(() => {
    if (!image || validationError) return null
    return sampleImage(image.imageData, {
      rowSpacingPx: params.rowSpacingPx,
      colSpacingPx: params.colSpacingPx,
      mode: params.mode,
      threshold: params.threshold,
      blackIsOuter: params.blackIsOuter,
      convW: params.convAutoSize ? Math.max(1, Math.round(params.colSpacingPx)) : params.convW,
      convH: params.convAutoSize ? Math.max(1, Math.round(params.rowSpacingPx)) : params.convH,
      dither: params.dither,
    })
  }, [image, params, dpi])

  const profiles = useMemo(() => {
    if (!samples) return null
    return samples.map(row =>
      buildCamProfile(row, {
        innerRadius: params.innerRadius,
        outerRadius: params.outerRadius,
        transitionAngleDeg: (params.transitionDistanceMm / params.outerRadius) * (180 / Math.PI),
        easeIn: params.easeIn,
        easeOut: params.easeOut,
      })
    )
  }, [samples, params])

  const sizeCm = image ? imageSizeCm(image.width, image.height, dpi) : null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <h1>Cam Creator</h1>
      <ImageUpload onImageLoaded={setImage} />
      {image && (
        <p style={{ fontSize: 12, color: '#666' }}>
          Detected: {dpi} DPI — Image size: {sizeCm.widthCm.toFixed(1)} × {sizeCm.heightCm.toFixed(1)} cm
          &nbsp;({image.width} × {image.height}px)
        </p>
      )}
      {image && <ParameterPanel params={params} setParams={setParams} image={image} dpi={dpi} setDpi={setDpi} />}
      {image && (
        <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
          {validationError && (
            <span style={{ color: 'crimson', fontSize: 12 }}>⚠ {validationError}</span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <ImagePreview image={image} samples={samples} params={params} dpi={dpi} />
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <PatternSkeleton image={image} samples={samples} params={params} dpi={dpi} />
        </div>
      </div>
      {/* Radii + ease controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '16px 0', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          Inner radius (mm)
          <input type="number" min={1} value={params.innerRadius} style={{ width: 58 }}
            onChange={e => setParams(p => ({ ...p, innerRadius: +e.target.value }))} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          Outer radius (mm)
          <input type="number" min={1} value={params.outerRadius} style={{ width: 58 }}
            onChange={e => setParams(p => ({ ...p, outerRadius: +e.target.value }))} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          Ease-in
          <input type="range" min={0} max={1} step={0.01} value={params.easeIn}
            onChange={e => setParams(p => ({ ...p, easeIn: +e.target.value }))} />
          {params.easeIn}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          Ease-out
          <input type="range" min={0} max={1} step={0.01} value={params.easeOut}
            onChange={e => setParams(p => ({ ...p, easeOut: +e.target.value }))} />
          {params.easeOut}
        </label>
      </div>
      <TransitionPreview params={params} image={image} />
      <CamGrid profiles={profiles} params={params} />
      <DownloadPanel profiles={profiles} params={params} />
    </div>
  )
}
