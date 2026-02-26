import { describe, it, expect } from 'vitest'
import { parseDpi } from './imageMeta'

describe('parseDpi', () => {
  it('returns 96 as fallback when no DPI metadata', async () => {
    const dpi = await parseDpi(new Blob([], { type: 'image/png' }))
    expect(dpi).toBe(96)
  })
})
