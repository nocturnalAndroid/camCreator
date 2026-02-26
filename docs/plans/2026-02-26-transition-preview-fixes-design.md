# Design: Transition Preview Fixes & Input Validation

Date: 2026-02-26

## Scope

Three fixes to `TransitionPreview.jsx`, `App.jsx`, and `sampler.js`.

---

## Fix 1 — Stroke width scales with viewBox

**Problem:** `sw = ro * 0.015` is constant regardless of viewBox size. When the arc
view shows a very small angle, the viewBox becomes narrow, SVG scales up uniformly,
and the stroke renders at 60–90px thick.

**Fix:** Move `sw` computation to after the viewBox bounds are known.
- Arc case: `sw = Math.min(vw, vh) * 0.008`
- Full-circle case: `sw = ro * 0.015` (unchanged — equivalent to `Math.min(2.5ro, 2.5ro) * 0.006`)

---

## Fix 2 — Rotate preview 90° CCW (12 o'clock start)

**Problem:** Arc starts at 0° (3 o'clock). User wants 12 o'clock start.

**Fix:** Wrap all SVG content in `<g transform="rotate(-90)">`.
- Full-circle case: viewBox stays `(-v, -v, 2v, 2v)` (square, symmetric — no change needed).
- Arc case: adjust viewBox to rotated bounding box.
  - Original: `(vx, vy, vw, vh)`
  - Rotated: `(vy, -vx-vw, vh, vw)` — swap width/height, flip y origin

---

## Fix 3 — Input validation with pre-allocated error line

**Problem:** Clearing a spacing field sets it to 0 or NaN, causing an infinite loop
in `sampler.js` (`y += 0` loops forever) and division-by-zero in geometry.

**Constraints to enforce:**
| Parameter | Minimum |
|---|---|
| `rowSpacingPx` | ≥ 1 |
| `colSpacingPx` | ≥ 1 |
| `innerRadius` | ≥ 1 |
| `outerRadius` | > `innerRadius` |
| `dpi` | ≥ 1 |
| `transitionDistanceMm` | > 0 |

**Fix:**
1. Add `validateParams(params, dpi)` in `App.jsx` returning first error string or `null`.
2. Reserve a `<div style={{ height: 24 }}>` below ParameterPanel — always occupies space,
   shows red error text when invalid.
3. Gate `sampleImage` and `buildCamProfile` useMemo calls: skip (return `null`) when error exists.
4. Add safety guard at top of `sampleImage()` in `sampler.js`:
   `if (rowSpacingPx <= 0 || colSpacingPx <= 0) return []`

---

## Files Changed

- `src/components/TransitionPreview.jsx` — fixes 1 & 2
- `src/App.jsx` — fix 3 (validation + error display + gating)
- `src/lib/sampler.js` — fix 3 (safety guard)
