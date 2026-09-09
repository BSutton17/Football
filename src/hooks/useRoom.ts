import { useState, useEffect } from 'react'
import { socket, createRoom as socketCreate, joinRoom as socketJoin, selectTeam as socketSelectTeam, lockTeam as socketLockTeam, setQuarterLength as socketSetQuarterLength, setDefenseVision as socketSetDefenseVision, disconnect, SESSION_KEY } from '../socket/index.ts'
import { generateRoomCode } from '../utils/roomCode.ts'
import type { TeamRole } from '../types/player.ts'
import type { GameMode, Difficulty } from '../types/game.ts'

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
  // [manual] The mode/difficulty this client is playing under. Chosen in the lobby when creating;
  // for a joiner these are confirmed by the server (the room is authoritative for both).
  mode: GameMode
  difficulty: Difficulty
  // [quarter length] Minutes per quarter, chosen by the HOST (slot 0) before kickoff. Both players
  // see it; only the host can change it, which the server enforces regardless.
  quarterMinutes: number
  // [defense vision] Whether the DEFENCE is shown how open receivers are. Host-chosen; on by default.
  defenseSeesOpenness: boolean
}

// Team-selection fields in their empty state — folded into every full state reset.
// [manual] mode/difficulty are included so every full-state reset that spreads this constant keeps
// them defined; callers that know better (createRoom / joinRoom) override them afterwards.
const CLEARED_SELECTION = {
  slot: null, validTeamIds: [] as string[], picks: {} as Record<number, TeamPick>, pickError: null,
  mode: 'automatic' as GameMode, difficulty: 'easy' as Difficulty, quarterMinutes: 5,
  defenseSeesOpenness: true,
}

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
      mode: 'automatic',
      difficulty: 'easy',
      quarterMinutes: 5,
      defenseSeesOpenness: true,
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

    // [manual] The server echoes the ROOM's mode/difficulty here. For a joiner that is the first
    // authoritative word on either, so adopt them rather than trusting the lobby selection.
    function onRoomJoined(data: { slot: number; mode?: GameMode; difficulty?: Difficulty }) {
      setState(s => ({
        ...s,
        status: 'waiting',
        mode: data.mode ?? s.mode,
        difficulty: data.difficulty ?? s.difficulty,
      }))
    }

    // [manual] Refused: the code is real but that room is running the other mode.
    function onRoomModeMismatch({ mode }: { mode: GameMode }) {
      const label = mode === 'manual' ? 'Manual' : 'Automatic'
      setState({
        ...CLEARED_SELECTION, status: 'error', roomId: null, role: null,
        mode: 'automatic', difficulty: 'easy',
        error: `That code is a ${label} game — pick ${label} to join it.`,
      })
      disconnect()
    }

    // Role is assigned before team selection; status is driven by team_select_start /
    // team_select_complete (or reconnect_success), so this only records the role.
    function onRolesAssigned({ role }: { role: TeamRole }) {
      setState(s => ({ ...s, role }))
    }

    // [268][269] Both players enter team selection together.
    function onTeamSelectStart({ slot, teamIds, quarterMinutes, defenseSeesOpenness }: { slot: number; teamIds: string[]; quarterMinutes?: number; defenseSeesOpenness?: boolean }) {
      setState(s => ({
        ...s, status: 'team_select', slot, validTeamIds: teamIds, picks: {}, pickError: null,
        quarterMinutes: quarterMinutes ?? s.quarterMinutes,
        defenseSeesOpenness: defenseSeesOpenness ?? s.defenseSeesOpenness,
      }))
    }

    // [defense vision] The host toggled it — both screens follow.
    function onDefenseVisionChanged({ on }: { on: boolean }) {
      setState(s => ({ ...s, defenseSeesOpenness: on }))
    }

    // [quarter length] The host changed it — both screens follow the server's clamped value.
    function onQuarterLengthChanged({ minutes }: { minutes: number }) {
      setState(s => ({ ...s, quarterMinutes: minutes }))
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

    function onReconnectSuccess({ roomId, role, slot }: { roomId: string; role: TeamRole; slot?: number }) {
      // Restore as 'ready'; if the room is actually still in team selection the server follows up
      // with team_select_start, which flips status back to 'team_select'. Restoring the slot (and the
      // team_selected picks the server re-sends) recovers team colors / roster after a refresh.
      setState(s => ({ ...s, status: 'ready', roomId, role, slot: slot ?? s.slot, error: null }))
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
    socket.on('quarter_length_changed', onQuarterLengthChanged)
    socket.on('defense_vision_changed', onDefenseVisionChanged)
    socket.on('team_selected', onTeamSelected)
    socket.on('team_taken', onTeamTaken)
    socket.on('team_select_complete', onTeamSelectComplete)
    socket.on('switch_sides', onSwitchSides)
    socket.on('reconnect_success', onReconnectSuccess)
    socket.on('reconnect_failed', onReconnectFailed)
    socket.on('room_mode_mismatch', onRoomModeMismatch)
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
      socket.off('quarter_length_changed', onQuarterLengthChanged)
      socket.off('defense_vision_changed', onDefenseVisionChanged)
      socket.off('team_selected', onTeamSelected)
      socket.off('team_taken', onTeamTaken)
      socket.off('team_select_complete', onTeamSelectComplete)
      socket.off('switch_sides', onSwitchSides)
      socket.off('reconnect_success', onReconnectSuccess)
      socket.off('reconnect_failed', onReconnectFailed)
      socket.off('room_mode_mismatch', onRoomModeMismatch)
      socket.off('room_full', onRoomFull)
      socket.off('room_not_found', onRoomNotFound)
      socket.off('room_error', onRoomError)
      socket.off('opponent_left', onOpponentLeft)
      socket.off('opponent_disconnected', onOpponentDisconnected)
      socket.off('game_abandoned', onGameAbandoned)
      socket.off('connect_error', onConnectError)
    }
  }, [])

  // [manual] mode/difficulty are chosen on the lobby screen and fix the room for the whole game.
  function createRoom(mode: GameMode = 'automatic', difficulty: Difficulty = 'easy') {
    // Starting a brand-new game — drop any stale session token so the upcoming connect doesn't
    // fire an unwanted reconnect_to_room (which could drop us into a dead room).
    sessionStorage.removeItem(SESSION_KEY)
    const id = generateRoomCode()
    setState({ ...CLEARED_SELECTION, status: 'connecting', roomId: id, role: null, error: null, mode, difficulty })
    socketCreate(id, mode, difficulty)
  }

  // The joiner's mode is only a filter — the server refuses a mismatch and the room's own
  // difficulty arrives with room_joined.
  function joinRoom(id: string, mode: GameMode = 'automatic') {
    sessionStorage.removeItem(SESSION_KEY)
    const normalized = id.replace(/\D/g, '').slice(0, 4)   // 4-digit numeric room code
    setState({ ...CLEARED_SELECTION, status: 'connecting', roomId: normalized, role: null, error: null, mode, difficulty: 'easy' })
    socketJoin(normalized, mode)
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

  // [quarter length] Only the host's control is rendered, but the server is the real gate.
  function setQuarterMinutes(minutes: number) {
    socketSetQuarterLength(minutes)
  }

  function setDefenseVision(on: boolean) {
    socketSetDefenseVision(on)
  }

  return { ...state, createRoom, joinRoom, leaveRoom, selectTeam, lockTeam, enterGame, setQuarterMinutes, setDefenseVision }
}
