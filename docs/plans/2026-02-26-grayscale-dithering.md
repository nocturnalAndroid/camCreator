# Grayscale Intermediate & Floyd–Steinberg Dithering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Floyd–Steinberg dithering as a composable `dither: boolean` flag to `sampleImage`, keeping the final output `boolean[][]` unchanged.

**Architecture:** `sampleImage` gains a `dither` param. When true it runs two passes: first collects a full `float[][]` luminance grid (reusing existing helpers), then scans in raster order applying FS error diffusion before thresholding to booleans. Grayscale never escapes the sampler. A checkbox is added to the UI.

**Tech Stack:** Vanilla JS (sampler logic), React (UI), Vitest (tests)

---

### Task 1: Two-phase luminance extraction + FS dithering in sampler

**Files:**
- Modify: `src/lib/sampler.js`
- Test: `src/lib/sampler.test.js`

**Step 1: Write the failing tests**

Add to `src/lib/sampler.test.js`:

```js
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
    // All-black 10x10: every sample should be true (outer)
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
})
```

**Step 2: Run tests to verify they fail**

```
npx vitest run src/lib/sampler.test.js
```

Expected: the four new dither tests FAIL (dither param not yet implemented).

**Step 3: Implement two-phase dithering**

Replace `src/lib/sampler.js` with:

```js
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

  // Pass 2: Floyd–Steinberg in raster order
  const bools = []
  for (let r = 0; r < nRows; r++) {
    const row = []
    for (let c = 0; c < nCols; c++) {
      const lum = grid[r][c]
      const quantized = lum < threshold ? 0 : 1
      const error = lum - quantized

      // Diffuse error to neighbours
      if (c + 1 < nCols)               grid[r][c + 1]     += error * 7 / 16
      if (r + 1 < nRows && c - 1 >= 0) grid[r + 1][c - 1] += error * 3 / 16
      if (r + 1 < nRows)               grid[r + 1][c]     += error * 5 / 16
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
```

**Step 4: Run tests to verify they pass**

```
npx vitest run src/lib/sampler.test.js
```

Expected: all tests PASS including the four new dither tests.

**Step 5: Commit**

```
/usr/bin/git -C /Users/peleg.tuchman/projects/camCreator add src/lib/sampler.js src/lib/sampler.test.js
/usr/bin/git -C /Users/peleg.tuchman/projects/camCreator commit -m "feat: add Floyd-Steinberg dithering to sampleImage"
```

---

### Task 2: Wire `dither` into App state

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add `dither: false` to DEFAULT_PARAMS**

In `src/App.jsx`, find `DEFAULT_PARAMS` (line 13) and add `dither: false`:

```js
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
```

**Step 2: Pass `dither` through to `sampleImage`**

In `src/App.jsx`, find the `sampleImage` call inside `useMemo` (around line 51) and add `dither`:

```js
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
```

**Step 3: Run all tests**

```
npx vitest run
```

Expected: all tests PASS.

**Step 4: Commit**

```
/usr/bin/git -C /Users/peleg.tuchman/projects/camCreator add src/App.jsx
/usr/bin/git -C /Users/peleg.tuchman/projects/camCreator commit -m "feat: wire dither param into App state and sampleImage call"
```

---

### Task 3: Add dithering checkbox to ParameterPanel

**Files:**
- Modify: `src/components/ParameterPanel.jsx`

**Step 1: Add the checkbox**

In `src/components/ParameterPanel.jsx`, find the "Black = outer radius" label block near the end (around line 131). Add a "Dither (Floyd–Steinberg)" checkbox immediately before it:

```jsx
{/* Dither */}
<label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <input type="checkbox" checked={params.dither}
    onChange={e => setParams(p => ({ ...p, dither: e.target.checked }))} />
  Dither (Floyd–Steinberg)
</label>
```

**Step 2: Manual smoke test**

Start the dev server and verify:
- Checkbox appears in the parameter panel
- Toggling it changes the cam preview (noticeable on a photo with gradients)
- The threshold slider still affects the dithering result

```
npm run dev
```

**Step 3: Commit**

```
/usr/bin/git -C /Users/peleg.tuchman/projects/camCreator add src/components/ParameterPanel.jsx
/usr/bin/git -C /Users/peleg.tuchman/projects/camCreator commit -m "feat: add Floyd-Steinberg dithering checkbox to ParameterPanel"
```
