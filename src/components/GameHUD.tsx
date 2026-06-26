import { useEffect, useState } from 'react'
import type { GameState } from '../types/game.ts'
import { socket } from '../socket/index.ts'

interface Props {
  gameState: GameState | null
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DOWN_SUFFIX = ['', 'st', 'nd', 'rd', 'th'] as const

const PLAY_CLOCK_SECONDS = 25

export default function GameHUD({ gameState }: Props) {
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

  if (!gameState) return null

  const { score, quarter, clock, down, distance, yardLine, role, phase } = gameState
  const onOffense = role === 'offense'
  const showPlayClock = phase === 'pre_snap' || phase === 'countdown'
  const playClockColor = playClock <= 5 ? '#ef4444' : playClock <= 10 ? '#f97316' : undefined

  return (
    <>
      <div className="hud-top">

        <div className="hud-score">
          <span className="hud-score-label">
            You {onOffense && <span className="hud-ball-dot hud-ball-dot--you">●</span>}
          </span>
          <span className="hud-score-num">{score.offense}</span>
        </div>

        <div className="hud-center">
          <span className="hud-clock">Q{quarter} · {formatClock(clock)}</span>
          {showPlayClock && (
            <span className="hud-playclock" style={playClockColor ? { color: playClockColor } : undefined}>
              :{playClock.toString().padStart(2, '0')}
            </span>
          )}
        </div>

        <div className="hud-score">
          <span className="hud-score-label">
            {!onOffense && <span className="hud-ball-dot hud-ball-dot--opp">●</span>} Opp
          </span>
          <span className="hud-score-num">{score.defense}</span>
        </div>

      </div>

      <div className="hud-bottom">
        <span className="hud-down">{down}{DOWN_SUFFIX[down]} &amp; {distance < 1 ? 'inches' : Math.round(distance)}</span>
        <span className="hud-yard-line">Ball on {Math.round(yardLine)}</span>
      </div>
    </>
  )
}
