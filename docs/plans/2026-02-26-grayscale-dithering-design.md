# Grayscale Intermediate & Floyd–Steinberg Dithering

**Date:** 2026-02-26

## Summary

Add Floyd–Steinberg dithering as an optional composable flag on top of the existing `exact` and `convolution` sampling modes. Grayscale is used as an internal intermediate representation; the final output of `sampleImage` remains `boolean[][]`.

## Design

### Approach chosen: composable `dither` boolean flag (Approach B)

Keep `mode: 'exact' | 'convolution'` unchanged. Add a `dither: boolean` parameter. When true, `sampleImage` collects a full luminance `float[][]` grid then applies Floyd–Steinberg in a second pass to produce the final `boolean[][]`. The existing `threshold` param defines the FS quantization boundary.

### Sampler (`src/lib/sampler.js`)

`sampleImage` gains `dither: boolean` (default `false`). When `false`, behavior is identical to today.

When `dither: true`:

1. **First pass** — collect full `float[][]` luminance grid using existing `getPixelLuminance` / `getConvLuminance` helpers (unchanged).
2. **Second pass** — Floyd–Steinberg scan in raster order (left-to-right, top-to-bottom):
   - `quantized = luminance < threshold ? 0 : 1`
   - `error = luminance - quantized`
   - Distribute error to in-bounds neighbors:
     - right: `7/16`
     - bottom-left: `3/16`
     - bottom: `5/16`
     - bottom-right: `1/16`
3. Convert each `quantized` value to boolean applying `blackIsOuter` (same logic as today: `quantized === 0` means black).

The grayscale intermediate never escapes `sampleImage`.

### State & params (`App.jsx`)

- Add `dither: false` to `DEFAULT_PARAMS`.
- Pass `dither` through to `sampleImage` in the `useMemo`.

### UI (`ParameterPanel.jsx`)

- Add a "Dither (Floyd–Steinberg)" checkbox, always visible (not gated on `mode`).
- Existing `threshold` slider continues to control the quantization boundary when dithering is active.

## Out of scope

- Exposing grayscale values outside `sampleImage` (stays internal).
- Variable diffusion kernels (only standard 4-neighbor FS).
- Serpentine scanning.
