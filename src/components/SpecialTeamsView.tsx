import { useEffect, useRef, useState } from 'react'
import type { SpecialTeamsState } from '../types/game.ts'
import { sendSpecialTeamsInput } from '../socket/index.ts'

interface Props {
  st: SpecialTeamsState
}

// Mirror the server ([Special Teams] specialTeams.js) so the local display matches; the SERVER is
// authoritative for the actual kick ([14]).
const KICK_TIMER_SECONDS  = 3.5
const POWER_DRAIN_PER_SEC  = 1 / KICK_TIMER_SECONDS
const POWER_REFILL         = 0.02
const AIM_STEP             = 0.1
const AIM_MAX_DEGREES      = 30

// [Special Teams][6]-[14] The kicking interface. When THIS viewer is the kicker, a full-screen
// overlay: tap the left/right half (or arrow keys) to swing the aiming arrow and refill power. The
// kick fires when the server's 3.5s timer expires — at which point the meter FREEZES (angle + power)
// and a "KICKED" banner shows at the top for both players.
export default function SpecialTeamsView({ st }: Props) {
  const showKickUI = st.kicking && st.playerControlled   // the kicker's aiming overlay
  const live       = showKickUI && st.phase === 'setup'  // input + draining active (not yet kicked)
  const kicked     = st.phase === 'kicking' || st.phase === 'resolved'

  const [power, setPower] = useState(st.power)
  const [angle, setAngle] = useState(st.angle)
  const powerRef = useRef(st.power)
  const angleRef = useRef(st.angle)

  // Reconcile with the authoritative server values whenever they arrive (and freeze on them once kicked).
  useEffect(() => { powerRef.current = st.power; setPower(st.power) }, [st.power])
  useEffect(() => { angleRef.current = st.angle; setAngle(st.angle) }, [st.angle])

  // [9][10] Smoothly drain the local meter while the kick is LIVE. Once kicked, this stops and the
  // reconcile effects above pin the display to the server's final values.
  useEffect(() => {
    if (!live || !st.started) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now
      powerRef.current = Math.max(0, powerRef.current - POWER_DRAIN_PER_SEC * dt)
      setPower(powerRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, st.started])

  // [12] A directional input: optimistically swing + refill, then tell the server. No-op once kicked.
  const inputRef = useRef<(dir: 'left' | 'right') => void>(() => {})
  inputRef.current = (dir: 'left' | 'right') => {
    if (!live) return
    const d = dir === 'left' ? -1 : 1
    angleRef.current = Math.max(-1, Math.min(1, angleRef.current + d * AIM_STEP))
    powerRef.current = Math.min(1, powerRef.current + POWER_REFILL)
    setAngle(angleRef.current)
    setPower(powerRef.current)
    sendSpecialTeamsInput({ aim: dir })
  }

  // [12] Left / right arrow keys mirror the left / right screen halves (while live).
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); inputRef.current('left') }
      if (e.key === 'ArrowRight') { e.preventDefault(); inputRef.current('right') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  // "KICKED" banner — shown at the top for BOTH players the instant the kick is away.
  const banner = kicked ? <div className="kicked-banner">KICKED</div> : null

  if (showKickUI) {
    const pct = Math.round(power * 100)
    const deg = angle * AIM_MAX_DEGREES
    return (
      <>
        {banner}
        <div className="kick-overlay">
          {/* Tap halves only do anything while live; frozen after the kick. */}
          <button className="kick-half kick-half--left"  aria-label="Aim left"  onPointerDown={() => inputRef.current('left')} />
          <button className="kick-half kick-half--right" aria-label="Aim right" onPointerDown={() => inputRef.current('right')} />
          <div className="kick-center">
            <div className="kick-label">{st.label}</div>
            <div className="kick-arrow-wrap">
              {live && Math.abs(st.targetAngle) > 0.001 && (
                <div className="kick-target" style={{ transform: `rotate(${st.targetAngle * AIM_MAX_DEGREES}deg)` }} />
              )}
              <div className="kick-arrow" style={{ transform: `rotate(${deg}deg)` }}>
                <div className="kick-arrow__fill" style={{ height: `${pct}%` }} />
              </div>
            </div>
            {live && st.kickType === 'punt' && (
              <button
                className={`kick-backspin${st.backspin ? ' kick-backspin--on' : ''}`}
                onPointerDown={e => { e.stopPropagation(); sendSpecialTeamsInput({ backspin: !st.backspin }) }}
              >
                Backspin: {st.backspin ? 'On' : 'Off'}
              </button>
            )}
            <div className="kick-hint">{live ? 'Tap left / right to aim & power up' : 'Kick is away…'}</div>
          </div>
        </div>
      </>
    )
  }

  // Receiving team / kickoff — a small status panel (plus the shared KICKED banner).
  return (
    <>
      {banner}
      <div className="special-teams" role="region" aria-label="Special teams">
        <div className="special-teams__header">
          <span className="special-teams__kind">{st.label}</span>
          <span className="special-teams__role">{st.kicking ? 'Kicking' : 'Receiving'}</span>
        </div>
        <div className="special-teams__status">
          {kicked                    ? 'Kick is away…'
            : !st.playerControlled   ? 'Kickoff…'
            : `Opponent is kicking the ${st.label.toLowerCase()}…`}
        </div>
      </div>
    </>
  )
}
