/**
 * Sample an ImageData into a 2D boolean array.
 * @param {ImageData} imageData
 * @param {{
 *   rowSpacingPx: number,
 *   colSpacingPx: number,
 *   mode: 'exact' | 'convolution',
 *   threshold: number,
 *   blackIsOuter: boolean,
 *   convW: number,
 *   convH: number,
 *   dither?: boolean,
 * }} params
 * @returns {boolean[][]}
 */
export function sampleImage(imageData, params) {
  const { data, width, height } = imageData
  const { rowSpacingPx, colSpacingPx, mode, threshold, blackIsOuter, convW, convH, dither } = params
  if (!rowSpacingPx || rowSpacingPx <= 0 || !colSpacingPx || colSpacingPx <= 0) return []

  if (dither) {
    return sampleWithDither(imageData, params)
  }

  const rows = []
  for (let y = 0; y < height; y += rowSpacingPx) {
    const row = []
    for (let x = 0; x < width; x += colSpacingPx) {
      const luminance = mode === 'exact'
        ? getPixelLuminance(data, width, Math.round(x), Math.round(y))
        : getConvLuminance(data, width, height, Math.round(x), Math.round(y), convW, convH)
      const isBlack = luminance < threshold
      row.push(blackIsOuter ? isBlack : !isBlack)
    }
    rows.push(row)
  }
  return rows
}

function sampleWithDither(imageData, params) {
  // Precondition: rowSpacingPx > 0 and colSpacingPx > 0 (guaranteed by sampleImage guard)
  const { data, width, height } = imageData
  const { rowSpacingPx, colSpacingPx, mode, threshold, blackIsOuter, convW, convH } = params

  // Pass 1: collect luminance grid
  const ys = []
  for (let y = 0; y < height; y += rowSpacingPx) ys.push(Math.round(y))
  const xs = []
  for (let x = 0; x < width; x += colSpacingPx) xs.push(Math.round(x))

  const nRows = ys.length
  const nCols = xs.length

  // Mutable float grid for error diffusion
  const grid = []
  for (let r = 0; r < nRows; r++) {
    const row = []
    for (let c = 0; c < nCols; c++) {
      row.push(
        mode === 'exact'
          ? getPixelLuminance(data, width, xs[c], ys[r])
          : getConvLuminance(data, width, height, xs[c], ys[r], convW, convH)
      )
    }
    grid.push(row)
  }

  // Pass 2: Floyd-Steinberg in raster order
  const bools = []
  for (let r = 0; r < nRows; r++) {
    const row = []
    for (let c = 0; c < nCols; c++) {
      const lum = grid[r][c]
      const quantized = lum < threshold ? 0 : 1
      const error = lum - quantized

      // Diffuse error to neighbours
      if (c + 1 < nCols)                  grid[r][c + 1]     += error * 7 / 16
      if (r + 1 < nRows && c - 1 >= 0)    grid[r + 1][c - 1] += error * 3 / 16
      if (r + 1 < nRows)                  grid[r + 1][c]     += error * 5 / 16
      if (r + 1 < nRows && c + 1 < nCols) grid[r + 1][c + 1] += error * 1 / 16

      const isBlack = quantized === 0
      row.push(blackIsOuter ? isBlack : !isBlack)
    }
    bools.push(row)
  }
  return bools
}

function getPixelLuminance(data, width, x, y) {
  const i = (y * width + x) * 4
  return (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255
}

function getConvLuminance(data, width, height, cx, cy, convW, convH) {
  const halfW = Math.floor(convW / 2)
  const halfH = Math.floor(convH / 2)
  let sum = 0, count = 0
  for (let dy = -halfH; dy <= halfH; dy++) {
    for (let dx = -halfW; dx <= halfW; dx++) {
      const px = Math.max(0, Math.min(width - 1, cx + dx))
      const py = Math.max(0, Math.min(height - 1, cy + dy))
      sum += getPixelLuminance(data, width, px, py)
      count++
    }
  }
  return sum / count
}
