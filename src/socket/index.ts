import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents, SetOffensePayload, PlacePlayerPayload } from '../types/socket.ts'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const SESSION_KEY = 'ef2_session'

// Which server to connect to, decided AT RUNTIME (not baked in at build time) so the deployed site
// always reaches the live server without needing build-time env config:
//   1. VITE_SERVER_URL — an explicit override (handy for pointing local dev at a remote server), else
//   2. localhost        — when the app itself is being served from localhost (local dev), else
//   3. the production server (the deployed client is anywhere but localhost → talk to Heroku).
const LOCAL_SERVER = 'http://localhost:3001'
const PROD_SERVER  = 'https://football-server-3a8e8a32d792.herokuapp.com'

function resolveServerUrl(): string {
  const override = import.meta.env.VITE_SERVER_URL
  if (override) return override
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  return isLocal ? LOCAL_SERVER : PROD_SERVER
}

const SERVER_URL: string = resolveServerUrl()

const socket: GameSocket = io(SERVER_URL, {
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

// [Special Teams][12][14][21] Send a kick input — directional aim (left/right) or the punt backspin
// toggle. The server is authoritative for the outcome; the client only transmits intent.
export function sendSpecialTeamsInput(data: { aim?: 'left' | 'right'; backspin?: boolean }): void {
  if (socket.connected) socket.emit('special_teams_input', data)
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

// [Special Teams][2][3] The offense's 4th-down menu choice (server validates + is authoritative).
export function sendDecision(option: import('../types/game.ts').DecisionOption): void {
  if (socket.connected) socket.emit('special_teams_choice', { option })
}

// [Special Teams][28] The receiving team's punt-return choice (server validates + is authoritative).
export function sendPuntReturnChoice(option: import('../types/game.ts').PuntReturnOption): void {
  if (socket.connected) socket.emit('punt_return_choice', { option })
}

// [Special Teams][46][49] The defender's FG/XP block attempt at a normalized bar position (0..1).
export function sendFieldGoalBlock(position: number): void {
  if (socket.connected) socket.emit('fg_block', { position })
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
