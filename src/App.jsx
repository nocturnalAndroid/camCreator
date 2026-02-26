import { useState, useEffect } from 'react'
import ImageUpload from './components/ImageUpload'
import ParameterPanel from './components/ParameterPanel'
import { parseDpi, imageSizeCm } from './lib/imageMeta'

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
    parseDpi(image.file).then(detectedDpi => {
      setDpi(detectedDpi)
    })
  }, [image])

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
    </div>
  )
}
