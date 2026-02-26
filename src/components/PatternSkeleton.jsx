import { useEffect, useRef } from 'react'

export default function PatternSkeleton({ image, samples, params, dpi }) {
  const canvasRef = useRef()

  function toPixels(value, unit) {
    if (unit === 'px') return value
    if (unit === 'cm') return (value / 2.54) * dpi
    if (unit === 'in') return value * dpi
    return value
  }

  useEffect(() => {
    if (!image || !samples || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const rowPx = toPixels(params.rowSpacing, params.rowUnit)
    const colPx = toPixels(params.colSpacing, params.colUnit)
    const dotR = Math.max(2, colPx * 0.25)

    ctx.fillStyle = 'black'
    ctx.strokeStyle = 'black'
    ctx.lineWidth = Math.max(1.5, colPx * 0.1)

    samples.forEach((row, ri) => {
      const y = ri * rowPx
      let runStart = null

      row.forEach((val, ci) => {
        const x = ci * colPx
        if (val && runStart === null) {
          runStart = ci
        } else if (!val && runStart !== null) {
          const runLength = ci - runStart
          if (runLength === 1) {
            ctx.beginPath()
            ctx.arc(runStart * colPx, y, dotR, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.beginPath()
            ctx.moveTo(runStart * colPx, y)
            ctx.lineTo((ci - 1) * colPx, y)
            ctx.stroke()
          }
          runStart = null
        }
      })

      if (runStart !== null) {
        const lastIdx = row.length - 1
        const runLength = lastIdx - runStart + 1
        if (runLength === 1) {
          ctx.beginPath()
          ctx.arc(runStart * colPx, y, dotR, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(runStart * colPx, y)
          ctx.lineTo(lastIdx * colPx, y)
          ctx.stroke()
        }
      }
    })
  }, [image, samples, params, dpi])

  if (!image || !samples) return null
  return (
    <div>
      <h3>Pattern skeleton</h3>
      <canvas ref={canvasRef} style={{ maxWidth: '100%', display: 'block' }} />
    </div>
  )
}
