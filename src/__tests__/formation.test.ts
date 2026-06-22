import { describe, it, expect } from 'vitest'
import { validateOffensiveFormation, validateDefensiveFormation } from '../game/formation'

const YARD_LINE = 25

describe('validateOffensiveFormation', () => {
  it('returns no errors when fewer than 7 players placed', () => {
    const errors = validateOffensiveFormation([], 11, YARD_LINE)
    expect(errors).toHaveLength(0)
  })
})

describe('validateDefensiveFormation', () => {
  it('returns no errors when no players placed', () => {
    const errors = validateDefensiveFormation([], 11)
    expect(errors).toHaveLength(0)
  })
})
