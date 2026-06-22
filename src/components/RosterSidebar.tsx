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
}

function shortName(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts[parts.length - 1]}`
}

export default function RosterSidebar({ players, team, side, onDrop, fieldCount, limitReached, fatigueOn, onToggleFatigue }: Props) {
  const [open, setOpen] = useState(true)

  const sidebarRef = useRef<HTMLDivElement>(null)
  const dragRef    = useRef<DragState | null>(null)
  const onDropRef  = useRef(onDrop)
  onDropRef.current = onDrop   // sync update — no useEffect delay

  const [ghost, setGhost] = useState<DragState | null>(null)

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
        if (outside) onDropRef.current(d.playerId, e.clientX, e.clientY)
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
        className={`roster-sidebar roster-sidebar--${side}${open ? '' : ' roster-sidebar--closed'}`}
      >
        {/* Tab button that hangs off the inner edge — always visible */}
        <button
          className={`roster-toggle roster-toggle--${side}`}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Hide roster' : 'Show roster'}
        >
          {arrow}
        </button>

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
