import { useState } from 'react'
import { isValidRoomCode } from '../utils/roomCode.ts'
import type { RoomState } from '../hooks/useRoom.ts'

interface Props extends RoomState {
  createRoom: () => void
  joinRoom:   (id: string) => void
  leaveRoom:  () => void
}

export default function RoomScreen({ status, roomId, role, error, createRoom, joinRoom, leaveRoom }: Props) {
  const [inputCode, setInputCode] = useState('')

  const inputFilled  = inputCode.length === 4
  const inputInvalid = inputFilled && !isValidRoomCode(inputCode)
  const canJoin      = inputFilled && !inputInvalid

  return (
    <div className="room-screen">
      <h1 className="room-title">E-Football</h1>

      {status === 'idle' && (
        <div className="room-lobby">
          <button className="room-btn primary" onClick={createRoom}>
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
              onClick={() => joinRoom(inputCode)}
              disabled={!canJoin}
            >
              Join
            </button>
          </div>

          {inputInvalid && (
            <p className="room-input-error">Invalid code — enter the 4-digit number</p>
          )}
        </div>
      )}

      {(status === 'connecting' || status === 'reconnecting') && (
        <p className="room-status">{status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</p>
      )}

      {status === 'waiting' && (
        <div className="room-waiting">
          {role && <span className="room-tag">{role === 'offense' ? 'Offense' : 'Defense'}</span>}

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
          <button className="room-btn" onClick={leaveRoom}>Try Again</button>
        </div>
      )}

      {status === 'abandoned' && (
        <div className="room-error">
          <p>Opponent failed to reconnect — game over.</p>
          <button className="room-btn" onClick={leaveRoom}>Return to Lobby</button>
        </div>
      )}
    </div>
  )
}
