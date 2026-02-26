# Cam Creator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a client-side React web app that samples a B&W image into boolean rows and exports cam profiles (closed ARC + Bezier curves) as DXF and SVG files.

**Architecture:** React + Vite SPA with no backend. Pure browser processing: Canvas API for image sampling, hand-generated DXF text output, native SVG for cam previews and export. State flows from uploaded image → parameters → boolean[][] → cam profiles → previews + downloads.

**Tech Stack:** React 18, Vite 5, Vitest, jszip, exifr (DPI reading)

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.js`, `src/App.jsx`, `src/main.jsx`, `index.html`

**Step 1: Initialize Vite + React project**

From `/Users/peleg.tuchman/projects/camCreator`:
```bash
npm create vite@latest . -- --template react
```
When asked "Current directory is not empty. Remove existing files and continue?" — select Yes (only docs/ exists).

**Step 2: Install dependencies**
```bash
npm install jszip exifr
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

**Step 3: Configure Vitest**

Add to `vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
})
```

Create `src/test-setup.js`:
```js
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:ui": "vitest --ui"
```

**Step 4: Clear boilerplate**

Replace `src/App.jsx` with:
```jsx
export default function App() {
  return <div><h1>Cam Creator</h1></div>
}
```

Replace `src/App.css` and `src/index.css` with empty files.

**Step 5: Verify dev server starts**
```bash
npm run dev
```
Expected: server starts at http://localhost:5173, page shows "Cam Creator".

**Step 6: Commit**
```bash
git init
git add .
git commit -m "feat: scaffold React + Vite project with Vitest"
```

---

## Task 2: Sampler library

**Files:**
- Create: `src/lib/sampler.js`
- Create: `src/lib/sampler.test.js`

**Step 1: Write failing tests**

Create `src/lib/sampler.test.js`:
```js
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
```

**Step 2: Run test to confirm it fails**
```bash
npm test -- sampler
```
Expected: FAIL with "Cannot find module './sampler'"

**Step 3: Implement sampler**

Create `src/lib/sampler.js`:
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
```

**Step 4: Run tests to confirm passing**
```bash
npm test -- sampler
```
Expected: all 4 tests PASS

**Step 5: Commit**
```bash
git add src/lib/sampler.js src/lib/sampler.test.js
git commit -m "feat: image sampler with exact and convolution modes"
```

---

## Task 3: Cam geometry library

**Files:**
- Create: `src/lib/camGeometry.js`
- Create: `src/lib/camGeometry.test.js`

**Step 1: Write failing tests**

Create `src/lib/camGeometry.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildCamProfile } from './camGeometry'

describe('buildCamProfile', () => {
  it('all-true array produces a single outer arc segment', () => {
    const bools = [true, true, true, true]
    const profile = buildCamProfile(bools, {
      innerRadius: 10, outerRadius: 20,
      transitionAngleDeg: 90,
      easeIn: 0.5, easeOut: 0.5,
    })
    expect(profile.segments.length).toBe(1)
    expect(profile.segments[0].type).toBe('arc')
    expect(profile.segments[0].radius).toBe(20)
  })

  it('all-false array produces a single inner arc segment', () => {
    const bools = [false, false, false, false]
    const profile = buildCamProfile(bools, {
      innerRadius: 10, outerRadius: 20,
      transitionAngleDeg: 90,
      easeIn: 0.5, easeOut: 0.5,
    })
    expect(profile.segments.length).toBe(1)
    expect(profile.segments[0].type).toBe('arc')
    expect(profile.segments[0].radius).toBe(10)
  })

  it('alternating array produces arc and bezier segments', () => {
    // [true, true, false, false] → 2 transitions, 2 arcs, 2 beziers
    const bools = [true, true, false, false]
    const profile = buildCamProfile(bools, {
      innerRadius: 10, outerRadius: 20,
      transitionAngleDeg: 90,
      easeIn: 0.5, easeOut: 0.5,
    })
    const arcs = profile.segments.filter(s => s.type === 'arc')
    const beziers = profile.segments.filter(s => s.type === 'bezier')
    expect(arcs.length).toBe(2)
    expect(beziers.length).toBe(2)
  })

  it('bezier segment has 4 control points', () => {
    const bools = [true, false]
    const profile = buildCamProfile(bools, {
      innerRadius: 10, outerRadius: 20,
      transitionAngleDeg: 180,
      easeIn: 0.5, easeOut: 0.5,
    })
    const bezier = profile.segments.find(s => s.type === 'bezier')
    expect(bezier.points.length).toBe(4)
  })

  it('profile closes: last segment end angle matches first segment start angle + 360', () => {
    const bools = [true, false, true, false]
    const profile = buildCamProfile(bools, {
      innerRadius: 10, outerRadius: 20,
      transitionAngleDeg: 90,
      easeIn: 0.5, easeOut: 0.5,
    })
    // sum of all segment angular spans should equal 360
    const totalAngle = profile.segments.reduce((sum, s) => sum + s.spanDeg, 0)
    expect(Math.abs(totalAngle - 360)).toBeLessThan(0.001)
  })
})
```

**Step 2: Run tests to confirm failing**
```bash
npm test -- camGeometry
```
Expected: FAIL

**Step 3: Implement cam geometry**

Create `src/lib/camGeometry.js`:
```js
/**
 * Build a cam profile from a boolean array.
 *
 * Returns a list of segments. Each segment is one of:
 *   { type: 'arc', radius, startDeg, endDeg, spanDeg }
 *   { type: 'bezier', points: [{x,y},{x,y},{x,y},{x,y}], startDeg, endDeg, spanDeg }
 *
 * Angles are in degrees, measured counter-clockwise from the positive X axis.
 * The cam profile starts at angle 0 and goes counter-clockwise for 360°.
 */
