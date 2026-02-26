import { useEffect, useRef } from 'react'

export default function ImagePreview({ image, samples, params, dpi }) {
  const canvasRef = useRef()

  function toPixels(value, unit) {
    if (unit === 'px') return value
    if (unit === 'cm') return (value / 2.54) * dpi
    if (unit === 'in') return value * dpi
    return value
  }

  useEffect(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      if (!samples) return

      const rowPx = toPixels(params.rowSpacing, params.rowUnit)
      const colPx = toPixels(params.colSpacing, params.colUnit)
      const dotR = Math.max(2, Math.min(colPx, rowPx) * 0.3)

      ctx.strokeStyle = 'rgba(0, 120, 255, 0.4)'
      ctx.lineWidth = 1
      samples.forEach((row, ri) => {
        const y = ri * rowPx
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(image.width, y)
        ctx.stroke()
      })

      samples.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const x = ci * colPx
          const y = ri * rowPx
          ctx.beginPath()
          ctx.arc(x, y, dotR, 0, Math.PI * 2)
          if (val) {
            ctx.fillStyle = 'rgba(255, 60, 60, 0.85)'
            ctx.fill()
          } else {
            ctx.strokeStyle = 'rgba(60, 60, 255, 0.85)'
            ctx.lineWidth = 1.5
            ctx.stroke()
          }
        })
      })
    }
    img.src = image.url
  }, [image, samples, params, dpi])

  if (!image) return null
  return (
    <div>
      <h3>Sample overlay</h3>
      <canvas ref={canvasRef} style={{ maxWidth: '100%', display: 'block' }} />
    </div>
  )
}
