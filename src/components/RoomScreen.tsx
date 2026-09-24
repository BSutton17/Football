import { useState } from 'react'
import { isValidRoomCode } from '../utils/roomCode.ts'
import { NFL_TEAMS } from '../data/nflTeams.ts'
import TeamLogo from './TeamLogo.tsx'
import type { RoomState } from '../hooks/useRoom.ts'
import type { GameMode, Difficulty } from '../types/game.ts'

interface Props extends RoomState {
  createRoom: (mode: GameMode, difficulty: Difficulty) => void
  // [offline] One player against the computer. `aiTeamId` null means "surprise me".
  createOfflineRoom: (mode: GameMode, difficulty: Difficulty, aiTeamId: string | null) => void
  joinRoom:   (id: string, mode: GameMode) => void
  leaveRoom:  () => void
}

// [manual] The lobby is two steps. First pick how the game plays — Automatic (the original: tap
// HIKE and the play runs itself) or Manual (electric football: players move only while the offense
// holds GO). Each mode then has its OWN Create and Join, because a room belongs to one mode and the
// server refuses a join from the other; choosing up front is what makes that refusal impossible to
// stumble into. Manual also picks a difficulty, which the creator fixes for the whole room.

const MODES: { id: GameMode; name: string; blurb: string }[] = [
  { id: 'automatic', name: 'Automatic', blurb: '' },
  { id: 'manual',    name: 'Manual',    blurb: '' },
]

const DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'easy',   name: 'Easy',   blurb: 'Receivers are colored by how open they are.' },
  { id: 'medium', name: 'Medium', blurb: 'No coverage colors, but your routes show while paused.' },
  { id: 'hard',   name: 'Hard',   blurb: 'No coverage colors — read the field yourself.' },
]

// [offline] Offline, the same dial ALSO sets how well the computer plays, so it needs its own copy:
// the two-player blurbs above only describe what you are shown, which is half the story here.
const AI_BLURBS: Record<Difficulty, string> = {
  easy:   'Vanilla coverages, loose alignment, and it misreads the field. Receivers are colored by how open they are.',
  medium: 'The full playbook, including pressure. No coverage colors — your routes show while paused.',
  hard:   'Disguised pressure, tight alignment, and it reads the field as well as it can. No coverage colors.',
}

// Read the display name off the same list the picker uses, so adding a difficulty can never again
// leave this label silently falling back to "Easy".
function difficultyName(id: Difficulty | null | undefined): string {
  return DIFFICULTIES.find(d => d.id === id)?.name ?? 'Easy'
}

