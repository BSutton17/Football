import { useState } from 'react'
import { isValidRoomCode } from '../utils/roomCode.ts'
import type { RoomState } from '../hooks/useRoom.ts'
import type { GameMode, Difficulty } from '../types/game.ts'

interface Props extends RoomState {
  createRoom: (mode: GameMode, difficulty: Difficulty) => void
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

// Read the display name off the same list the picker uses, so adding a difficulty can never again
// leave this label silently falling back to "Easy".
function difficultyName(id: Difficulty | null | undefined): string {
  return DIFFICULTIES.find(d => d.id === id)?.name ?? 'Easy'
}

export default function RoomScreen({ status, roomId, role, error, mode, difficulty, createRoom, joinRoom, leaveRoom }: Props) {
  const [inputCode, setInputCode]   = useState('')
  const [pickedMode, setPickedMode] = useState<GameMode | null>(null)
  const [pickedDiff, setPickedDiff] = useState<Difficulty>('easy')

  const inputFilled  = inputCode.length === 4
  const inputInvalid = inputFilled && !isValidRoomCode(inputCode)
  const canJoin      = inputFilled && !inputInvalid

  function backToModes() {
    setPickedMode(null)
    setInputCode('')
  }

  return (
    <div className="room-screen">
      <h1 className="room-title">E-Football</h1>

      {/* Step 1 — how do you want to play? */}
      {status === 'idle' && pickedMode === null && (
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
      {status === 'idle' && pickedMode !== null && (
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

      {(status === 'connecting' || status === 'reconnecting') && (
        <p className="room-status">{status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</p>
      )}

      {status === 'waiting' && (
        <div className="room-waiting">
          {role && <span className="room-tag">{role === 'offense' ? 'Offense' : 'Defense'}</span>}

          {/* Confirm back what this room actually is — for a joiner these came from the server. */}
          <span className="room-mode-tag">
            {mode === 'manual' ? `Manual · ${difficultyName(difficulty)}` : 'Automatic'}
          </span>

          {roomId && (
            <div className="room-share">
              <p className="room-share-label">Share this code</p>
              <span className="room-code">{roomId}</span>
            </div>
          )}

          <p className="room-status">Waiting for opponent…</p>
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