export function buildCamProfile(bools, { innerRadius, outerRadius, transitionAngleDeg, easeIn, easeOut }) {
  const N = bools.length
  const stepDeg = 360 / N
  const halfTransDeg = transitionAngleDeg / 2

  // Find all edge transitions: indices where bools[i] !== bools[(i+1) % N]
  const transitions = []
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N
    if (bools[i] !== bools[next]) {
      // transition happens between sample i and sample next
      // boundary angle = midpoint between the two sample angles
      const angleDeg = (i + 1) * stepDeg // angle at start of next sample
      transitions.push({ angleDeg, fromOuter: bools[i], toOuter: bools[next] })
    }
  }

  // If no transitions, the entire cam is one arc
  if (transitions.length === 0) {
    const radius = bools[0] ? outerRadius : innerRadius
    return {
      segments: [{
        type: 'arc', radius,
        startDeg: 0, endDeg: 360, spanDeg: 360,
      }]
    }
  }

  // Build segments between transitions
  const segments = []
  const nTrans = transitions.length

  for (let ti = 0; ti < nTrans; ti++) {
    const t = transitions[ti]
    const tNext = transitions[(ti + 1) % nTrans]

    // Compute how far we can extend this transition without overlapping neighbors
    const prevT = transitions[(ti - 1 + nTrans) % nTrans]
    const gapBefore = angleDiff(t.angleDeg, prevT.angleDeg) // degrees available before this transition
    const gapAfter = angleDiff(tNext.angleDeg, t.angleDeg)  // degrees available after this transition

    const maxHalfBefore = gapBefore / 2
    const maxHalfAfter = gapAfter / 2
    const actualHalf = Math.min(halfTransDeg, maxHalfBefore, maxHalfAfter)

    const transStartDeg = t.angleDeg - actualHalf
    const transEndDeg = t.angleDeg + actualHalf
    const transSpan = actualHalf * 2

    // Flat arc from end of previous transition to start of this transition
    const prevTransEnd = (() => {
      const prevT2 = transitions[(ti - 1 + nTrans) % nTrans]
      const gapBefore2 = angleDiff(t.angleDeg, prevT2.angleDeg)
      const maxHalf2 = Math.min(halfTransDeg, gapBefore2 / 2, angleDiff(t.angleDeg, prevT2.angleDeg) / 2)
      return (prevT2.angleDeg + maxHalf2) % 360
    })()

    const arcStartDeg = prevTransEnd
    const arcEndDeg = transStartDeg
    const arcSpan = ((arcEndDeg - arcStartDeg) % 360 + 360) % 360

    if (arcSpan > 0.001) {
      const radius = t.fromOuter ? outerRadius : innerRadius
      segments.push({
        type: 'arc', radius,
        startDeg: arcStartDeg, endDeg: arcEndDeg, spanDeg: arcSpan,
      })
    }

    // Bezier transition
    const r1 = t.fromOuter ? outerRadius : innerRadius
    const r2 = t.toOuter ? outerRadius : innerRadius
    const transSpanRad = transSpan * Math.PI / 180
    const startRad = transStartDeg * Math.PI / 180
    const endRad = transEndDeg * Math.PI / 180

    const P0 = { x: r1 * Math.cos(startRad), y: r1 * Math.sin(startRad) }
    const P3 = { x: r2 * Math.cos(endRad), y: r2 * Math.sin(endRad) }

    // Tangent at P0 (perpendicular to radius, in CCW direction)
    const tangent0 = { x: -Math.sin(startRad), y: Math.cos(startRad) }
    // Tangent at P3
    const tangent3 = { x: -Math.sin(endRad), y: Math.cos(endRad) }

    const handleLen1 = easeIn * r1 * transSpanRad / 2
    const handleLen2 = easeOut * r2 * transSpanRad / 2

    const P1 = { x: P0.x + tangent0.x * handleLen1, y: P0.y + tangent0.y * handleLen1 }
    const P2 = { x: P3.x - tangent3.x * handleLen2, y: P3.y - tangent3.y * handleLen2 }

    segments.push({
      type: 'bezier',
      points: [P0, P1, P2, P3],
      startDeg: transStartDeg, endDeg: transEndDeg, spanDeg: transSpan,
    })
  }

  return { segments }
}

