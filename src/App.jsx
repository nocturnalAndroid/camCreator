import { useState, useEffect, useMemo } from 'react'
import ImageUpload from './components/ImageUpload'
import ParameterPanel from './components/ParameterPanel'
import ImagePreview from './components/ImagePreview'
import PatternSkeleton from './components/PatternSkeleton'
import CamGrid from './components/CamGrid'
import DownloadPanel from './components/DownloadPanel'
import { buildCamProfile } from './lib/camGeometry'
import { parseDpi, imageSizeCm } from './lib/imageMeta'
import { sampleImage } from './lib/sampler'

const DEFAULT_PARAMS = {
  rowSpacing: 50, rowUnit: 'px',
  colSpacing: 20, colUnit: 'px',
  transitionAngleDeg: 18,
  innerRadius: 20, outerRadius: 30,
  mode: 'exact',
  convW: 20, convH: 50,
  threshold: 0.5,
  blackIsOuter: true,
  easeIn: 0.5, easeOut: 0.5,
}

export default function App() {
  const [image, setImage] = useState(null)
  const [dpi, setDpi] = useState(96)
  const [params, setParams] = useState(DEFAULT_PARAMS)

  useEffect(() => {
    if (!image) return
    parseDpi(image.file).then(detectedDpi => setDpi(detectedDpi))
  }, [image])

  function toPixels(value, unit) {
    if (unit === 'px') return value
    if (unit === 'cm') return (value / 2.54) * dpi
    if (unit === 'in') return value * dpi
    return value
  }

  const samples = useMemo(() => {
    if (!image) return null
    return sampleImage(image.imageData, {
      rowSpacingPx: toPixels(params.rowSpacing, params.rowUnit),
      colSpacingPx: toPixels(params.colSpacing, params.colUnit),
      mode: params.mode,
      threshold: params.threshold,
      blackIsOuter: params.blackIsOuter,
      convW: params.convW,
      convH: params.convH,
    })
  }, [image, params, dpi])

  const profiles = useMemo(() => {
    if (!samples) return null
    return samples.map(row =>
      buildCamProfile(row, {
        innerRadius: params.innerRadius,
        outerRadius: params.outerRadius,
        transitionAngleDeg: params.transitionAngleDeg,
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
      {image && <ParameterPanel params={params} setParams={setParams} image={image} dpi={dpi} />}
      <ImagePreview image={image} samples={samples} params={params} dpi={dpi} />
      <PatternSkeleton image={image} samples={samples} params={params} dpi={dpi} />
      <CamGrid profiles={profiles} params={params} />
      <DownloadPanel profiles={profiles} params={params} />
    </div>
  )
}
