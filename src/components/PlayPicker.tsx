import type { OfferedPlay, OfferedShell } from '../types/playbook.ts'
import PlayDiagram from './PlayDiagram.tsx'

// [authored] The coordinator's shortlist, full screen.
//
// ⚠️ FULL SCREEN IS FOR THE PICTURES. A list of names asks the player to remember what "COVER 3
// BLITZ" looks like out of a 3-4; a drawing of it tells them, and drawings need room. That is the
// whole reason this panel takes the screen rather than living in a rail.
//
// ⚠️ AND IT NEVER SCROLLS. Three options laid out so that the third is below the fold is worse than
// two options, because nothing on screen says the third is there. The cards are a grid sized to the
// viewport — three rows in portrait, three columns in landscape — and every part of a card that can
// give way (the diagram) does, so the set always fits.
//
// ⚠️ IT IS ALSO NEVER OPENED FOR YOU. It appears because a button was pressed, and closes to exactly
// the formation that was there before.

interface PlaysProps {
  kind: 'plays'
  situation: string
  losY: number
  distance: number
  items: OfferedPlay[]
  onPick: (play: OfferedPlay) => void
  onClose: () => void
}

interface ShellsProps {
  kind: 'shells'
  situation: string
  losY: number
  distance: number
  items: OfferedShell[]
  onPick: (shell: OfferedShell) => void
  onClose: () => void
}

type Props = PlaysProps | ShellsProps

// The badge colour carries the one thing a defense most needs at a glance: whether this brings
// pressure. Three kinds only, so it reads instantly rather than being decoded.
const KIND_CLASS: Record<string, string> = {
  zone: 'pick-kind--zone',
  man: 'pick-kind--man',
  blitz: 'pick-kind--blitz',
}

export default function PlayPicker(props: Props) {
  const { kind, situation, losY, distance, onClose } = props
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

      <div className={`play-picker-grid play-picker-grid--${props.items.length || 1}`}>
        {props.items.length === 0 && (
          <div className="play-picker-empty">
            Nothing to recommend here — close this and set up by hand.
          </div>
        )}

        {props.kind === 'plays' && props.items.map(p => (
          <button key={p.id} className="play-card" onPointerDown={() => props.onPick(p)}>
            <div className="play-card-art">
              <PlayDiagram losY={losY} distance={distance} offense={p.layout.spots} />
            </div>
            <div className="play-card-text">
              <div className="play-card-name">{p.name}</div>
              <div className="play-card-formation">{p.formationName}</div>
              <div className="play-card-tag">{Math.round(p.depth)} yds</div>
              <div className="play-card-why">{p.why}</div>
            </div>
          </button>
        ))}

        {props.kind === 'shells' && props.items.map(s => (
          <button key={s.id} className="play-card" onPointerDown={() => props.onPick(s)}>
            <div className="play-card-art">
              <PlayDiagram losY={losY} distance={distance} defense={s.layout.spots} />
            </div>
            <div className="play-card-text">
              <div className="play-card-name">{s.name}</div>
              <div className="play-card-formation">{s.formationName}</div>
              <div className={`play-card-tag ${KIND_CLASS[s.kind] ?? ''}`}>{s.kind}</div>
              <div className="play-card-why">{s.why}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
