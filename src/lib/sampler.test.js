import { describe, it, expect } from 'vitest'
import { sampleImage } from './sampler'

// Helper: create a fake ImageData with known pixels
function makeImageData(width, height, pixelFn) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const [r, g, b, a] = pixelFn(x, y)
      data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a
    }
  }
  return { data, width, height }
}

describe('sampleImage - exact mode', () => {
  it('returns true for black pixels', () => {
    // 10x10 all-black image, row spacing 5px, col spacing 5px
    const imageData = makeImageData(10, 10, () => [0, 0, 0, 255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
    }
    const result = sampleImage(imageData, params)
    // rows at y=0, y=5 → 2 rows
    expect(result.length).toBe(2)
    // each row: cols at x=0, x=5 → 2 samples
    expect(result[0].length).toBe(2)
    expect(result[0][0]).toBe(true)
    expect(result[0][1]).toBe(true)
  })

  it('returns false for white pixels when blackIsOuter=true', () => {
    const imageData = makeImageData(10, 10, () => [255, 255, 255, 255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
    }
    const result = sampleImage(imageData, params)
    expect(result[0][0]).toBe(false)
  })

  it('flips when blackIsOuter=false', () => {
    const imageData = makeImageData(10, 10, () => [0, 0, 0, 255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: false,
      convW: 1, convH: 1,
    }
    const result = sampleImage(imageData, params)
    expect(result[0][0]).toBe(false)
  })
})

describe('sampleImage - convolution mode', () => {
  it('averages neighborhood and applies threshold', () => {
    // 10x10 image: left half black, right half white
    const imageData = makeImageData(10, 10, (x) => x < 5 ? [0,0,0,255] : [255,255,255,255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'convolution', threshold: 0.5, blackIsOuter: true,
      convW: 3, convH: 3,
    }
    const result = sampleImage(imageData, params)
    // x=0 neighborhood: mostly black → true
    expect(result[0][0]).toBe(true)
    // x=5 neighborhood: mostly white → false
    expect(result[0][1]).toBe(false)
  })
})

describe('sampleImage - dither mode', () => {
  it('returns boolean[][] (not floats) when dither=true', () => {
    const imageData = makeImageData(10, 10, (x) => x < 5 ? [0,0,0,255] : [255,255,255,255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
      dither: true,
    }
    const result = sampleImage(imageData, params)
    expect(result.length).toBeGreaterThan(0)
    result.forEach(row => row.forEach(cell => expect(typeof cell).toBe('boolean')))
  })

  it('black region still resolves to true (outer) with dither=true, blackIsOuter=true', () => {
    const imageData = makeImageData(10, 10, () => [0, 0, 0, 255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
      dither: true,
    }
    const result = sampleImage(imageData, params)
    result.forEach(row => row.forEach(cell => expect(cell).toBe(true)))
  })

  it('white region still resolves to false (inner) with dither=true, blackIsOuter=true', () => {
    const imageData = makeImageData(10, 10, () => [255, 255, 255, 255])
    const params = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
      dither: true,
    }
    const result = sampleImage(imageData, params)
    result.forEach(row => row.forEach(cell => expect(cell).toBe(false)))
  })

  it('dither=false (default) produces same result as before', () => {
    const imageData = makeImageData(10, 10, () => [0, 0, 0, 255])
    const base = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
    }
    const withoutDither = sampleImage(imageData, base)
    const withDitherFalse = sampleImage(imageData, { ...base, dither: false })
    expect(withDitherFalse).toEqual(withoutDither)
  })

  it('produces different output than plain threshold on mid-gray image', () => {
    // Mid-gray image: luminance ~0.502, just above threshold 0.5
    // Without dither: every sample is false (0.502 >= 0.5 → not black)
    // With dither: first pixel rounds to 1 (white, false), error ≈ -0.498 diffuses forward,
    //   next pixel gets lower accumulated value → rounds to 0 (black, true)
    //   So the result should contain at least one true value
    const imageData = makeImageData(10, 10, () => [128, 128, 128, 255])
    const base = {
      rowSpacingPx: 5, colSpacingPx: 5,
      mode: 'exact', threshold: 0.5, blackIsOuter: true,
      convW: 1, convH: 1,
    }
    const withoutDither = sampleImage(imageData, base)
    const withDither = sampleImage(imageData, { ...base, dither: true })
    // Without dither: all false (mid-gray above threshold)
    withoutDither.forEach(row => row.forEach(cell => expect(cell).toBe(false)))
    // With dither: should differ — at least one true due to error diffusion
    const allFalse = withDither.flat().every(v => v === false)
    expect(allFalse).toBe(false)
  })
})
