import type { DevReveal } from '../types/game.ts'

// [dev reveal] What the computer called this play, drawn over the field.
//
// ⚠️ DEV BUILDS ONLY, AND THE SERVER MUST OPT IN TOO. The server attaches `devReveal` only outside
// production, only with ENABLE_DEV_REVEAL=1, and only in a solo room; this component additionally
// renders nothing unless `import.meta.env.DEV`, so the whole path is dead in a shipped build and
// the "defense never sees the play call" rule is untouched.
//
// It exists for one job: screenshot what the AI lined up in, next to what it should have been.
// So it favours being READABLE over being pretty — every man labelled with his job and his target,
// the call named at the top, nothing hidden behind a hover.

interface Props {
  reveal: DevReveal
  /** Field yards → screen percent, so the overlay sits on the real field. */
  project: (x: number, y: number) => { left: number; top: number }
}

const JOB_COLOR: Record<string, string> = {
  man: '#a78bfa',
  zone: '#38bdf8',
  rush: '#f87171',
  spy: '#94a3b8',
}

export default function DevPlayReveal({ reveal, project }: Props) {
  if (!import.meta.env.DEV) return null

  const side = reveal.aiRole === 'offense' ? reveal.play : reveal.shell
  if (!side) return null

  return (
    <div className="dev-reveal" aria-hidden="true">
      <div className="dev-reveal-head">
        <span className="dev-reveal-tag">AI {reveal.aiRole}</span>
        <span className="dev-reveal-name">{side.name ?? '(unnamed)'}</span>
        {reveal.play?.playType && <span className="dev-reveal-kind">{reveal.play.playType}</span>}
      </div>

      {reveal.aiRole === 'offense' && reveal.play?.players.map(p => {
        const at = project(p.x, p.y)
        return (
          <div key={p.id} className="dev-reveal-pin" style={{ left: `${at.left}%`, top: `${at.top}%` }}>
            <span className="dev-reveal-chip" style={{ background: p.blocking ? '#64748b' : '#fbbf24' }}>
              {p.label}{p.blocking ? ' BLK' : p.route?.length ? ` ${Math.round(Math.max(...p.route.map(r => r.dd)))}y` : ''}
            </span>
          </div>
        )
      })}

      {reveal.aiRole === 'defense' && reveal.shell?.players.map(p => {
        const at = project(p.x, p.y)
        // The one thing worth reading at a glance: what is he doing, and to whom.
        const kind = p.job ?? 'rush'
        const job = kind === 'man' ? `M:${p.covers ?? '?'}` : kind === 'zone' ? `Z:${p.zone ?? '?'}` : kind.toUpperCase()
        return (
          <div key={p.id} className="dev-reveal-pin" style={{ left: `${at.left}%`, top: `${at.top}%` }}>
            <span className="dev-reveal-chip" style={{ background: JOB_COLOR[kind] ?? '#94a3b8' }}>
              {p.label} {job}{p.shade ? ` ${p.shade}` : ''}
            </span>
          </div>
        )
      })}

      {/* Zone landmarks, so a shell's shape is visible and not inferred from where bodies happen to
          be standing before the snap. */}
      {reveal.aiRole === 'defense' && reveal.shell?.players
        .filter(p => p.job === 'zone' && p.zoneCenterX != null && p.zoneCenterY != null)
        .map(p => {
          const at = project(p.zoneCenterX as number, p.zoneCenterY as number)
          return (
            <div
              key={`z${p.id}`}
              className="dev-reveal-zone"
              style={{ left: `${at.left}%`, top: `${at.top}%` }}
            />
          )
        })}
    </div>
  )
}