/** Positive angular difference from a to b (counter-clockwise), in degrees */
function angleDiff(b, a) {
  return ((b - a) % 360 + 360) % 360
}
```

**Step 4: Run tests**
```bash
npm test -- camGeometry
```
Expected: all 5 tests PASS

**Step 5: Commit**
```bash
git add src/lib/camGeometry.js src/lib/camGeometry.test.js
git commit -m "feat: cam geometry builder (arcs + bezier transitions)"
```

---

## Task 4: DXF export library

**Files:**
- Create: `src/lib/dxfExport.js`
- Create: `src/lib/dxfExport.test.js`

**Step 1: Write failing tests**

Create `src/lib/dxfExport.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { profileToDxf, buildDxfFile } from './dxfExport'

describe('profileToDxf', () => {
  it('returns an array of DXF entity strings', () => {
    const profile = {
      segments: [{ type: 'arc', radius: 10, startDeg: 0, endDeg: 360, spanDeg: 360 }]
    }
    const entities = profileToDxf(profile, 'row_0')
    expect(Array.isArray(entities)).toBe(true)
    expect(entities.length).toBeGreaterThan(0)
  })

  it('arc segment produces ARC entity string', () => {
    const profile = {
      segments: [{ type: 'arc', radius: 15, startDeg: 0, endDeg: 360, spanDeg: 360 }]
    }
    const entities = profileToDxf(profile, 'row_0')
    expect(entities[0]).toContain('ARC')
    expect(entities[0]).toContain('15')
  })

  it('bezier segment produces SPLINE entity string', () => {
    const profile = {
      segments: [{
        type: 'bezier',
        points: [
          {x: 10, y: 0}, {x: 10, y: 5}, {x: 0, y: 10}, {x: 0, y: 10}
        ],
        startDeg: 0, endDeg: 90, spanDeg: 90
      }]
    }
    const entities = profileToDxf(profile, 'row_0')
    expect(entities[0]).toContain('SPLINE')
  })
})

describe('buildDxfFile', () => {
  it('wraps entities in valid DXF structure', () => {
    const allEntities = [['  0\nARC\n  8\nlayer1\n']]
    const dxf = buildDxfFile(allEntities, ['layer1'])
    expect(dxf).toContain('SECTION')
    expect(dxf).toContain('ENTITIES')
    expect(dxf).toContain('ENDSEC')
    expect(dxf).toContain('EOF')
  })
})
```

**Step 2: Run to confirm failing**
```bash
npm test -- dxfExport
```

**Step 3: Implement DXF export**

Create `src/lib/dxfExport.js`:
```js
/**
 * Convert a cam profile to an array of DXF entity strings.
 * @param {object} profile - from buildCamProfile
 * @param {string} layerName
 * @returns {string[]}
 */
export function profileToDxf(profile, layerName) {
  return profile.segments.map(seg => {
    if (seg.type === 'arc') return arcToDxf(seg, layerName)
    if (seg.type === 'bezier') return bezierToDxf(seg, layerName)
    return ''
  })
}

function arcToDxf({ radius, startDeg, endDeg }, layer) {
  // DXF ARC: center (0,0), given radius and angle range
  // Angles are measured CCW from positive X axis
  const start = startDeg % 360
  const end = endDeg % 360
  return [
    '  0', 'ARC',
    '  8', layer,
    ' 10', '0.0',   // center X
    ' 20', '0.0',   // center Y
    ' 30', '0.0',   // center Z
    ' 40', radius.toFixed(6),
    ' 50', start.toFixed(6),
    ' 51', end.toFixed(6),
  ].join('\n')
}

function bezierToDxf({ points }, layer) {
  // Cubic Bezier as DXF SPLINE (degree 3, 4 control points)
  // Knot vector for clamped cubic: 0 0 0 0 1 1 1 1
  const knots = [0, 0, 0, 0, 1, 1, 1, 1]
  const lines = [
    '  0', 'SPLINE',
    '  8', layer,
    ' 70', '8',   // flags: closed=0, not periodic
    ' 71', '3',   // degree
    ' 72', String(knots.length),   // knot count
    ' 73', String(points.length),  // control point count
    ' 74', '0',   // fit point count
  ]
  knots.forEach(k => { lines.push(' 40'); lines.push(k.toFixed(6)) })
  points.forEach(p => {
    lines.push(' 10'); lines.push(p.x.toFixed(6))
    lines.push(' 20'); lines.push(p.y.toFixed(6))
    lines.push(' 30'); lines.push('0.000000')
  })
  return lines.join('\n')
}

/**
 * Wrap entity arrays into a complete DXF file string.
 * @param {string[][]} allEntities - array of entity arrays (one array per cam)
 * @param {string[]} layerNames
 * @returns {string}
 */
