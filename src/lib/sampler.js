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
 * }} params
 * @returns {boolean[][]}
 */
export function sampleImage(imageData, params) {
  const { data, width, height } = imageData
  const { rowSpacingPx, colSpacingPx, mode, threshold, blackIsOuter, convW, convH } = params

  const rows = []
  for (let y = 0; y < height; y += rowSpacingPx) {
    const row = []
    for (let x = 0; x < width; x += colSpacingPx) {
      const luminance = mode === 'exact'
        ? getPixelLuminance(data, width, Math.round(x), Math.round(y))
        : getConvLuminance(data, width, height, Math.round(x), Math.round(y), convW, convH)
      // luminance 0 = black, 1 = white
      // black pixel: luminance < threshold → isBlack = true
      const isBlack = luminance < threshold
      row.push(blackIsOuter ? isBlack : !isBlack)
    }
    rows.push(row)
  }
  return rows
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
