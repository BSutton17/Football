import { describe, it, expect } from 'vitest'
import { downAndDistance } from '../game/downDistance'

// Reported: the shortlist header read "2nd & 6.793738438".
describe('down and distance', () => {
  it('truncates the distance', () => expect(downAndDistance(2, 6.793738438, 40)).toBe('2nd & 6'))
  it('under a yard is inches', () => expect(downAndDistance(3, 0.4, 40)).toBe('3rd & inches'))
  it('goal to go says Goal', () => expect(downAndDistance(1, 4, 96)).toBe('1st & Goal'))
  it('every down has its suffix', () => expect([1, 2, 3, 4].map(d => downAndDistance(d, 10, 20))).toEqual(['1st & 10', '2nd & 10', '3rd & 10', '4th & 10']))
})
