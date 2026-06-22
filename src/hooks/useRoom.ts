import { useState, useEffect } from 'react'
import { socket, createRoom as socketCreate, joinRoom as socketJoin, selectTeam as socketSelectTeam, lockTeam as socketLockTeam, disconnect, SESSION_KEY } from '../socket/index.ts'
import { generateRoomCode } from '../utils/roomCode.ts'
import type { TeamRole } from '../types/player.ts'

export type RoomStatus = 'idle' | 'connecting' | 'waiting' | 'team_select' | 'vs' | 'ready' | 'reconnecting' | 'error' | 'abandoned'

// A slot's current team pick during selection ([269]).
export interface TeamPick {
  teamId: string
  locked: boolean
}

export interface RoomState {
  status: RoomStatus
  roomId: string | null
  role: TeamRole | null
  error: string | null
  // Team selection
  slot: number | null                       // this player's seat (0 | 1)
  validTeamIds: string[]                     // server-authoritative list of selectable teams
  picks: Record<number, TeamPick>            // slot → current pick (for self + opponent)
  pickError: string | null                   // [282] e.g. "that team is taken"
}

// Team-selection fields in their empty state — folded into every full state reset.
const CLEARED_SELECTION = { slot: null, validTeamIds: [] as string[], picks: {} as Record<number, TeamPick>, pickError: null }

