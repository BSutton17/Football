import type { OfferedPlay, OfferedShell } from '../types/playbook.ts'

// [authored] The coordinator's shortlist, full screen.
//
// ⚠️ FULL SCREEN ON PURPOSE. Everything else pre-snap is a rail or a sidebar crowding the field,
// and the one complaint about this UI is that buttons end up underneath each other. A panel that
// owns the whole screen cannot be covered by anything, needs no room reserved for it, and has the
// space to say what each call actually does — which is the part that makes it worth opening.
//
// ⚠️ IT IS NEVER THE DEFAULT. It opens because a button was pressed and closes to exactly the
// formation that was there before. A player who never touches it plays the game they already knew.

interface PlaysProps {
  kind: 'plays'
  situation: string
  items: OfferedPlay[]
  onPick: (play: OfferedPlay) => void
  onClose: () => void
}

interface ShellsProps {
  kind: 'shells'
  situation: string
  items: OfferedShell[]
  onPick: (shell: OfferedShell) => void
  onClose: () => void
}

type Props = PlaysProps | ShellsProps

// The badge colour carries the one thing a defender most needs at a glance: whether this call
// brings pressure. Kept to three so it reads instantly rather than being decoded.
const KIND_CLASS: Record<string, string> = {
  zone: 'pick-kind--zone',
  man: 'pick-kind--man',
  blitz: 'pick-kind--blitz',
}

export default function PlayPicker(props: Props) {
  const { kind, situation, onClose } = props
  const title = kind === 'plays' ? 'PLAYS' : 'SHELLS'

  return (
    <div className="play-picker" role="dialog" aria-modal="true" aria-label={title}>
      <div className="play-picker-bar">
        <div className="play-picker-titles">
          <span className="play-picker-title">{title}</span>
          <span className="play-picker-situation">{situation}</span>
        </div>
        <button className="play-picker-close" onPointerDown={onClose} aria-label="Close">✕</button>
      </div>

      <div className="play-picker-list">
        {props.items.length === 0 && (
          <div className="play-picker-empty">
            Nothing to recommend here — close this and set up by hand.
          </div>
        )}

        {props.kind === 'plays' && props.items.map((p, i) => (
          <button key={p.id} className="play-card" onPointerDown={() => props.onPick(p)}>
            <div className="play-card-rank">{i + 1}</div>
            <div className="play-card-body">
              <div className="play-card-name">{p.name}</div>
              <div className="play-card-formation">{p.formationName}</div>
              <div className="play-card-why">{p.why}</div>
            </div>
            <div className="play-card-depth">
              <span className="play-card-depth-num">{Math.round(p.depth)}</span>
              <span className="play-card-depth-unit">yds</span>
            </div>
          </button>
        ))}

        {props.kind === 'shells' && props.items.map((s, i) => (
          <button key={s.id} className="play-card" onPointerDown={() => props.onPick(s)}>
            <div className="play-card-rank">{i + 1}</div>
            <div className="play-card-body">
              <div className="play-card-name">{s.name}</div>
              <div className="play-card-formation">{s.formationName}</div>
              <div className="play-card-why">{s.why}</div>
            </div>
            <div className={`play-card-kind ${KIND_CLASS[s.kind] ?? ''}`}>{s.kind}</div>
          </button>
        ))}
      </div>

      <div className="play-picker-foot">
        {kind === 'plays'
          ? 'Picking one lines it up and draws the routes. You can still change anything after.'
          : 'Picking one lines the defense up. You can still move anyone after.'}
      </div>
    </div>
  )
}
