import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types/game.ts'
import { socket, chewClock } from '../socket/index.ts'
import { teamById } from '../data/nflTeams.ts'
import { accentColor } from '../data/teamColors.ts'
import { teamLogo } from '../data/teamLogos.ts'

interface Props {
  gameState: GameState | null
  ownTeamId?: string | null   // [71] this viewer's team — drives the score badge (logo + colored abbr)
  oppTeamId?: string | null
}

// [71] A team's scoreboard identity: logo, abbreviation, and a legible accent color. Falls back to a
// generic "You"/"Opp" label when no team id is available (e.g. mock state before selection).
function teamBadge(teamId: string | null | undefined, fallbackLabel: string) {
  const team = teamId ? teamById(teamId) : undefined
  return {
    label:  team?.abbr ?? fallbackLabel,
    logo:   teamId ? teamLogo(teamId) : null,
    accent: teamId ? accentColor(teamId) : '#e5e7eb',
  }
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DOWN_SUFFIX = ['', 'st', 'nd', 'rd', 'th'] as const

const PLAY_CLOCK_SECONDS = 25

// [chew clock] How close together two taps on the game clock have to be to count as a double-tap, and
// how long the button then stays offered. `onDoubleClick` is not used because it does not fire
// reliably on touch, and this HUD is played on a phone as often as not — pointer events cover both.
const DOUBLE_TAP_MS = 400
const CHEW_OFFER_MS = 6000

export default function GameHUD({ gameState, ownTeamId, oppTeamId }: Props) {
  const [playClock, setPlayClock] = useState(PLAY_CLOCK_SECONDS)

  // Reset at the start of each pre_snap to the server's starting value for this snap (40 on a drive
  // start so there's time to set the formation, 25 otherwise).
  useEffect(() => {
    if (gameState?.phase === 'pre_snap') setPlayClock(gameState.playClock ?? PLAY_CLOCK_SECONDS)
  }, [gameState?.phase, gameState?.playClock])

  // Server is authoritative — update display whenever a tick arrives.
  useEffect(() => {
    function onPlayClockUpdate({ playClock }: { playClock: number }) {
      setPlayClock(playClock)
    }
    // Freeze at the server's remaining value the moment the offense sets.
    function onOffenseSet({ playClockRemaining }: { playClockRemaining: number }) {
      setPlayClock(playClockRemaining)
    }
    socket.on('play_clock_update', onPlayClockUpdate)
    socket.on('offense_set', onOffenseSet)
    return () => {
      socket.off('play_clock_update', onPlayClockUpdate)
      socket.off('offense_set', onOffenseSet)
    }
  }, [])

  // [chew clock] The button is deliberately hidden behind a double-tap on the game clock. Burning the
  // play clock down to three seconds is a real commitment — it should not be one stray thumb away on
  // a HUD this small, and it is wanted on a minority of snaps.
  const [chewOffered, setChewOffered] = useState(false)
  const [chewing, setChewing] = useState(false)
  const [chewStopAt, setChewStopAt] = useState(3)
  const lastClockTap = useRef(0)

  // ⚠️ WHETHER A CHEW IS RUNNING IS TRACKED HERE, NOT READ OFF gameState. `game_state` arrives once
  // per play; the rest of pre-snap is clock ticks only, so a serialized `chewing` field would never
  // flip. The server's confirmation starts it and the play clock reaching the stop point ends it —
  // which is also exactly when the server disarms, because both are driven by the same clock.
  useEffect(() => {
    function onChewStarted({ stopAt }: { speed: number; stopAt: number }) {
      setChewStopAt(stopAt)
      setChewing(true)
    }
    socket.on('chew_clock_started', onChewStarted)
    return () => { socket.off('chew_clock_started', onChewStarted) }
  }, [])
  useEffect(() => { if (playClock <= chewStopAt) setChewing(false) }, [playClock, chewStopAt])

  // The server sends only the conditions that hold still for the whole pre-snap; the play-clock
  // threshold moves every tick, so it is applied here against the clock already on screen. The
  // handler re-checks everything, so being a moment out of date costs a refusal, not a wrong chew.
  const chewMin = gameState?.chewMinPlayClock ?? 8
  const canChew = !!gameState?.canChew && !chewing && playClock >= chewMin

  // Withdraw the offer on its own, and the moment it stops being available. Otherwise the button sits
  // there promising something the handler would refuse.
  useEffect(() => {
    if (!chewOffered) return
    if (!canChew) { setChewOffered(false); return }
    const t = setTimeout(() => setChewOffered(false), CHEW_OFFER_MS)
    return () => clearTimeout(t)
  }, [chewOffered, canChew])

  // One play's decision: a new snap should not inherit the last one's open button or chew.
  const phase = gameState?.phase
  const playSerial = gameState?.playSerial
  useEffect(() => { setChewOffered(false); setChewing(false) }, [phase, playSerial])

  function onClockTap() {
    const now = Date.now()
    const isDouble = now - lastClockTap.current < DOUBLE_TAP_MS
    lastClockTap.current = now
    if (isDouble && canChew) setChewOffered(v => !v)
  }

  if (!gameState) return null

  const { score, quarter, clock, down, distance, yardLine, role } = gameState
  const onOffense = role === 'offense'
  // [70] Timeouts remaining per team (viewer-relative). Render as small pips under each score.
  const timeouts = gameState.timeouts ?? { own: 3, opp: 3 }
  const pips = (n: number) => '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, 3 - n))
  // [71] Team identities for the score badges.
  const you = teamBadge(ownTeamId, 'You')
  const opp = teamBadge(oppTeamId, 'Opp')
  // Yard line in football convention: counts up to 50 at midfield, then back down (so the opponent's
  // 5 reads "5", not "95"; their 40 reads "40", not "60").
  const yl = Math.round(yardLine)
  const fieldYard = yl <= 50 ? yl : 100 - yl
  // Goal-to-go: the first-down line is at or past the goal, so the goal IS the marker → "& Goal".
  const goalToGo = yardLine + distance >= 100
  // Hide the play clock during a special-teams play — the kick runs on its own timer, so a frozen
  // play-clock number up top is just clutter ([41]).
  const showPlayClock = (phase === 'pre_snap' || phase === 'countdown') && !gameState.specialTeams
  const playClockColor = playClock <= 5 ? '#ef4444' : playClock <= 10 ? '#f97316' : undefined

  return (
    <>
      <div className="hud-top">

        <div className="hud-score">
          <span className="hud-team-label">
            {you.logo && <img className="hud-team-logo" src={you.logo} alt="" />}
            <span className="hud-team-abbr" style={{ color: you.accent }}>{you.label}</span>
            {onOffense && <span className="hud-ball-dot hud-ball-dot--you">●</span>}
          </span>
          <span className="hud-score-num">{score.offense}</span>
          <span className="hud-timeouts" title={`${timeouts.own} timeouts`}>{pips(timeouts.own)}</span>
        </div>

        <div className="hud-center">
          <span
            className={`hud-clock${chewing ? ' hud-clock--chewing' : ''}${canChew ? ' hud-clock--tappable' : ''}`}
            onPointerDown={onClockTap}
            title={canChew ? 'Double-tap to chew the clock' : undefined}
          >
            Q{quarter} · {formatClock(clock)}
          </span>
          {showPlayClock && (
            <span className="hud-playclock" style={playClockColor ? { color: playClockColor } : undefined}>
              :{playClock.toString().padStart(2, '0')}
            </span>
          )}
          {chewOffered && canChew && (
            <button className="hud-chew-btn" onPointerDown={() => { chewClock(); setChewOffered(false) }}>
              Chew Clock
            </button>
          )}
        </div>

        <div className="hud-score">
          <span className="hud-team-label">
            {!onOffense && <span className="hud-ball-dot hud-ball-dot--opp">●</span>}
            <span className="hud-team-abbr" style={{ color: opp.accent }}>{opp.label}</span>
            {opp.logo && <img className="hud-team-logo" src={opp.logo} alt="" />}
          </span>
          <span className="hud-score-num">{score.defense}</span>
          <span className="hud-timeouts" title={`${timeouts.opp} timeouts`}>{pips(timeouts.opp)}</span>
        </div>

      </div>

      <div className="hud-bottom">
        <span className="hud-down">{down}{DOWN_SUFFIX[down]} &amp; {goalToGo ? 'Goal' : distance < 1 ? 'inches' : Math.round(distance)}</span>
        <span className="hud-yard-line">Ball on {fieldYard}</span>
      </div>
    </>
  )
}
