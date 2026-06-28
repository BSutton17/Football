import { useEffect, useRef, useState } from 'react'
import type { SpecialTeamsState } from '../types/game.ts'
import { sendSpecialTeamsInput, sendFieldGoalBlock } from '../socket/index.ts'

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

// [47] FG block indicator sweep: one end→other-end pass in this many seconds (full back-and-forth =
// double). Fast enough to be challenging, constant enough to learn.
const BLOCK_SWEEP_HALF_SECONDS = 0.5
// [48] Zone boundaries (mirror server FG_BLOCK): green is the tiny center band, then yellow, then red.
const BLOCK_GREEN_HALF  = 0.015   // 3% total
const BLOCK_YELLOW_HALF = 0.315   // green+yellow span (yellow = 60% total)
// The colored track as a left→right gradient: red | yellow | green | yellow | red.
const BLOCK_TRACK_BG = `linear-gradient(to right,
  #ef4444 0% ${(0.5 - BLOCK_YELLOW_HALF) * 100}%,
  #facc15 ${(0.5 - BLOCK_YELLOW_HALF) * 100}% ${(0.5 - BLOCK_GREEN_HALF) * 100}%,
  #22c55e ${(0.5 - BLOCK_GREEN_HALF) * 100}% ${(0.5 + BLOCK_GREEN_HALF) * 100}%,
  #facc15 ${(0.5 + BLOCK_GREEN_HALF) * 100}% ${(0.5 + BLOCK_YELLOW_HALF) * 100}%,
  #ef4444 ${(0.5 + BLOCK_YELLOW_HALF) * 100}% 100%)`

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

  // [46][47] Defensive FG/XP block bar. The defender (not the kicker) gets a white indicator that
  // sweeps back and forth — but only ONCE the kicker's timer has started ([46]). They tap to commit.
  const isFGKick   = st.kickType === 'field_goal' || st.kickType === 'extra_point'
  const isDefender = !st.kicking
  const [tapped, setTapped] = useState(false)
  useEffect(() => { if (!st.started) setTapped(false) }, [st.started])   // reset for a fresh attempt
  const blockLive = isFGKick && isDefender && st.phase === 'setup' && st.started && !st.blockAttempted && !tapped

  const [blockPos, setBlockPos] = useState(0)
  const blockPosRef = useRef(0)
  useEffect(() => {
    if (!blockLive) return   // idle before the kicker starts; frozen once tapped/kicked
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const e     = (now - start) / 1000
      const phase = (e / BLOCK_SWEEP_HALF_SECONDS) % 2   // 0..2 triangle
      const pos   = phase <= 1 ? phase : 2 - phase        // 0 → 1 → 0 …
      blockPosRef.current = pos
      setBlockPos(pos)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [blockLive])

  const attemptBlock = () => {
    if (!blockLive) return
    setTapped(true)                       // freeze the marker locally; the server confirms via blockAttempted
    sendFieldGoalBlock(blockPosRef.current)
  }

  // "KICKED" banner — shown at the top for BOTH players the instant the kick is away. On a punt it
  // also reports how far the kick travelled, once the server has determined it.
  const banner = kicked
    ? <div className="kicked-banner">KICKED{typeof st.kickDistance === 'number' ? ` · ${st.kickDistance} YDS` : ''}</div>
    : null

  if (isFGKick && isDefender) {
    const attempted = st.blockAttempted || tapped
    return (
      <>
        {banner}
        <div className="fg-block" role="region" aria-label="Field goal block">
          <div className="fg-block__title">
            {attempted        ? 'Block away…'
              : kicked         ? 'Kick is away…'
              : st.started     ? 'Tap to block!'
              :                  'Get ready to block…'}
          </div>
          <button
            className="fg-block__bar"
            style={{ background: BLOCK_TRACK_BG }}
            onPointerDown={attemptBlock}
            disabled={!blockLive}
            aria-label="Attempt block"
          >
            <div className="fg-block__marker" style={{ left: `${blockPos * 100}%`, opacity: blockLive ? 1 : 0.4 }} />
          </button>
          <div className="fg-block__hint">Hit the green center to block</div>
        </div>
      </>
    )
  }

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
              {/* [54] The FG aim guide line was removed as distracting — the kicker aims at the
                  on-field goalposts ([40]) instead. */}
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

  // [27] Punt-in-flight preview for the receiving team: projected (air) landing spot + hang time.
  // The final bounce distance is intentionally not shown.
  const preview = (st.kickType === 'punt' && kicked && st.result && typeof st.result === 'object')
    ? (st.result as { landingYardLine?: number; hangTime?: number; touchback?: boolean; outOfBounds?: boolean })
    : null

  // Receiving team / kickoff — a small status panel (plus the shared KICKED banner).
  return (
    <>
      {banner}
      <div className="special-teams" role="region" aria-label="Special teams">
        <div className="special-teams__header">
          <span className="special-teams__kind">{st.label}</span>
          <span className="special-teams__role">{st.kicking ? 'Kicking' : 'Receiving'}</span>
        </div>
        {preview ? (
          <div className="special-teams__preview">
            {preview.touchback   ? <div className="special-teams__status">Headed for the end zone — touchback</div>
            : preview.outOfBounds ? <div className="special-teams__status">Sailing out of bounds</div>
            : (
              <>
                <div className="special-teams__status">Punt incoming — landing ~ the {Math.round(preview.landingYardLine ?? 0)}</div>
                <div className="special-teams__hang">Hang time {(preview.hangTime ?? 0).toFixed(1)}s</div>
              </>
            )}
          </div>
        ) : (
          <div className="special-teams__status">
            {kicked                    ? 'Kick is away…'
              : !st.playerControlled   ? 'Kickoff…'
              : `Opponent is kicking the ${st.label.toLowerCase()}…`}
          </div>
        )}
      </div>
    </>
  )
}