export function buildDxfFile(allEntities, layerNames) {
  const header = [
    '  0', 'SECTION',
    '  2', 'HEADER',
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'TABLES',
    '  0', 'TABLE',
    '  2', 'LAYER',
    ...layerNames.flatMap(name => [
      '  0', 'LAYER',
      '  2', name,
      ' 70', '0',
      ' 62', '7',   // color white
      '  6', 'CONTINUOUS',
    ]),
    '  0', 'ENDTAB',
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'ENTITIES',
  ].join('\n')

  const entityBlock = allEntities.flat().join('\n')

  const footer = ['  0', 'ENDSEC', '  0', 'EOF'].join('\n')

  return [header, entityBlock, footer].join('\n')
}
```

**Step 4: Run tests**
```bash
npm test -- dxfExport
```
Expected: all tests PASS

**Step 5: Commit**
```bash
git add src/lib/dxfExport.js src/lib/dxfExport.test.js
git commit -m "feat: DXF export for arc and bezier cam segments"
```

---

## Task 5: SVG export library

**Files:**
- Create: `src/lib/svgExport.js`
- Create: `src/lib/svgExport.test.js`

**Step 1: Write failing tests**

Create `src/lib/svgExport.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { profileToSvgPath, buildSvgFile } from './svgExport'

describe('profileToSvgPath', () => {
  it('returns a valid SVG path string for an all-arc profile', () => {
    const profile = {
      segments: [{ type: 'arc', radius: 10, startDeg: 0, endDeg: 360, spanDeg: 360 }]
    }
    const path = profileToSvgPath(profile)
    expect(typeof path).toBe('string')
    expect(path).toContain('M')
    expect(path).toContain('A')
    expect(path).toContain('Z')
  })

  it('bezier segment produces C command', () => {
    const profile = {
      segments: [{
        type: 'bezier',
        points: [{x:10,y:0},{x:10,y:5},{x:5,y:10},{x:0,y:10}],
        startDeg: 0, endDeg: 90, spanDeg: 90
      }]
    }
    const path = profileToSvgPath(profile)
    expect(path).toContain('C')
  })
})

describe('buildSvgFile', () => {
  it('produces valid SVG wrapper', () => {
    const svg = buildSvgFile([{ path: 'M 0 0 Z', label: 'row_0' }], 100)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('M 0 0 Z')
  })
})
```

**Step 2: Run to confirm failing**
```bash
npm test -- svgExport
```

**Step 3: Implement SVG export**

Create `src/lib/svgExport.js`:
```js
const DEG = Math.PI / 180

/**
 * Convert a cam profile to an SVG path data string.
 * @param {object} profile - from buildCamProfile
 * @returns {string} SVG path data (d attribute)
 */
export function profileToSvgPath(profile) {
  const cmds = []
  let firstPoint = null

  for (const seg of profile.segments) {
    if (seg.type === 'arc') {
      // Full circle: SVG can't draw a full circle as a single arc, split into two
      const cx = 0, cy = 0, r = seg.radius
      if (seg.spanDeg >= 359.99) {
        const p = { x: r, y: 0 }
        if (!firstPoint) firstPoint = p
        cmds.push(`M ${fmt(r)} 0`)
        cmds.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r)} 0`)
        cmds.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r)} 0`)
      } else {
        const startRad = seg.startDeg * DEG
        const endRad = seg.endDeg * DEG
        const p0 = { x: seg.radius * Math.cos(startRad), y: seg.radius * Math.sin(startRad) }
        const p1 = { x: seg.radius * Math.cos(endRad), y: seg.radius * Math.sin(endRad) }
        const largeArc = seg.spanDeg > 180 ? 1 : 0
        if (!firstPoint) { firstPoint = p0; cmds.push(`M ${fmt(p0.x)} ${fmt(p0.y)}`) }
        else cmds.push(`L ${fmt(p0.x)} ${fmt(p0.y)}`)
        cmds.push(`A ${fmt(r)} ${fmt(r)} 0 ${largeArc} 1 ${fmt(p1.x)} ${fmt(p1.y)}`)
      }
    } else if (seg.type === 'bezier') {
      const [P0, P1, P2, P3] = seg.points
      if (!firstPoint) { firstPoint = P0; cmds.push(`M ${fmt(P0.x)} ${fmt(P0.y)}`) }
      else cmds.push(`L ${fmt(P0.x)} ${fmt(P0.y)}`)
      cmds.push(`C ${fmt(P1.x)} ${fmt(P1.y)} ${fmt(P2.x)} ${fmt(P2.y)} ${fmt(P3.x)} ${fmt(P3.y)}`)
    }
  }

  cmds.push('Z')
  return cmds.join(' ')
}

function fmt(n) { return n.toFixed(4) }

/**
 * Build a complete SVG file string.
 * @param {{ path: string, label: string }[]} cams
 * @param {number} viewBoxSize - half-size for viewBox (e.g. outerRadius * 1.2)
 * @returns {string}
 */
