import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ⚠️ EVERY HOOK ABOVE THE FIRST EARLY RETURN.
//
// App returns early for the lobby, team select and the VS screen. A hook placed after one of those
// returns runs on some renders and not others, so React counts a different number of hooks before
// and after the room goes ready and throws error #310 — which took single player down at kickoff
// the first time it shipped.
//
// Nothing else catches this. It type-checks, it builds, the tests pass, and it only fails at the
// moment the room becomes ready — which no unit test here reaches, because none of them mount App.
// So the check is on the source text: crude, and it would have saved a broken deploy.

const SOURCE = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8').split(/\r?\n/)

// A hook call at component-body indentation (two spaces). Deeper indentation is inside a callback
// or a nested function, where the rule does not apply.
const HOOK = /^ {2}(const .*= )?use(State|Effect|Ref|Memo|Callback|LayoutEffect|Reducer|Context)\b/
// Likewise an early return at body level: `if (…) return …` or a bare `return (`.
const EARLY_RETURN = /^ {2}(if \(.*\) return|return \()/

describe('App.tsx hook order', () => {
  it('declares every hook before the first early return', () => {
    const firstReturn = SOURCE.findIndex(l => EARLY_RETURN.test(l))
    expect(firstReturn).toBeGreaterThan(0)

    const strays = SOURCE
      .map((line, i) => ({ line: line.trim().slice(0, 72), no: i + 1 }))
      .filter(({ no }) => no - 1 > firstReturn)
      .filter(({ no }) => HOOK.test(SOURCE[no - 1]))

    expect(strays).toEqual([])
  })

  it('the guard itself still matches the things it is looking for', () => {
    // A check that silently stops matching is worse than no check, so both patterns are pinned
    // against real lines rather than trusted.
    expect(SOURCE.some(l => HOOK.test(l))).toBe(true)
    expect(SOURCE.some(l => EARLY_RETURN.test(l))).toBe(true)
    expect(HOOK.test('  useEffect(() => {')).toBe(true)
    expect(HOOK.test('  const [a, b] = useState(1)')).toBe(true)
    expect(HOOK.test('    useEffect(() => {')).toBe(false)   // nested: not the component body
    expect(EARLY_RETURN.test("  if (room.status !== 'ready') return <Intro />")).toBe(true)
  })
})
