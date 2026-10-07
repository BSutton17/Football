import { describe, it, expect } from 'vitest'
import { statsFor } from '../components/StatSpotlight'

// [spotlight] What the graphic prints for each kind of play.
const line = {
  attempts: 22, completions: 14, passYards: 187, passTD: 2, interceptionsThrown: 0,
  carries: 9, rushYards: 64, rushTD: 1,
  receptions: 5, recYards: 92, recTD: 0,
  tackles: 6, sacks: 1, interceptions: 0,
}
const text = (role: Parameters<typeof statsFor>[0], l = line) => statsFor(role, l).map(s => `${s.value} ${s.label}`).join(' · ')

describe('the spotlight line', () => {
  it('prints the numbers that fit the play', () => {
    expect(text('passer')).toBe('14/22 CMP · 187 YDS · 2 TD')
    expect(text('rusher')).toBe('9 CAR · 64 YDS · 7.1 AVG · 1 TD')
    expect(text('receiver')).toBe('5 REC · 92 YDS')
    expect(text('tackler')).toBe('1 SACK · 6 TKL')
    expect(text('sacker', { ...line, sacks: 2 })).toBe('2 SACKS · 6 TKL')
    expect(text('sacker', { ...line, sacks: 1, tackles: 0 })).toBe('1 SACK')   // no "0 TKL" after a sack
  })

  it('leaves zero extras off a defender, but a sacker always shows his sacks', () => {
    expect(text('tackler', { ...line, sacks: 0 })).toBe('6 TKL')
    expect(text('passer', { ...line, interceptionsThrown: 1 })).toContain('1 INT')
  })
})
