import { describe, it, expect, vi } from 'vitest'
import { revealCoverage } from '../game/revealCoverage'
import type { DevReveal, DevRevealPlayer } from '../types/game'

// [dev reveal] Turning the computer's call into the renderer's own coverage props, so it is drawn
// with the real game art instead of a second set invented for the overlay.

const d = (over: Partial<DevRevealPlayer>): DevRevealPlayer =>
  ({ id: 'x', label: 'CB', x: 10, y: 40, ...over })

const shell = (players: DevRevealPlayer[]): DevReveal =>
  ({ aiRole: 'defense', play: null, shell: { name: 'COVER 2', players } })

describe('mapping the computer’s call onto the real coverage art', () => {
  it('a man defender becomes a manTargets entry, which is what draws the line', () => {
    const c = revealCoverage(shell([d({ id: 'cb1', job: 'man', covers: 'wr1' })]))!
    expect(c.manTargets).toEqual({ cb1: 'wr1' })
  })

  it('a zone defender becomes a type AND a centre, which is what draws the cloud', () => {
    const c = revealCoverage(shell([
      d({ id: 's1', job: 'zone', zone: 'deep', zoneCenterX: 26, zoneCenterY: 62 }),
    ]))!
    expect(c.zoneTypes).toEqual({ s1: 'deep' })
    expect(c.zoneCenters).toEqual({ s1: { x: 26, y: 62 } })
  })

  it('⚠️ A ZONE WITH NO LANDMARK IS DROPPED, not drawn at the origin', () => {
    // The renderer needs a centre to place the shape. Forwarding a null as 0 would paint a cloud in
    // the corner of the end zone and read as a real call.
    const c = revealCoverage(shell([
      d({ id: 's1', job: 'zone', zone: 'deep', zoneCenterX: null, zoneCenterY: null }),
    ]))!
    expect(c.zoneTypes).toEqual({})
    expect(c.zoneCenters).toEqual({})
  })

  it('a spy is a spy', () => {
    const c = revealCoverage(shell([d({ id: 'lb1', job: 'spy' })]))!
    expect(c.spyIds).toEqual(['lb1'])
  })

  it('⚠️ THE FOUR LINEMEN ARE NOT BLITZERS', () => {
    // Every defender the server has no assignment for reads as 'rush', and that includes the
    // auto-placed front. Calling those a blitz would paint blitz art across the base front on every
    // snap, which tells you nothing — a blitz is an EXTRA rusher.
    const c = revealCoverage(shell([
      d({ id: 'auto_dl0', job: 'rush' }), d({ id: 'auto_dl1', job: 'rush' }),
      d({ id: 'auto_dl2', job: 'rush' }), d({ id: 'auto_dl3', job: 'rush' }),
      d({ id: 'lb2', job: 'rush' }),
    ]))!
    expect(c.blitzIds).toEqual(['lb2'])
  })

  it('a whole shell maps to every prop at once', () => {
    const c = revealCoverage(shell([
      d({ id: 'cb1', job: 'man', covers: 'wr1' }),
      d({ id: 'cb2', job: 'man', covers: 'wr2' }),
      d({ id: 's1', job: 'zone', zone: 'deep', zoneCenterX: 26, zoneCenterY: 62 }),
      d({ id: 'lb1', job: 'zone', zone: 'hook', zoneCenterX: 20, zoneCenterY: 48 }),
      d({ id: 'lb2', job: 'rush' }),
      d({ id: 'lb3', job: 'spy' }),
      d({ id: 'auto_dl0', job: 'rush' }),
    ]))!
    expect(Object.keys(c.manTargets)).toHaveLength(2)
    expect(Object.keys(c.zoneTypes)).toHaveLength(2)
    expect(Object.keys(c.zoneCenters)).toHaveLength(2)
    expect(c.blitzIds).toEqual(['lb2'])
    expect(c.spyIds).toEqual(['lb3'])
  })

  it('⚠️ A ZONE THE RENDERER CANNOT DRAW IS DROPPED AND WARNED ABOUT', () => {
    // drawZones looks the name up in ZONE_CONFIGS and silently skips a miss, so forwarding an
    // unknown name would make the overlay draw nothing with no clue why. The authored shells use
    // deep / flat / curl / hook; a rename on the server side has to be loud.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = revealCoverage(shell([
      d({ id: 's1', job: 'zone', zone: 'deep_third', zoneCenterX: 26, zoneCenterY: 62 }),
    ]))!
    expect(c.zoneTypes).toEqual({})
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('every zone name the authored shells use is one the renderer knows', () => {
    // The four the playbook actually carries, checked against the renderer's own table.
    for (const zone of ['deep', 'flat', 'curl', 'hook']) {
      const c = revealCoverage(shell([d({ id: 'z', job: 'zone', zone, zoneCenterX: 26, zoneCenterY: 50 })]))!
      expect(c.zoneTypes).toEqual({ z: zone })
    }
  })

  it('a man defender with nobody to cover is not a man entry', () => {
    const c = revealCoverage(shell([d({ id: 'cb1', job: 'man', covers: null })]))!
    expect(c.manTargets).toEqual({})
  })
})

describe('when there is nothing to show', () => {
  it('no reveal at all', () => {
    expect(revealCoverage(null)).toBeNull()
  })

  it('⚠️ NOTHING WHEN THE COMPUTER HAS THE BALL — there is no coverage to draw', () => {
    const onOffense: DevReveal = {
      aiRole: 'offense',
      play: { playType: 'pass', runAngle: null, name: 'Gun Trips Flood', players: [] },
      shell: null,
    }
    expect(revealCoverage(onOffense)).toBeNull()
  })

  it('a defensive reveal with no shell', () => {
    expect(revealCoverage({ aiRole: 'defense', play: null, shell: null })).toBeNull()
  })

  it('an empty shell maps to empty props rather than throwing', () => {
    const c = revealCoverage(shell([]))!
    expect(c).toEqual({ manTargets: {}, zoneTypes: {}, zoneCenters: {}, blitzIds: [], spyIds: [] })
  })
})
