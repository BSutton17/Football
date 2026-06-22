import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents, SetOffensePayload, PlacePlayerPayload } from '../types/socket.ts'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const SESSION_KEY = 'ef2_session'

const socket: GameSocket = io({
  autoConnect: false,
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

function emitWhenConnected(fn: () => void): void {
  if (socket.connected) {
    fn()
  } else {
    socket.once('connect', fn)
    socket.connect()
  }
}

export function createRoom(roomId: string): void {
  emitWhenConnected(() => socket.emit('create_room', roomId))
}

export function joinRoom(roomId: string): void {
  emitWhenConnected(() => socket.emit('join_room', roomId))
}

export function disconnect(): void {
  sessionStorage.removeItem(SESSION_KEY)
  socket.disconnect()
}

export function selectTeam(teamId: string): void {
  if (socket.connected) socket.emit('select_team', { teamId })
}

export function lockTeam(teamId: string): void {
  if (socket.connected) socket.emit('lock_team', { teamId })
}

export function setOffense(payload: SetOffensePayload): void {
  if (socket.connected) socket.emit('set_offense', payload)
}

export function placePlayer(data: PlacePlayerPayload): void {
  if (socket.connected) socket.emit('place_player', data)
}

export function removePlayer(id: string): void {
  if (socket.connected) socket.emit('remove_player', id)
}

export function assignCoverage(payload: import('../types/socket.ts').AssignCoveragePayload): void {
  if (socket.connected) socket.emit('assign_coverage', payload)
}

export function clearCoverage(playerId: string): void {
  if (socket.connected) socket.emit('clear_coverage', { playerId })
}

export function snapBall(): void {
  if (socket.connected) socket.emit('snap_ball')
}

export function punt(): void {
  if (socket.connected) socket.emit('punt')
}

export function throwToReceiver(receiverId: string): void {
  if (socket.connected) socket.emit('throw_to_receiver', receiverId)
}

// Throwing at a defender is an immediate interception by that defender.
export function throwAtDefender(defenderId: string): void {
  if (socket.connected) socket.emit('throw_at_defender', defenderId)
}

export function scramble(): void {
  if (socket.connected) socket.emit('scramble')
}

export function throwAway(): void {
  if (socket.connected) socket.emit('throwaway')
}

export function resetGame(): void {
  if (socket.connected) socket.emit('reset_game')
}

export function devQuickSetup(payload: import('../types/socket.ts').DevSetupPayload): void {
  if (socket.connected) socket.emit('dev_quick_setup', payload)
}

// On every (re)connect: if a session token is stored, attempt to restore the session
socket.on('connect', () => {
  console.log(`[socket] connected: ${socket.id}`)
  const token = sessionStorage.getItem(SESSION_KEY)
  if (token) {
    socket.emit('reconnect_to_room', token)
  }
})

socket.on('disconnect', (reason) => {
  console.log(`[socket] disconnected: ${reason}`)
})

socket.on('connect_error', (err) => {
  console.error(`[socket] connection error: ${err.message}`)
})

export { socket }
