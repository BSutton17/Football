import { describe, it, expect } from 'vitest'
import { colorAfterChange, routeColorHex, ROUTE_COLOR_HEX } from '../game/routeColors'
import { fillSlots, assignmentsFor } from '../game/loadPlay'
import type { RosterPlayer } from '../types/player'

// [route colours] "If a rb has a blue route and receives a new route it should stay blue; however if
// a wr, te or rb have a red route, it should turn yellow when changed."
describe('a route changes', () => {
  it('blue stays blue', () => expect(colorAfterChange('blue')).toBe('blue'))
  it('red goes back to the normal yellow', () => expect(colorAfterChange('red')).toBeNull())
  it('no colour stays no colour', () => expect(colorAfterChange(undefined)).toBeNull())
})

describe('a loaded play carries its markings onto whoever fills the slot', () => {
  const p = (id: string, position: string, ovr: number) => ({ id, name: id, position, ovr, ratings: {} } as RosterPlayer)
  it('red on the receiver, blue on the back, nothing on a blocker', () => {
    const spots = [
      { label: 'WR', x: 5, y: 30, route: [{ dx: 0, dd: 10 }], blocking: false, color: 'red' as const },
      { label: 'RB', x: 26, y: 24, route: [{ dx: 4, dd: 3 }], blocking: false, color: 'blue' as const },
      { label: 'TE', x: 20, y: 29, route: null, blocking: true, color: null },
    ]
    const { filled } = fillSlots(spots, [p('wr1', 'WR', 90), p('rb1', 'RB', 85), p('te1', 'TE', 80)])
    const { colors } = assignmentsFor(filled)
    expect(colors).toEqual({ wr1: 'red', rb1: 'blue' })
    expect(routeColorHex(colors)).toEqual({ wr1: ROUTE_COLOR_HEX.red, rb1: ROUTE_COLOR_HEX.blue })
  })
})