export function useRoom() {
  const [state, setState] = useState<RoomState>(() => {
    // If a session token exists on mount, show reconnecting immediately
    const hasSession = !!sessionStorage.getItem(SESSION_KEY)
    return {
      status: hasSession ? 'reconnecting' : 'idle',
      roomId: null,
      role: null,
      error: null,
      slot: null,
      validTeamIds: [],
      picks: {},
      pickError: null,
    }
  })

  // Attempt reconnect on mount if a session exists
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      socket.connect()
    }
  }, [])

  useEffect(() => {
    function onSessionToken(token: string) {
      sessionStorage.setItem(SESSION_KEY, token)
    }

    function onRoomJoined(_data: { slot: number }) {
      setState(s => ({ ...s, status: 'waiting' }))
    }

    // Role is assigned before team selection; status is driven by team_select_start /
    // team_select_complete (or reconnect_success), so this only records the role.
    function onRolesAssigned({ role }: { role: TeamRole }) {
      setState(s => ({ ...s, role }))
    }

    // [268][269] Both players enter team selection together.
    function onTeamSelectStart({ slot, teamIds }: { slot: number; teamIds: string[] }) {
      setState(s => ({ ...s, status: 'team_select', slot, validTeamIds: teamIds, picks: {}, pickError: null }))
    }

    // [269] A pick (or lock) — for either player — broadcast by the server so both screens agree.
    function onTeamSelected({ slot, teamId, locked }: { slot: number; teamId: string; locked: boolean }) {
      setState(s => ({ ...s, picks: { ...s.picks, [slot]: { teamId, locked } } }))
    }

    // [282] The lock was rejected because the opponent already locked that team — drop our lock
    // back to a provisional pick and surface a message so the player chooses another.
    function onTeamTaken({ teamId }: { teamId: string }) {
      setState(s => {
        const mySlot = s.slot ?? 0
        const mine = s.picks[mySlot]
        const picks = mine && mine.teamId === teamId
          ? { ...s.picks, [mySlot]: { teamId, locked: false } }
          : s.picks
        return { ...s, picks, pickError: 'That team is taken — pick another.' }
      })
    }

    // Both locked — play the dramatic VS intro before handing off to gameplay. The game_state that
    // arrives alongside this updates the (not-yet-visible) game UI; enterGame() reveals it.
    function onTeamSelectComplete() {
      setState(s => ({ ...s, status: 'vs' }))
    }

    function onReconnectSuccess({ roomId, role }: { roomId: string; role: TeamRole }) {
      // Restore as 'ready'; if the room is actually still in team selection the server follows up
      // with team_select_start, which flips status back to 'team_select'.
      setState(s => ({ ...s, status: 'ready', roomId, role, error: null }))
    }

    // [192] Possession changed (interception / turnover on downs) — adopt the new role so the
    // offense/defense UI follows the ball.
    function onSwitchSides({ role }: { role: TeamRole }) {
      setState(s => ({ ...s, role }))
    }

    function onReconnectFailed() {
      sessionStorage.removeItem(SESSION_KEY)
      setState({ ...CLEARED_SELECTION, status: 'idle', roomId: null, role: null, error: null })
    }

    function onRoomFull() {
      setState({ ...CLEARED_SELECTION, status: 'error', roomId: null, role: null, error: 'Room is full' })
      disconnect()
    }

    function onRoomNotFound() {
      setState({ ...CLEARED_SELECTION, status: 'error', roomId: null, role: null, error: 'Room not found' })
      disconnect()
    }

    function onRoomError({ message }: { message: string }) {
      // Once we're past the lobby, a room_error is a transient REJECTED ACTION (e.g. tapping the
      // field after the whistle) — it must NOT tear down the session. Only treat it as fatal before
      // the game is underway (an invalid/taken room code).
      setState(s => {
        if (s.status === 'ready' || s.status === 'team_select' || s.status === 'vs') {
          console.warn('[room] action rejected:', message)
          return s
        }
        disconnect()
        return { ...CLEARED_SELECTION, status: 'error', roomId: null, role: null, error: message }
      })
    }

    function onOpponentLeft() {
      sessionStorage.removeItem(SESSION_KEY)
      setState(s => ({ ...s, status: 'waiting', role: null }))
    }

    function onOpponentDisconnected() {
      setState(s => ({ ...s, status: s.status })) // stay in current status; opponent may return
    }

    function onGameAbandoned() {
      sessionStorage.removeItem(SESSION_KEY)
      disconnect()
      setState({ ...CLEARED_SELECTION, status: 'abandoned', roomId: null, role: null, error: null })
    }

    function onConnectError(err: Error) {
      sessionStorage.removeItem(SESSION_KEY)
      setState(s => ({ ...s, status: 'error', error: err.message }))
    }

    socket.on('session_token', onSessionToken)
    socket.on('room_joined', onRoomJoined)
    socket.on('roles_assigned', onRolesAssigned)
    socket.on('team_select_start', onTeamSelectStart)
    socket.on('team_selected', onTeamSelected)
    socket.on('team_taken', onTeamTaken)
    socket.on('team_select_complete', onTeamSelectComplete)
    socket.on('switch_sides', onSwitchSides)
    socket.on('reconnect_success', onReconnectSuccess)
    socket.on('reconnect_failed', onReconnectFailed)
    socket.on('room_full', onRoomFull)
    socket.on('room_not_found', onRoomNotFound)
    socket.on('room_error', onRoomError)
    socket.on('opponent_left', onOpponentLeft)
    socket.on('opponent_disconnected', onOpponentDisconnected)
    socket.on('game_abandoned', onGameAbandoned)
    socket.on('connect_error', onConnectError)

    return () => {
      socket.off('session_token', onSessionToken)
      socket.off('room_joined', onRoomJoined)
      socket.off('roles_assigned', onRolesAssigned)
      socket.off('team_select_start', onTeamSelectStart)
      socket.off('team_selected', onTeamSelected)
      socket.off('team_taken', onTeamTaken)
      socket.off('team_select_complete', onTeamSelectComplete)
      socket.off('switch_sides', onSwitchSides)
      socket.off('reconnect_success', onReconnectSuccess)
      socket.off('reconnect_failed', onReconnectFailed)
      socket.off('room_full', onRoomFull)
      socket.off('room_not_found', onRoomNotFound)
      socket.off('room_error', onRoomError)
      socket.off('opponent_left', onOpponentLeft)
      socket.off('opponent_disconnected', onOpponentDisconnected)
      socket.off('game_abandoned', onGameAbandoned)
      socket.off('connect_error', onConnectError)
    }
  }, [])

  function createRoom() {
    // Starting a brand-new game — drop any stale session token so the upcoming connect doesn't
    // fire an unwanted reconnect_to_room (which could drop us into a dead room).
    sessionStorage.removeItem(SESSION_KEY)
    const id = generateRoomCode()
    setState({ ...CLEARED_SELECTION, status: 'connecting', roomId: id, role: null, error: null })
    socketCreate(id)
  }

  function joinRoom(id: string) {
    sessionStorage.removeItem(SESSION_KEY)
    const normalized = id.trim().toUpperCase()
    setState({ ...CLEARED_SELECTION, status: 'connecting', roomId: normalized, role: null, error: null })
    socketJoin(normalized)
  }

  function leaveRoom() {
    disconnect()
    setState({ ...CLEARED_SELECTION, status: 'idle', roomId: null, role: null, error: null })
  }

  // [269] Provisional pick (browsing) — optimistically reflect it locally, then tell the server,
  // which broadcasts the authoritative team_selected back to both players.
  function selectTeam(teamId: string) {
    setState(s => (s.slot == null ? s : { ...s, pickError: null, picks: { ...s.picks, [s.slot]: { teamId, locked: false } } }))
    socketSelectTeam(teamId)
  }

  function lockTeam(teamId: string) {
    setState(s => (s.slot == null ? s : { ...s, pickError: null, picks: { ...s.picks, [s.slot]: { teamId, locked: true } } }))
    socketLockTeam(teamId)
  }

  // Dismiss the VS intro and enter gameplay (the game already started server-side).
  function enterGame() {
    setState(s => (s.status === 'vs' ? { ...s, status: 'ready' } : s))
  }

  return { ...state, createRoom, joinRoom, leaveRoom, selectTeam, lockTeam, enterGame }
}
