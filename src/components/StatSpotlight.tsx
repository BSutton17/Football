import type { SpotlightRole, StatSpotlightPayload } from '../types/game.ts'

// ── The stat spotlight ([spotlight]) ─────────────────────────────────────────
//
// The broadcast graphic that pops up after somebody makes a play: who he is and his line for the
// game. Which player, and whether to show one at all, is the server's call (statSpotlight.js); this
// only draws it. Where it sits and how long it stays live in App.tsx.

export interface SpotlightView {
  key: number
  payload: StatSpotlightPayload
  name: string
  teamAbbr: string | null
  color: string               // the team's primary: the bar and the position badge
  accent: string              // whichever team colour reads on dark glass, for coloured text
  place: 'top' | 'bottom'
  leaving: boolean            // fading out — the last beat of its three seconds
}

type Stat = { value: number | string; label: string }

// What a graphic prints for each kind of play. Leads with the numbers that made the play, and only
// shows a defensive extra (a sack, a pick) when there is one — "0 INT" on every tackle is noise.
export function statsFor(role: SpotlightRole, l: StatSpotlightPayload['line']): Stat[] {
  switch (role) {
    case 'passer': {
      const out: Stat[] = [
        { value: `${l.completions}/${l.attempts}`, label: 'CMP' },
        { value: l.passYards, label: 'YDS' },
        { value: l.passTD, label: 'TD' },
      ]
      if (l.interceptionsThrown) out.push({ value: l.interceptionsThrown, label: 'INT' })
      return out
    }
    case 'rusher': {
      const out: Stat[] = [
        { value: l.carries, label: 'CAR' },
        { value: l.rushYards, label: 'YDS' },
      ]
      if (l.carries > 0) out.push({ value: (l.rushYards / l.carries).toFixed(1), label: 'AVG' })
      if (l.rushTD) out.push({ value: l.rushTD, label: 'TD' })
      return out
    }
    case 'receiver': {
      const out: Stat[] = [
        { value: l.receptions, label: 'REC' },
        { value: l.recYards, label: 'YDS' },
      ]
      if (l.recTD) out.push({ value: l.recTD, label: 'TD' })
      return out
    }
    case 'sacker':
    case 'tackler': {
      const out: Stat[] = []
      if (role === 'sacker' || l.sacks) out.push({ value: l.sacks, label: l.sacks === 1 ? 'SACK' : 'SACKS' })
      // A sack is not a tackle in the box score, so a sacker's first big play would read "0 TKL".
      if (role !== 'sacker' || l.tackles) out.push({ value: l.tackles, label: 'TKL' })
      if (l.interceptions) out.push({ value: l.interceptions, label: 'INT' })
      return out
    }
  }
}

export default function StatSpotlight({ view }: { view: SpotlightView }) {
  const { payload, name, teamAbbr, color, accent, place, leaving } = view
  const stats = statsFor(payload.role, payload.line)
  return (
    <div
      className={`stat-spotlight stat-spotlight--${place}${leaving ? ' stat-spotlight--leaving' : ''}`}
      style={{ ['--team' as string]: color, ['--team-text' as string]: accent }}
      role="status"
      aria-live="polite"
    >
      <div className="stat-spotlight-head">
        <span className="stat-spotlight-pos">{payload.label || '—'}</span>
        <span className="stat-spotlight-name">{name}</span>
        {teamAbbr && <span className="stat-spotlight-team">{teamAbbr}</span>}
      </div>
      <div className="stat-spotlight-line">
        <span className="stat-spotlight-today">TODAY</span>
        {stats.map(s => (
          <span key={s.label} className="stat-spotlight-stat">
            <b>{s.value}</b>{s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Relative luminance, for choosing the team colour that can be read against the dark glass. A
// burgundy or navy primary vanishes there; most teams' secondary is the bright one.
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

export function readableAccent(primary: string, secondary?: string | null): string {
  const best = secondary && luminance(secondary) > luminance(primary) ? secondary : primary
  return luminance(best) < 0.12 ? '#f8fafc' : best    // both dark: plain white beats an invisible colour
}
