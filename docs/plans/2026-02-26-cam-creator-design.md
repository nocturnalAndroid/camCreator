# Cam Creator — Design Document
Date: 2026-02-26

## Overview

A client-side-only web application that takes a black-and-white (no grey) image, samples it in a grid, and generates cam profiles (closed vector curves) from each sampled row. Output is DXF and/or SVG, suitable for import into CAD software.

---

## Stack

- **React + Vite** — builds to static HTML/JS/CSS, deployable to any static host
- **jszip** — zip multiple files for per-cam download
- **DXF** — hand-generated text (DXF is a plain-text format; no library needed for ARC + SPLINE entities)
- **SVG** — native browser SVG
- **Canvas API** — image processing and preview overlays

---

## Project Structure

```
src/
  components/
    ImageUpload.jsx       # drag-and-drop / file picker
    ParameterPanel.jsx    # all config inputs
    ImagePreview.jsx      # image + row/sample dot overlay
    PatternSkeleton.jsx   # second preview: true-sample segments/dots only
    CamPreview.jsx        # SVG preview of one cam profile
    CamGrid.jsx           # grid of all cam previews
    DownloadPanel.jsx     # format/packaging toggles + download button
  lib/
    sampler.js            # image → boolean[][]
    camGeometry.js        # boolean[] → cam profile (arcs + bezier segments)
    dxfExport.js          # profile → DXF text
    svgExport.js          # profile → SVG text
  App.jsx
```

---

## Parameters

| Parameter | Type | Notes |
|---|---|---|
| Row spacing | Number + unit (px / cm / in) | distance between sampled rows |
| Column spacing | Number + unit (px / cm / in) | linked to transition angle |
| Transition angle | Number (degrees) | linked to column spacing; `transition_angle = 360 / (image_width_px / column_spacing_px)` |
| Inner radius | Number (mm) | cam low position |
| Outer radius | Number (mm) | cam high position |
| Sampling method | Toggle: exact pixel / convolution | |
| Convolution width | Number (px) | visible when convolution selected; "Set to cover" button sets to column spacing |
| Convolution height | Number (px) | visible when convolution selected; "Set to cover" button sets to row spacing |
| Convolution threshold | 0–1 slider | default 0.5 |
| Black = outer radius | Toggle | flip which color maps to which radius |
| Ease-in tension | 0–1 slider | controls how gradually the spline leaves the current radius; default 0.5 |
| Ease-out tension | 0–1 slider | controls how gradually the spline arrives at the new radius; default 0.5 |

**DPI:** Read from image metadata (PNG/JPEG). Falls back to 96 DPI. Displayed as:
`Detected: 300 DPI — Image size: 21.2 × 29.7 cm`

**Linked parameters:** Changing column spacing recalculates transition angle and vice versa. Both fields are visually linked (e.g., a chain icon between them).

---

## Image Preview (Panel 1)

- Uploaded image rendered at full width on a `<canvas>`
- Horizontal lines drawn at each sampled row
- Dots at each sample point, color-coded:
  - Filled dot = true (outer radius)
  - Hollow dot = false (inner radius)
- Updates live as parameters change

---

## Pattern Skeleton Preview (Panel 2)

- Black on white canvas
- For each row, draw only the true-sample geometry:
  - Consecutive true samples → line segment connecting them (length = column spacing)
  - Isolated single true sample → dot
- Gives a clean view of the pattern that will become outer-radius sections

---

## Sampling Algorithm

1. Draw image to offscreen canvas, read RGBA pixel data
2. **Exact mode:** read luminance of single pixel at `(col_spacing * i, row_spacing * j)`
3. **Convolution mode:** average luminance over a `convolution_width × convolution_height` neighborhood centered on the sample point; compare average to threshold
4. Apply `black = outer radius` toggle
5. Output: `boolean[][]` — one array per row

---

## Cam Geometry

Each row produces `boolean[]` of length N. The cam has N angular positions:
`angle[i] = i * (360° / N)`

**Profile segments:**
- Flat section (all samples same value) → **ARC** at inner or outer radius
- Transition (adjacent samples differ) → **cubic Bezier** over `transition_angle` degrees

**Bezier control points for a transition from radius r1 to r2 over arc [α, α+θ]:**
- P0 = point at (r1, α)
- P3 = point at (r2, α+θ)
- P1 = P0 displaced along the tangent by `ease_in_tension * θ/2` (stays at r1)
- P2 = P3 displaced along the tangent (backward) by `ease_out_tension * θ/2` (stays at r2)

When two transitions are so close that their arcs would overlap, each is clipped to half the gap.

The profile is a closed curve composed of alternating ARC and SPLINE entities.

---

## DXF Export

- Units: millimeters
- One `LAYER` per cam, named by row position (e.g., `row_42px`)
- Each cam: sequence of `ARC` and `SPLINE` (degree-3 NURBS) entities forming a closed loop
- All-in-one mode: all layers in one DXF file
- Per-cam mode: one DXF file per cam, packaged as a `.zip`

---

## SVG Export

- Each cam: a `<g>` group centered at origin
- Composed of `<path>` elements using `A` (arc) and `C` (cubic Bezier) commands
- All-in-one mode: all groups in one SVG file
- Per-cam mode: one SVG file per cam, packaged as a `.zip`

---

## Download Panel

- Output format: **DXF** / **SVG** / **Both**
- Packaging: **One file per cam** (zip) / **All cams in one file**
- Download button triggers generation and file save