export default function RoomScreen({ status, roomId, role, error, mode, difficulty, offline, createRoom, createOfflineRoom, joinRoom, leaveRoom }: Props) {
  const [inputCode, setInputCode]   = useState('')
  const [pickedMode, setPickedMode] = useState<GameMode | null>(null)
  const [pickedDiff, setPickedDiff] = useState<Difficulty>('easy')
  // [offline] The offline setup panel, and which team the computer will play as. null = random,
  // which is also the default — picking an opponent is an option, not a chore.
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [aiTeamId, setAiTeamId]       = useState<string | null>(null)

  const inputFilled  = inputCode.length === 4
  const inputInvalid = inputFilled && !isValidRoomCode(inputCode)
  const canJoin      = inputFilled && !inputInvalid

  function backToModes() {
    setPickedMode(null)
    setInputCode('')
    setOfflineOpen(false)
  }

  function startOffline() {
    setOfflineOpen(false)
    // The picked difficulty goes through in BOTH modes offline — it is the computer's skill, not
    // just the manual-mode read-hiding. (Online still forces 'easy' for automatic, server-side.)
    createOfflineRoom(pickedMode ?? 'automatic', pickedDiff, aiTeamId)
  }

  return (
    <div className="room-screen">
      {!offlineOpen && <h1 className="room-title">E-Football</h1>}

      {/* Step 1 — how do you want to play? */}
      {status === 'idle' && !offlineOpen && pickedMode === null && (
        <div className="room-lobby">
          {MODES.map(m => (
            <button key={m.id} className="room-mode-btn" onClick={() => setPickedMode(m.id)}>
              <span className="room-mode-name">{m.name}</span>
              <span className="room-mode-blurb">{m.blurb}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — create or join, within the chosen mode. */}
      {status === 'idle' && !offlineOpen && pickedMode !== null && (
        <div className="room-lobby">
          <div className="room-mode-tag">
            {pickedMode === 'manual' ? 'Manual' : 'Automatic'}
          </div>

          {pickedMode === 'manual' && (
            <div className="room-difficulty">
              <p className="room-difficulty-label">Difficulty — set by whoever creates the room</p>
              <div className="room-difficulty-row">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.id}
                    className={`room-diff-btn${pickedDiff === d.id ? ' selected' : ''}`}
                    onClick={() => setPickedDiff(d.id)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
              <p className="room-difficulty-blurb">
                {DIFFICULTIES.find(d => d.id === pickedDiff)!.blurb}
              </p>
            </div>
          )}

          <button
            className="room-btn primary"
            onClick={() => createRoom(pickedMode, pickedMode === 'manual' ? pickedDiff : 'easy')}
          >
            Create Room
          </button>

          <span className="room-divider">or</span>

          <div className="room-join">
            <input
              className={`room-input${inputInvalid ? ' invalid' : ''}`}
              placeholder="Room code"
              value={inputCode}
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
              onChange={e => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <button
              className="room-btn join"
              onClick={() => joinRoom(inputCode, pickedMode)}
              disabled={!canJoin}
            >
              Join
            </button>
          </div>

          {inputInvalid && (
            <p className="room-input-error">Invalid code — enter the 4-digit number</p>
          )}

          <button className="room-back-btn" onClick={backToModes}>← Back</button>
        </div>
      )}

      {/* [offline] Pinned bottom-right on the lobby, out of the flow of the two-player path so it
          reads as a separate thing to do rather than a third way to start the same game. */}
      {status === 'idle' && !offlineOpen && (
        <button className="room-offline-btn" onClick={() => setOfflineOpen(true)}>
          <span className="room-offline-tag">1P</span>
          Offline
        </button>
      )}

      {/* [offline] Setup: who is the computer? Random by default — picking is optional. */}
      {status === 'idle' && offlineOpen && (
        <div className="room-offline-panel">
          <h2 className="room-offline-title">Play Offline</h2>
          <p className="room-offline-sub">
            You pick your team next. Choose who you are playing against, or leave it to chance.
          </p>

          <div className="room-offline-mode">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`room-diff-btn${(pickedMode ?? 'automatic') === m.id ? ' selected' : ''}`}
                onClick={() => setPickedMode(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* [offline] Shown in BOTH modes, unlike the two-player lobby. Offline this dial is how
              good the opponent is, which matters whether or not you are playing manual — it used to
              appear only for manual and an automatic offline game was always the easy computer. */}
          <div className="room-offline-mode">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`room-diff-btn${pickedDiff === d.id ? ' selected' : ''}`}
                onClick={() => setPickedDiff(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
          <p className="room-difficulty-blurb">{AI_BLURBS[pickedDiff]}</p>

          <div className="room-offline-oppline">
            <span className="room-offline-opplabel">Opponent</span>
            <button
              className={`room-offline-random${aiTeamId === null ? ' selected' : ''}`}
              onClick={() => setAiTeamId(null)}
            >
              🎲 Random
            </button>
          </div>

          <div className="room-offline-rail">
            {NFL_TEAMS.map(t => (
              <button
                key={t.id}
                type="button"
                data-tid={t.id}
                className={`room-offline-chip${aiTeamId === t.id ? ' room-offline-chip--on' : ''}`}
                onClick={() => setAiTeamId(t.id)}
                aria-label={t.name}
                aria-pressed={aiTeamId === t.id}
              >
                <TeamLogo teamId={t.id} size={34} selected={aiTeamId === t.id} />
              </button>
            ))}
          </div>

          <button className="room-btn primary" onClick={startOffline}>
            {aiTeamId ? `Play ${NFL_TEAMS.find(t => t.id === aiTeamId)?.abbr ?? aiTeamId}` : 'Play a Random Team'}
          </button>
          <button className="room-back-btn" onClick={() => setOfflineOpen(false)}>← Back</button>
        </div>
      )}

      {(status === 'connecting' || status === 'reconnecting') && (
        <p className="room-status">{status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</p>
      )}

      {status === 'waiting' && (
        <div className="room-waiting">
          {role && <span className="room-tag">{role === 'offense' ? 'Offense' : 'Defense'}</span>}

          {/* Confirm back what this room actually is — for a joiner these came from the server. */}
          <span className="room-mode-tag">
            {offline
              ? `${mode === 'manual' ? 'Manual' : 'Automatic'} · ${difficultyName(difficulty)} computer`
              : mode === 'manual' ? `Manual · ${difficultyName(difficulty)}` : 'Automatic'}
          </span>

          {roomId && (
            <div className="room-share">
              <p className="room-share-label">Share this code</p>
              <span className="room-code">{roomId}</span>
            </div>
          )}

          <p className="room-status">{offline ? 'Starting…' : 'Waiting for opponent…'}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="room-error">
          <p>{error}</p>
          <button className="room-btn" onClick={() => { backToModes(); leaveRoom() }}>Try Again</button>
        </div>
      )}

      {status === 'abandoned' && (
        <div className="room-error">
          <p>Opponent failed to reconnect — game over.</p>
          <button className="room-btn" onClick={() => { backToModes(); leaveRoom() }}>Return to Lobby</button>
        </div>
      )}
    </div>
  )
}