export function buildSvgFile(cams, viewBoxSize) {
  const v = viewBoxSize
  const groups = cams.map(({ path, label }) =>
    `  <g id="${label}" inkscape:label="${label}">\n    <path d="${path}" fill="none" stroke="black" stroke-width="0.5"/>\n  </g>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  viewBox="${-v} ${-v} ${v*2} ${v*2}" width="${v*2}mm" height="${v*2}mm">
${groups}
</svg>`
}
```

**Step 4: Run tests**
```bash
npm test -- svgExport
```
Expected: all tests PASS

**Step 5: Commit**
```bash
git add src/lib/svgExport.js src/lib/svgExport.test.js
git commit -m "feat: SVG export for cam profiles"
```

---

## Task 6: ImageUpload component

**Files:**
- Create: `src/components/ImageUpload.jsx`

**Step 1: Implement component**

Create `src/components/ImageUpload.jsx`:
```jsx
import { useRef } from 'react'

export default function ImageUpload({ onImageLoaded }) {
  const inputRef = useRef()

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      onImageLoaded({ imageData, url, file, width: img.width, height: img.height })
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current.click()}
      style={{
        border: '2px dashed #888', borderRadius: 8, padding: 32,
        textAlign: 'center', cursor: 'pointer', marginBottom: 16,
      }}
    >
      <p>Drag & drop a B&W image here, or click to select</p>
      <input
        ref={inputRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  )
}
```

**Step 2: Wire into App.jsx and verify manually**

Update `src/App.jsx`:
```jsx
import { useState } from 'react'
import ImageUpload from './components/ImageUpload'

export default function App() {
  const [image, setImage] = useState(null)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>Cam Creator</h1>
      <ImageUpload onImageLoaded={setImage} />
      {image && <p>Loaded: {image.width} × {image.height}px</p>}
    </div>
  )
}
```

Run `npm run dev`, drag in an image, verify dimensions appear.

**Step 3: Commit**
```bash
git add src/components/ImageUpload.jsx src/App.jsx
git commit -m "feat: image upload component with drag-and-drop"
```

---

## Task 7: DPI reading utility

**Files:**
- Create: `src/lib/imageMeta.js`
- Create: `src/lib/imageMeta.test.js`

**Step 1: Write failing test**

Create `src/lib/imageMeta.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { parseDpi } from './imageMeta'

describe('parseDpi', () => {
  it('returns 96 as fallback when no DPI metadata', async () => {
    // Minimal PNG with no pHYs chunk (just IHDR + IDAT + IEND)
    // We'll use a real tiny PNG file as a Blob
    const dpi = await parseDpi(new Blob([], { type: 'image/png' }))
    expect(dpi).toBe(96)
  })
})
```

**Step 2: Run to confirm failing**
```bash
npm test -- imageMeta
```

**Step 3: Implement using exifr**

Create `src/lib/imageMeta.js`:
```js
import exifr from 'exifr'

/**
 * Parse DPI from image file metadata.
 * Falls back to 96 DPI if not found.
 * @param {File|Blob} file
 * @returns {Promise<number>} DPI
 */
export async function parseDpi(file) {
  try {
    const output = await exifr.parse(file, { pick: ['XResolution', 'YResolution', 'ResolutionUnit'] })
    if (!output || !output.XResolution) return 96
    // ResolutionUnit: 2 = inch, 3 = cm
    const unit = output.ResolutionUnit ?? 2
    const dpi = unit === 3 ? output.XResolution * 2.54 : output.XResolution
    return Math.round(dpi) || 96
  } catch {
    return 96
  }
}

/**
 * Calculate image physical size in cm.
 * @param {number} widthPx
 * @param {number} heightPx
 * @param {number} dpi
 * @returns {{ widthCm: number, heightCm: number }}
 */
export function imageSizeCm(widthPx, heightPx, dpi) {
  const widthCm = (widthPx / dpi) * 2.54
  const heightCm = (heightPx / dpi) * 2.54
  return { widthCm, heightCm }
}
```

**Step 4: Run tests**
```bash
npm test -- imageMeta
```
Expected: PASS (fallback returns 96)

**Step 5: Commit**
```bash
git add src/lib/imageMeta.js src/lib/imageMeta.test.js
git commit -m "feat: image DPI reader using exifr with fallback"
```

---

## Task 8: Parameter panel component

**Files:**
- Create: `src/components/ParameterPanel.jsx`

**Step 1: Implement**

Create `src/components/ParameterPanel.jsx`:
```jsx
import { useEffect } from 'react'

const UNITS = ['px', 'cm', 'in']

function toPixels(value, unit, dpi) {
  if (unit === 'px') return value
  if (unit === 'cm') return (value / 2.54) * dpi
  if (unit === 'in') return value * dpi
  return value
}

