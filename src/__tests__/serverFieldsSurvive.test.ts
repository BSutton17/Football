import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⚠️ THE OBJECT THE UI READS IS NOT THE ONE THE SERVER SENT.
//
// App.tsx REBUILDS `gameState` from a fixed list of fields, because most of it is derived locally —
// role, phase, the clock, the formation. Anything the server sends that is not named in that list
// is silently dropped, and the symptom is a feature that simply never appears with nothing in the
// console to say why.
//
// That is exactly what happened to the chew clock: the server returned `canChew: true` on every
// pre-snap, the HUD read `gameState.canChew`, and the field was thrown away in between. It was
// reported twice — once as "the button doesn't appear", once as "it still doesn't appear" — before
// anyone thought to look at the reconstruction rather than at the tap handler.
//
// This is a source check rather than a render test on purpose: the failure is one of plumbing, and
// the plumbing is a single line.

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = readFileSync(join(HERE, '..', 'App.tsx'), 'utf8')
const HUD = readFileSync(join(HERE, '..', 'components', 'GameHUD.tsx'), 'utf8')

const reconstruction = () => {
  const m = APP.match(/const gameState: GameState = \{([\s\S]*?)\n/)
  return m ? m[1] : ''
}

describe('⚠️ SERVER-ONLY FIELDS SURVIVE THE REBUILD', () => {
  it('the reconstruction exists and spreads the server-only bag', () => {
    const line = reconstruction()
    expect(line).toBeTruthy()
    expect(line).toContain('...serverOnly')
  })

  it('every server-only field the HUD reads is carried', () => {
    // Whatever GameHUD reads off gameState must either be rebuilt explicitly or come through
    // `serverOnly`. A field it reads that appears in neither is a dropped field.
    const read = [...HUD.matchAll(/gameState[?]?\.(\w+)/g)].map(m => m[1])
    const line = reconstruction()
    const bag = APP.match(/useState<Pick<GameState,([^>]*)>>/)?.[1] ?? ''
    const missing = [...new Set(read)].filter(f => !line.includes(f) && !bag.includes(`'${f}'`))
    expect(missing).toEqual([])
  })

  it('the chew fields specifically, because these are the ones that went missing', () => {
    const bag = APP.match(/useState<Pick<GameState,([^>]*)>>/)?.[1] ?? ''
    expect(bag).toContain('canChew')
    expect(bag).toContain('chewMinPlayClock')
  })

  it('…and the handler actually fills the bag from the payload', () => {
    expect(APP).toMatch(/setServerOnly\(\{[\s\S]*?canChew: gs\.canChew/)
  })
})
