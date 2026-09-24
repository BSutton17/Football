import { useEffect, useRef, useState } from 'react'
import type { RosterPlayer } from '../types/player.ts'

interface DragState {
  playerId: string
  position: string
  x: number
  y: number
}

interface Props {
  players: RosterPlayer[]
  team: 'o' | 'd'
  side: 'left' | 'right'
  onDrop: (playerId: string, clientX: number, clientY: number) => void
  fieldCount: number
  limitReached: boolean
  fatigueOn: boolean
  onToggleFatigue: () => void
  // [names toggle] Defense-only: switch the field labels between player names and positions. Omit to
  // hide the button (offense).
  namesOn?: boolean
  onToggleNames?: () => void
}

function shortName(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts[parts.length - 1]}`
}

// A phone held sideways — the same query the landscape layout block at the end of index.css uses.
// Keep the two in step: this decides when the roster is pinned open, that one sizes it.
const MOBILE_LANDSCAPE = '(orientation: landscape) and (max-height: 500px)'
const PORTRAIT         = '(orientation: portrait)'

// Live media-query match. Rotating the phone has to re-evaluate it, which a one-shot read at mount
// never does — that is exactly how a roster collapsed in portrait stayed collapsed in landscape.
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches)   // re-sync in case it changed between render and subscribe
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export default function RosterSidebar({ players, team, side, onDrop, fieldCount, limitReached, fatigueOn, onToggleFatigue, namesOn, onToggleNames }: Props) {
  const [userOpen, setUserOpen] = useState(true)

  const isMobileLandscape = useMediaQuery(MOBILE_LANDSCAPE)
  const isPortrait        = useMediaQuery(PORTRAIT)

  // In mobile landscape the roster is ALWAYS on screen: there is room for it beside the field, and a
  // collapse made in portrait must not follow the player into landscape — it used to, leaving the
  // inventory hidden behind a tab that is easy to miss on a 390px-tall screen.
  const open = isMobileLandscape || userOpen

  const sidebarRef = useRef<HTMLDivElement>(null)
  const dragRef    = useRef<DragState | null>(null)
  const onDropRef  = useRef(onDrop)
  onDropRef.current = onDrop   // sync update — no useEffect delay

  const [ghost, setGhost] = useState<DragState | null>(null)

  // [portrait drag-through] In portrait the sidebar sits ON TOP of the field, so a drop aimed at the
  // ground underneath it used to be swallowed as a cancel. While a drag is in flight the panel fades
  // right down and stops counting as a surface — the drop lands on the field beneath it instead.
  // (handleDrop clamps to legal bounds, and a mis-placed player is removed with the ✕ Remove button,
  // so nothing is lost by giving up the drop-on-the-roster cancel here.)
  const dragThrough    = isPortrait && !!ghost
  const dragThroughRef = useRef(false)
  dragThroughRef.current = isPortrait

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragRef.current) return
      const next = { ...dragRef.current, x: e.clientX, y: e.clientY }
      dragRef.current = next
      setGhost(next)
    }

    function onUp(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      const sb = sidebarRef.current
      if (sb) {
        const rect    = sb.getBoundingClientRect()
        const outside =
          e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top  || e.clientY > rect.bottom
        if (outside || dragThroughRef.current) onDropRef.current(d.playerId, e.clientX, e.clientY)
      }
      dragRef.current = null
      setGhost(null)
    }

    function onCancel() { dragRef.current = null; setGhost(null) }

    document.addEventListener('pointermove',   onMove)
    document.addEventListener('pointerup',     onUp)
    document.addEventListener('pointercancel', onCancel)
    return () => {
      document.removeEventListener('pointermove',   onMove)
      document.removeEventListener('pointerup',     onUp)
      document.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  const accent = team === 'o' ? '#1e88e5' : '#e53935'
  const isLeft = side === 'left'

  // Arrow direction: point inward to close, outward to open
  const arrow = isLeft ? (open ? '‹' : '›') : (open ? '›' : '‹')

  return (
    <>
      <div
        ref={sidebarRef}
        className={`roster-sidebar roster-sidebar--${side}${open ? '' : ' roster-sidebar--closed'}${dragThrough ? ' roster-sidebar--drag-through' : ''}`}
      >
        {/* Tab button that hangs off the inner edge. Dropped in mobile landscape, where the roster is
            pinned open and the tab would only be a control that does nothing. */}
        {!isMobileLandscape && (
          <button
            className={`roster-toggle roster-toggle--${side}`}
            onClick={() => setUserOpen(o => !o)}
            aria-label={open ? 'Hide roster' : 'Show roster'}
          >
            {arrow}
          </button>
        )}

        <div className="roster-list">
          <div className={`roster-count${limitReached ? ' roster-count--full' : ''}`}>
            {fieldCount}/11
          </div>
          {players.map(p => (
            <div
              key={p.id}
              className={`roster-card${ghost?.playerId === p.id ? ' roster-card--dragging' : ''}${limitReached ? ' roster-card--disabled' : ''}`}
              onPointerDown={limitReached ? undefined : e => {
                e.preventDefault()
                const d: DragState = {
                  playerId: p.id,
                  position: p.position,
                  x: e.clientX,
                  y: e.clientY,
                }
                dragRef.current = d
                setGhost(d)
              }}
            >
              <div className="roster-pos" style={{ background: accent }}>
                {p.position}
              </div>
              <div className="roster-name">{shortName(p.name)}</div>
              {p.ovr != null && <div className="roster-ovr">{p.ovr} OVR</div>}
            </div>
          ))}

          {players.length === 0 && (
            <p className="roster-empty">All on field</p>
          )}
        </div>

        {/* Fatigue toggle — shows a stamina bar under every non-lineman/QB on the field. */}
        <button
          className={`roster-fatigue-btn${fatigueOn ? ' roster-fatigue-btn--on' : ''}`}
          onClick={onToggleFatigue}
          aria-pressed={fatigueOn}
        >
          Fatigue
        </button>

        {/* [names toggle] Defense-only: flip the field labels between player names and positions. */}
        {onToggleNames && (
          <button
            className={`roster-names-btn${namesOn ? ' roster-names-btn--on' : ''}`}
            onClick={onToggleNames}
            aria-pressed={!!namesOn}
          >
            {namesOn ? 'Names' : 'Positions'}
          </button>
        )}
      </div>

      {ghost && (
        <div
          className="roster-ghost"
          style={{ left: ghost.x, top: ghost.y, background: accent }}
          aria-hidden
        >
          {ghost.position}
        </div>
      )}
    </>
  )
}
