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
