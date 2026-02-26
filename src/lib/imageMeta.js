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