export default function ParameterPanel({ params, setParams, image, dpi }) {
  const imageWidthPx = image?.width ?? 0

  // When column spacing changes, update transition angle
  function handleColSpacing(value, unit) {
    const colPx = toPixels(value, unit, dpi)
    const transAngle = imageWidthPx > 0 && colPx > 0
      ? 360 / (imageWidthPx / colPx)
      : params.transitionAngleDeg
    setParams(p => ({ ...p, colSpacing: value, colUnit: unit, transitionAngleDeg: +transAngle.toFixed(2) }))
  }

  // When transition angle changes, update column spacing
  function handleTransAngle(value) {
    const colPx = imageWidthPx > 0 && value > 0
      ? imageWidthPx / (360 / value)
      : toPixels(params.colSpacing, params.colUnit, dpi)
    const colInUnit = params.colUnit === 'px' ? colPx
      : params.colUnit === 'cm' ? (colPx / dpi) * 2.54
      : colPx / dpi
    setParams(p => ({ ...p, transitionAngleDeg: +value, colSpacing: +colInUnit.toFixed(3) }))
  }

  const colPx = toPixels(params.colSpacing, params.colUnit, dpi)
  const rowPx = toPixels(params.rowSpacing, params.rowUnit, dpi)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
      {/* Row spacing */}
      <label>
        Row spacing&nbsp;
        <input type="number" min={1} value={params.rowSpacing}
          onChange={e => setParams(p => ({ ...p, rowSpacing: +e.target.value }))} style={{ width: 70 }} />
        <select value={params.rowUnit}
          onChange={e => setParams(p => ({ ...p, rowUnit: e.target.value }))}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      </label>

      {/* Column spacing ↔ transition angle */}
      <label>
        Col spacing&nbsp;
        <input type="number" min={0.1} step={0.1} value={params.colSpacing}
          onChange={e => handleColSpacing(+e.target.value, params.colUnit)} style={{ width: 70 }} />
        <select value={params.colUnit}
          onChange={e => handleColSpacing(params.colSpacing, e.target.value)}>
          {UNITS.map(u => <option key={u}>{u}</option>)}
        </select>
      </label>
      <span style={{ alignSelf: 'center' }}>⇔</span>
      <label>
        Transition angle (°)&nbsp;
        <input type="number" min={0.1} step={0.1} value={params.transitionAngleDeg}
          onChange={e => handleTransAngle(+e.target.value)} style={{ width: 70 }} />
      </label>

      {/* Radii */}
      <label>
        Inner radius (mm)&nbsp;
        <input type="number" min={1} value={params.innerRadius}
          onChange={e => setParams(p => ({ ...p, innerRadius: +e.target.value }))} style={{ width: 70 }} />
      </label>
      <label>
        Outer radius (mm)&nbsp;
        <input type="number" min={1} value={params.outerRadius}
          onChange={e => setParams(p => ({ ...p, outerRadius: +e.target.value }))} style={{ width: 70 }} />
      </label>

      {/* Sampling mode */}
      <label>
        Sampling&nbsp;
        <select value={params.mode} onChange={e => setParams(p => ({ ...p, mode: e.target.value }))}>
          <option value="exact">Exact pixel</option>
          <option value="convolution">Convolution</option>
        </select>
      </label>

      {params.mode === 'convolution' && <>
        <label>
          Conv width (px)&nbsp;
          <input type="number" min={1} value={params.convW}
            onChange={e => setParams(p => ({ ...p, convW: +e.target.value }))} style={{ width: 60 }} />
          <button onClick={() => setParams(p => ({ ...p, convW: Math.max(1, Math.round(colPx)) }))}>
            Set to cover
          </button>
        </label>
        <label>
          Conv height (px)&nbsp;
          <input type="number" min={1} value={params.convH}
            onChange={e => setParams(p => ({ ...p, convH: +e.target.value }))} style={{ width: 60 }} />
          <button onClick={() => setParams(p => ({ ...p, convH: Math.max(1, Math.round(rowPx)) }))}>
            Set to cover
          </button>
        </label>
        <label>
          Threshold&nbsp;
          <input type="range" min={0} max={1} step={0.01} value={params.threshold}
            onChange={e => setParams(p => ({ ...p, threshold: +e.target.value }))} />
          &nbsp;{params.threshold}
        </label>
      </>}

      {/* Black = outer */}
      <label>
        <input type="checkbox" checked={params.blackIsOuter}
          onChange={e => setParams(p => ({ ...p, blackIsOuter: e.target.checked }))} />
        &nbsp;Black = outer radius
      </label>

      {/* Ease tensions */}
      <label>
        Ease-in tension&nbsp;
        <input type="range" min={0} max={1} step={0.01} value={params.easeIn}
          onChange={e => setParams(p => ({ ...p, easeIn: +e.target.value }))} />
        &nbsp;{params.easeIn}
      </label>
      <label>
        Ease-out tension&nbsp;
        <input type="range" min={0} max={1} step={0.01} value={params.easeOut}
          onChange={e => setParams(p => ({ ...p, easeOut: +e.target.value }))} />
        &nbsp;{params.easeOut}
      </label>
    </div>
  )
}
```

**Step 2: Add default params to App.jsx and wire up**

Update `src/App.jsx`:
```jsx
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
        </p>
      )}
      {image && <ParameterPanel params={params} setParams={setParams} image={image} dpi={dpi} />}
    </div>
  )
}
```

**Step 3: Verify manually**
Run `npm run dev`, upload image, verify DPI line and all parameter controls appear. Verify column spacing ↔ transition angle link works.

**Step 4: Commit**
```bash
git add src/components/ParameterPanel.jsx src/App.jsx src/lib/imageMeta.js
git commit -m "feat: parameter panel with linked col-spacing/transition-angle"
```

---

## Task 9: Image preview overlay

**Files:**
- Create: `src/components/ImagePreview.jsx`

**Step 1: Implement**

Create `src/components/ImagePreview.jsx`:
```jsx
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

    // Draw image
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      if (!samples) return

      const rowPx = toPixels(params.rowSpacing, params.rowUnit)
      const colPx = toPixels(params.colSpacing, params.colUnit)
      const dotR = Math.max(2, Math.min(colPx, rowPx) * 0.3)

      // Draw row lines
      ctx.strokeStyle = 'rgba(0, 120, 255, 0.4)'
      ctx.lineWidth = 1
      samples.forEach((row, ri) => {
        const y = ri * rowPx
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(image.width, y)
        ctx.stroke()
      })

      // Draw sample dots
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
```

**Step 2: Wire samples into App.jsx**

Add to `src/App.jsx` (after imports):
```jsx
import { useMemo } from 'react'
import ImagePreview from './components/ImagePreview'
import { sampleImage } from './lib/sampler'
```

Add inside `App` component:
```jsx
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
```

Add `<ImagePreview image={image} samples={samples} params={params} dpi={dpi} />` to the JSX.

**Step 3: Verify manually**

Upload a B&W image. Verify row lines and colored dots appear correctly.

**Step 4: Commit**
```bash
git add src/components/ImagePreview.jsx src/App.jsx
git commit -m "feat: image preview with row lines and sample dot overlay"
```

---

## Task 10: Pattern skeleton preview

**Files:**
- Create: `src/components/PatternSkeleton.jsx`

**Step 1: Implement**

Create `src/components/PatternSkeleton.jsx`:
```jsx
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
          runStart = ci  // start of a true run
        } else if (!val && runStart !== null) {
          // end of a true run
          const runLength = ci - runStart
          if (runLength === 1) {
            // isolated dot
            ctx.beginPath()
            ctx.arc(runStart * colPx, y, dotR, 0, Math.PI * 2)
            ctx.fill()
          } else {
            // line segment
            ctx.beginPath()
            ctx.moveTo(runStart * colPx, y)
            ctx.lineTo((ci - 1) * colPx, y)
            ctx.stroke()
          }
          runStart = null
        }
      })

      // handle run that goes to end of row
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
```

**Step 2: Add to App.jsx**

```jsx
import PatternSkeleton from './components/PatternSkeleton'
```

Add `<PatternSkeleton image={image} samples={samples} params={params} dpi={dpi} />` next to `<ImagePreview>` in a side-by-side flex container.

**Step 3: Verify manually**

Upload a B&W image. Verify the skeleton shows only true-sample geometry: dots for isolated samples, lines for consecutive samples.

**Step 4: Commit**
```bash
git add src/components/PatternSkeleton.jsx src/App.jsx
git commit -m "feat: pattern skeleton preview showing true-sample geometry"
```

---

## Task 11: Cam preview component and grid

**Files:**
- Create: `src/components/CamPreview.jsx`
- Create: `src/components/CamGrid.jsx`

**Step 1: Implement CamPreview**

Create `src/components/CamPreview.jsx`:
```jsx
import { profileToSvgPath } from '../lib/svgExport'

