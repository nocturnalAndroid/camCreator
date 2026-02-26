import { useEffect, useRef } from 'react'

export default function PatternSkeleton({ image, samples, params, dpi }) {
  const canvasRef = useRef()

  useEffect(() => {
    if (!image || !samples || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const rowPx = params.rowSpacingPx
    const colPx = params.colSpacingPx
    const ext = colPx * 0.5  // extension beyond the first/last true sample

    ctx.strokeStyle = 'black'
    ctx.lineWidth = Math.max(1.5, colPx * 0.1)

    const drawRun = (startIdx, endIdx, y) => {
      ctx.beginPath()
      ctx.moveTo(startIdx * colPx - ext, y)
      ctx.lineTo(endIdx * colPx + ext, y)
      ctx.stroke()
    }

    samples.forEach((row, ri) => {
      const y = ri * rowPx
      let runStart = null

      row.forEach((val, ci) => {
        if (val && runStart === null) {
          runStart = ci
        } else if (!val && runStart !== null) {
          drawRun(runStart, ci - 1, y)
          runStart = null
        }
      })

      if (runStart !== null) {
        drawRun(runStart, row.length - 1, y)
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
