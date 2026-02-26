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
