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