export default function CamPreview({ profile, label, outerRadius }) {
  if (!profile) return null
  const path = profileToSvgPath(profile)
  const v = outerRadius * 1.3

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={`${-v} ${-v} ${v*2} ${v*2}`} width={160} height={160}
        style={{ border: '1px solid #ccc', borderRadius: 4 }}>
        <path d={path} fill="rgba(100,160,255,0.15)" stroke="navy" strokeWidth={outerRadius * 0.02} />
        {/* Guide circles */}
        <circle cx={0} cy={0} r={outerRadius} fill="none" stroke="#ccc" strokeWidth={0.5} strokeDasharray="2,2"/>
        <circle cx={0} cy={0} r={profile.innerRadius ?? 0} fill="none" stroke="#ccc" strokeWidth={0.5} strokeDasharray="2,2"/>
      </svg>
      <p style={{ fontSize: 11, margin: 4, color: '#555' }}>{label}</p>
    </div>
  )
}
```

**Step 2: Implement CamGrid**

Create `src/components/CamGrid.jsx`:
```jsx
import CamPreview from './CamPreview'

export default function CamGrid({ profiles, params }) {
  if (!profiles || profiles.length === 0) return null

  return (
    <div>
      <h3>Cam profiles ({profiles.length} rows)</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {profiles.map((p, i) => (
          <CamPreview
            key={i}
            profile={p}
            label={`Row ${i}`}
            outerRadius={params.outerRadius}
          />
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Compute profiles in App.jsx and wire up**

Add to `src/App.jsx`:
```jsx
import { buildCamProfile } from './lib/camGeometry'
import CamGrid from './components/CamGrid'
```

Add inside `App`:
```jsx
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
```

Add `<CamGrid profiles={profiles} params={params} />` to the JSX.

**Step 4: Verify manually**

Upload a B&W image. Verify cam profile SVG thumbnails appear for each row, showing the cam shape.

**Step 5: Commit**
```bash
git add src/components/CamPreview.jsx src/components/CamGrid.jsx src/App.jsx
git commit -m "feat: cam profile preview grid"
```

---

## Task 12: Download panel

**Files:**
- Create: `src/components/DownloadPanel.jsx`

**Step 1: Implement**

Create `src/components/DownloadPanel.jsx`:
```jsx
import { useState } from 'react'
import JSZip from 'jszip'
import { profileToDxf, buildDxfFile } from '../lib/dxfExport'
import { profileToSvgPath, buildSvgFile } from '../lib/svgExport'

export default function DownloadPanel({ profiles, params, dpi }) {
  const [format, setFormat] = useState('dxf')       // 'dxf' | 'svg' | 'both'
  const [packaging, setPackaging] = useState('all')  // 'all' | 'zip'

  if (!profiles || profiles.length === 0) return null

  async function handleDownload() {
    const rowLabels = profiles.map((_, i) => `row_${i}`)

    if (packaging === 'all') {
      if (format === 'dxf' || format === 'both') {
        const allEntities = profiles.map((p, i) => profileToDxf(p, rowLabels[i]))
        const dxf = buildDxfFile(allEntities, rowLabels)
        downloadText(dxf, 'cams.dxf')
      }
      if (format === 'svg' || format === 'both') {
        const cams = profiles.map((p, i) => ({
          path: profileToSvgPath(p),
          label: rowLabels[i],
        }))
        const svg = buildSvgFile(cams, params.outerRadius * 1.3)
        downloadText(svg, 'cams.svg')
      }
    } else {
      // zip
      const zip = new JSZip()
      profiles.forEach((p, i) => {
        if (format === 'dxf' || format === 'both') {
          const entities = profileToDxf(p, rowLabels[i])
          const dxf = buildDxfFile([entities], [rowLabels[i]])
          zip.file(`${rowLabels[i]}.dxf`, dxf)
        }
        if (format === 'svg' || format === 'both') {
          const path = profileToSvgPath(p)
          const svg = buildSvgFile([{ path, label: rowLabels[i] }], params.outerRadius * 1.3)
          zip.file(`${rowLabels[i]}.svg`, svg)
        }
      })
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'cams.zip')
    }
  }

  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
      <h3>Download</h3>
      <label>
        Format:&nbsp;
        <select value={format} onChange={e => setFormat(e.target.value)}>
          <option value="dxf">DXF</option>
          <option value="svg">SVG</option>
          <option value="both">Both</option>
        </select>
      </label>
      &nbsp;&nbsp;
      <label>
        Packaging:&nbsp;
        <select value={packaging} onChange={e => setPackaging(e.target.value)}>
          <option value="all">All cams in one file</option>
          <option value="zip">One file per cam (zip)</option>
        </select>
      </label>
      &nbsp;&nbsp;
      <button onClick={handleDownload} style={{ padding: '6px 16px' }}>Download</button>
    </div>
  )
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' })
  downloadBlob(blob, filename)
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
```

**Step 2: Wire into App.jsx**

```jsx
import DownloadPanel from './components/DownloadPanel'
```

Add `<DownloadPanel profiles={profiles} params={params} dpi={dpi} />` to the JSX.

**Step 3: Verify manually**

Generate cams, click Download. Verify DXF and SVG files download. Open SVG in a browser to confirm cam shapes are visible. Open DXF in a CAD viewer if available.

**Step 4: Commit**
```bash
git add src/components/DownloadPanel.jsx src/App.jsx
git commit -m "feat: download panel with DXF/SVG export and zip packaging"
```

---

## Task 13: Layout polish

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/index.css`

**Step 1: Arrange previews side-by-side and add basic styling**

Update `src/index.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; margin: 0; }
h1 { margin-bottom: 8px; }
h3 { margin: 8px 0 4px; font-size: 14px; color: #333; }
label { font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
input[type=number] { padding: 2px 4px; }
button { cursor: pointer; }
```

Update layout in `src/App.jsx` — wrap the two preview canvases in a flex row:
```jsx
<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
  <div style={{ flex: 1, minWidth: 300 }}>
    <ImagePreview image={image} samples={samples} params={params} dpi={dpi} />
  </div>
  <div style={{ flex: 1, minWidth: 300 }}>
    <PatternSkeleton image={image} samples={samples} params={params} dpi={dpi} />
  </div>
</div>
```

**Step 2: Run final check**
```bash
npm run dev
```
Verify full flow: upload → params → two previews → cam grid → download.

**Step 3: Build for production**
```bash
npm run build
```
Expected: `dist/` folder created with no errors.

**Step 4: Commit**
```bash
git add src/App.jsx src/index.css
git commit -m "feat: layout polish and production build verified"
```

---

## Task 14: Run full test suite

**Step 1: Run all tests**
```bash
npm test
```
Expected: all tests pass (sampler, camGeometry, dxfExport, svgExport, imageMeta)

**Step 2: If any tests fail, fix before proceeding**

**Step 3: Final commit**
```bash
git add .
git commit -m "chore: all tests passing, cam creator complete"
```
