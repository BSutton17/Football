import { useState, useEffect, useRef, useMemo } from 'react'
import { useRoom } from './hooks/useRoom.ts'
import { socket, setOffense, placePlayer, removePlayer, assignCoverage, clearCoverage, snapBall, throwToReceiver, throwAtDefender, scramble, throwAway, resetGame, SESSION_KEY } from './socket/index.ts'
import type { AssignCoveragePayload } from './types/socket.ts'
import RoomScreen from './components/RoomScreen.tsx'
import TeamSelectScreen from './components/TeamSelectScreen.tsx'
import VSScreen from './components/VSScreen.tsx'
import GameCanvas from './components/GameCanvas.tsx'
import GameHUD from './components/GameHUD.tsx'
import SpecialTeamsView from './components/SpecialTeamsView.tsx'
import FourthDownMenu from './components/FourthDownMenu.tsx'
import PuntReturnMenu from './components/PuntReturnMenu.tsx'
import { getSpecialTeamsFormation } from './game/specialTeamsFormation.ts'
import { getTeamSpecialists } from './data/specialists.ts'
import RosterSidebar from './components/RosterSidebar.tsx'
import RouteMenu from './components/RouteMenu.tsx'
import CoverageMenu from './components/CoverageMenu.tsx'
import type { RouteType, CoverageType, ZoneType } from './types/routes.ts'
import { loadTeamRoster } from './game/teamRoster.ts'
import { teamColors, textColorOn } from './data/teamColors.ts'
import { getOLQBPlayers, getDLPlayers, getPositionYBounds, enforceOffensiveFormation, validateOffensiveFormation, validateDefensiveFormation } from './game/formation.ts'
import { computeCamera } from './game/renderer.ts'
import { FIELD } from './constants/simulation.ts'
import type { GameState, PlayPhase, PositionUpdate, CarrierVision, Score, GameOver, PlayResult, SpecialTeamsState, PlayDecision } from './types/game.ts'

const YARD_LINE = 25   // mock ball position

const MOCK_STATE: GameState = {
  phase: 'pre_snap', quarter: 1, clock: 300,
  down: 1, distance: 10, yardLine: YARD_LINE,
  score: { offense: 0, defense: 0 },
  role: 'offense',   // overridden per-player below
}

// [224][225] Turn a play_result into a short, plain-language play-by-play notice. Covers yardage,
// sacks, turnovers (interceptions / on downs), scores, and first downs.
function summarizePlay(r: PlayResult): string {
  switch (r.outcome) {
    case 'touchdown':    return 'Touchdown!'
    case 'safety':       return 'Safety!'
    case 'punt':         return r.detail === 'out_of_bounds' ? 'Punt out of bounds'
                              : r.detail === 'touchback'     ? 'Touchback'
                              : r.detail === 'fair_catch'    ? 'Fair catch'
                              : r.detail === 'return'        ? 'Punt returned'
                              : 'Punt!'
    case 'field_goal':   return r.detail === 'made'       ? 'Field goal is good!'
                              : r.detail === 'blocked'     ? 'Field goal BLOCKED!'
                              : r.detail === 'wide_left'   ? 'Field goal wide left'
                              : r.detail === 'wide_right'  ? 'Field goal wide right'
                              : r.detail === 'short'       ? 'Field goal short'
                              : 'Field goal is no good'
    case 'extra_point':  return r.detail === 'made'    ? 'Extra point good!'
                              : r.detail === 'blocked'  ? 'Extra point BLOCKED!'
                              : 'Extra point no good'
    case 'two_point':    return r.detail === 'made' ? 'Two-point conversion good!' : 'Two-point conversion failed'
    case 'interception': return 'Intercepted!'
    case 'incomplete':
      if (r.newPossession)          return 'Turnover on downs'
      if (r.detail === 'broken_up') return 'Pass broken up'
      return 'Incomplete pass'
    case 'sack':         return r.newPossession ? 'Sacked — turnover on downs' : `Sacked for ${Math.abs(r.yardsGained)}`
    case 'tackle':
      if (r.newPossession) return 'Turnover on downs'
      if (r.firstDown)     return r.yardsGained > 0 ? `First down! +${r.yardsGained}` : 'First down!'
      if (r.yardsGained > 0) return `Gain of ${r.yardsGained}`
      if (r.yardsGained < 0) return `Loss of ${Math.abs(r.yardsGained)}`
      return 'No gain'
    default:             return ''
  }
}

// A prominent, longer-lived result banner for kicks. These resolve while the special-teams overlay is
// up, and the ensuing kickoff's game_state wipes the normal play-notice almost immediately — so kick
// outcomes get their own banner that isn't cleared by game_state. Returns null for non-kick plays.
function kickResultText(r: PlayResult): string | null {
  switch (r.outcome) {
    case 'field_goal':
    case 'extra_point':
      return r.detail === 'made'    ? "It's good!"
           : r.detail === 'blocked' ? 'Blocked!'
           :                          'Missed!'   // wide_left | wide_right | short | missed
    case 'punt':
      return r.detail === 'touchback' ? 'Touchback!' : null
    default:
      return null
  }
}

// [hash] Lateral ball spot defaults to midfield. A player's body is ~1.5 yd, so a shifted player is
// kept between these bounds rather than being pushed out of bounds.
const FIELD_MID = FIELD.WIDTH / 2
const MIN_X = 1.5
const MAX_X = FIELD.WIDTH - 1.5
const clampX = (x: number) => Math.max(MIN_X, Math.min(MAX_X, x))

// Offensive skill positions whose names a defender is allowed to see on the field.
const NAME_REVEAL_LABELS = new Set(['RB', 'WR', 'TE'])

export default function App() {
  const room = useRoom()

  // [289][291][292] Load the player's selected team's roster into memory — the offense/defense pools
  // the sidebar drags onto the field. Falls back to the generic roster if no team is known yet.
  const myTeamId   = room.picks[room.slot ?? 0]?.teamId ?? null
  const teamRoster = useMemo(() => loadTeamRoster(myTeamId), [myTeamId])
  // id → full name, so the field can label players by last name (OL/DL keep their position).
  // Uses the loader's nameById so the auto-placed QB is labeled by name too.
  const rosterName = useMemo(
    () => new Map(Object.entries(teamRoster.nameById)),
    [teamRoster],
  )
  // [run] Overall rating per player — used to pick the ball carrier when two RBs are on the field.
  const rosterOvr = useMemo(
    () => new Map(teamRoster.offense.map(p => [p.id, p.ovr ?? 0])),
    [teamRoster],
  )
  // The OPPONENT's roster names — the only place we expose the other team's names: a defender gets to
  // read the offense's skill-position (RB/WR/TE) names. Same teamId → same ids on both clients, so the
  // ids on the broadcast offensive players resolve here.
  const oppTeamId   = room.picks[1 - (room.slot ?? 0)]?.teamId ?? null
  const oppRoster   = useMemo(() => loadTeamRoster(oppTeamId), [oppTeamId])
  const oppNameById = useMemo(
    () => new Map(Object.entries(oppRoster.nameById)),
    [oppRoster],
  )

  const [placedPlayers, setPlacedPlayers] = useState<PositionUpdate[]>([])
  const [dlPositions, setDlPositions] = useState<PositionUpdate[]>(() => getDLPlayers(YARD_LINE))
  // The real line of scrimmage (offense-relative), synced from the server. Formation, camera, and
  // pointer math all key off this so the scrimmage sits at the actual ball spot, not a fixed mock
  // line — keeping the server's gain/loss math accurate after the ball moves or sides switch.
  const [losYardLine, setLosYardLine] = useState(YARD_LINE)
  const prevLosRef = useRef(YARD_LINE)
  // [hash] Lateral ball spot (absolute X) the formation lines up on. Like the LOS, the carried-over
  // formation shifts sideways by how far the ball moved between snaps. Starts at midfield.
  const [ballX, setBallX] = useState(FIELD_MID)
  const prevBallXRef = useRef(FIELD_MID)
  // The first game_state of a game (or a reconnect) sets the LOS baseline without shifting.
  const losReadyRef = useRef(false)
  // Set when possession just flipped, so the next game_state lines the new formation up on the new
  // (mirrored) LOS instead of trying to shift the old one across the direction change.
  const turnoverPendingRef = useRef(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Committed formation snapshot — set when user locks in, cleared on any change
  const [lockedFormation, setLockedFormation] = useState<PositionUpdate[] | null>(null)
  const [playerRoutes, setPlayerRoutes] = useState<Record<string, RouteType>>({})
  const [routeDepths, setRouteDepths] = useState<Record<string, number>>({})
  const [playerCoverage, setPlayerCoverage] = useState<Record<string, CoverageType>>({})
  const [manTargets, setManTargets] = useState<Record<string, string>>({})
  const [zoneTypes, setZoneTypes] = useState<Record<string, ZoneType>>({})
  const [zoneCenters, setZoneCenters] = useState<Record<string, { x: number; y: number }>>({})
  const [playType, setPlayType] = useState<'run' | 'pass'>('pass')
  const [runAngle, setRunAngle] = useState<number>(0)  // degrees, -60 to +60
  const [phase, setPhase] = useState<PlayPhase>('pre_snap')
  const [hikeCount, setHikeCount] = useState<number | null>(null)
  const [hikeReady, setHikeReady] = useState(false)
  const [gameClock, setGameClock] = useState(MOCK_STATE.clock)
  const [gameQuarter, setGameQuarter] = useState(MOCK_STATE.quarter)
  const [score, setScore] = useState<Score>(MOCK_STATE.score)   // [195] live score, synced from server
  // [197][198] live down & distance, synced from the server so first-down resets ("1st & 10") show.
  const [down, setDown] = useState<GameState['down']>(MOCK_STATE.down)
  const [distance, setDistance] = useState(MOCK_STATE.distance)
  // [196] touchdown celebration banner: { scored } when a TD just happened, else null. Cleared
  // at the next snap. This is where audio/animation will hook in later.
  const [touchdownBanner, setTouchdownBanner] = useState<{ scored: boolean } | null>(null)
  // [218] brief halftime banner (foundation for halftime UI). [219][220] final result overlay.
  const [halftime, setHalftime] = useState(false)
  // [Special Teams][1] Server-authoritative kicking state; non-null while a kick is in progress.
  const [specialTeams, setSpecialTeams] = useState<SpecialTeamsState | null>(null)
  // [Special Teams][2][3] 4th-down decision menu (offense only); non-null while the offense must choose.
  const [decision, setDecision] = useState<PlayDecision | null>(null)
  // [Special Teams formations] Purely-visual ST formation, animated into place while a player kick is up.
  const [stFormation, setStFormation] = useState<PositionUpdate[]>([])
  // [294] Ids of players whose X-Factor is active — drives the gold star before AND after the snap.
  const [xfActiveIds, setXfActiveIds] = useState<string[]>([])
  // True while a punt / FG / XP kicking interface is up (kickoffs are automatic — no formation).
  const kickInProgress = !!(specialTeams && specialTeams.playerControlled)
  const kickFormationType = kickInProgress ? specialTeams!.kickType : null
  // The kicking team is whoever is on offense — its real Kicker/Punter name shows in the formation.
  // (oppTeamId is declared above with the opponent roster.)
  const kickingTeamId = (room.role ?? 'offense') === 'offense' ? myTeamId : oppTeamId
  // [team colors] Each team keeps its colors all game (own vs opponent), regardless of side. The room
  // creator (slot 0) is HOME: primary body + a contrasting O/X. The other player is AWAY: white body
  // with its primary as the O/X. The selection border is the team's secondary either way.
  const ownIsHome = (room.slot ?? 0) === 0
  const paintFor = (teamId: string | null, isHome: boolean) => {
    const { primary, secondary } = teamColors(teamId ?? '')
    return isHome
      ? { fill: primary,    text: textColorOn(primary), ring: secondary }
      : { fill: '#ffffff',  text: primary,              ring: secondary }
  }
  const ownTeam = paintFor(myTeamId,  ownIsHome)
  const oppTeam = paintFor(oppTeamId, !ownIsHome)
  useEffect(() => {
    if (!kickFormationType) { setStFormation(prev => (prev.length ? [] : prev)); return }
    // Both teams jog out from the ball spot into their NFL special-teams alignment (visual only).
    const sp = getTeamSpecialists(kickingTeamId)
    const targets = getSpecialTeamsFormation(kickFormationType, losYardLine, ballX, {
      kicker: sp?.kicker.name, punter: sp?.punter.name,
    })
    const DURATION = 600
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const e = 1 - Math.pow(1 - t, 3)   // easeOutCubic
      setStFormation(targets.map(tg => ({
        ...tg,
        x: ballX + (tg.x - ballX) * e,
        y: losYardLine + (tg.y - losYardLine) * e,
      })))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [kickFormationType, losYardLine, ballX, kickingTeamId])
  const [gameOver, setGameOver] = useState<GameOver | null>(null)
  // [224][225] short play-by-play notice (e.g. "First down!", "Intercepted!"). Cleared next snap.
  const [playNotice, setPlayNotice] = useState<string | null>(null)
  // Any notice auto-dismisses after 3 seconds (the next snap's game_state may clear it sooner).
  useEffect(() => {
    if (!playNotice) return
    const t = setTimeout(() => setPlayNotice(null), 3000)
    return () => clearTimeout(t)
  }, [playNotice])
  // Prominent kick-result banner ("It's good!", "Missed!", "Blocked!", "Touchback!"). Unlike the play
  // notice, game_state does NOT clear it — only this timer does — so it survives the ensuing kickoff.
  const [kickResult, setKickResult] = useState<string | null>(null)
  useEffect(() => {
    if (!kickResult) return
    const t = setTimeout(() => setKickResult(null), 3500)
    return () => clearTimeout(t)
  }, [kickResult])
  // The play has ended (between play_result and the next snap) — raises a click-blocker over the
  // field so stray taps can't fire actions the server would reject. Cleared at the next game_state.
  const [playOver, setPlayOver] = useState(false)
  // [fatigue] Toggle for the Fatigue view (a bar under each non-lineman/QB) and the latest stamina
  // snapshot (playerId → 0–100) the server sends with each game_state.
  const [fatigueVisible, setFatigueVisible] = useState(false)
  const [fatigue, setFatigue] = useState<Record<string, number>>({})
  // Tracks whether the game just ended, so the first game_state afterward (a [222] reset) clears
  // the overlay and wipes the formation — without firing on ordinary between-play game_state.
  const gameOverRef = useRef(false)
  // Positions received from the server — the other team's players as they place/move them
  const [opponentPositions, setOpponentPositions] = useState<PositionUpdate[]>([])
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number; openness?: number; xfActive?: boolean }>>({})
  // [193] id of the player currently carrying the ball (from positions_update), or null.
  const [liveCarrierId, setLiveCarrierId] = useState<string | null>(null)
  const [carrierVision, setCarrierVision] = useState<CarrierVision | null>(null)   // [163] run visualizer
  // [166] once a throw is committed this play, ignore further receiver taps. Reset each play.
  const thrownRef = useRef(false)
  // [168] the receiver the pass is going to — drives the dashed QB→receiver line. Reset each play.
  const [targetReceiverId, setTargetReceiverId] = useState<string | null>(null)
  // [184] true once the QB has committed to a scramble this play — hides the scramble button and
  // locks throwing ([185]). Reset each play.
  const [scrambling, setScrambling] = useState(false)
  // [187] random screen position (percent) for the throwaway button, set 2s after the snap.
  // Null = not shown (before the 2s hold, or once the ball is gone). Reset each play.
  const [throwawayPos, setThrowawayPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const myTeam: 'o' | 'd' = room.role === 'defense' ? 'd' : 'o'
    function onPlayerPlaced(p: PositionUpdate) {
      if (p.team === myTeam) {
        // Our own players normally come from local placement, so own-team echoes are redundant.
        // But the dev quick-setup places THIS side's players on the server; adopt any we don't
        // already have locally so they actually render. Auto OL/QB/DL are generated locally on
        // every client (getOLQBPlayers / getDLPlayers), so never adopt those.
        if (p.id.startsWith('auto_')) return
        setPlacedPlayers(prev => prev.some(o => o.id === p.id) ? prev : [...prev, { ...p }])
        return
      }
      setOpponentPositions(prev => [...prev.filter(o => o.id !== p.id), p])
    }
    function onPlayerRemoved(id: string) {
      setOpponentPositions(prev => prev.filter(p => p.id !== id))
    }
    function onCoverageAssigned(payload: AssignCoveragePayload) {
      const { playerId, type, targetId, zoneType, zoneCenterX, zoneCenterY } = payload
      setPlayerCoverage(prev => ({ ...prev, [playerId]: type }))
      if (type === 'man' && targetId) {
        setManTargets(prev => ({ ...prev, [playerId]: targetId }))
        setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
        setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
      } else if (type === 'zone' && zoneType) {
        setZoneTypes(prev => ({ ...prev, [playerId]: zoneType as ZoneType }))
        if (zoneCenterX != null && zoneCenterY != null) {
          setZoneCenters(prev => ({ ...prev, [playerId]: { x: zoneCenterX, y: zoneCenterY } }))
        }
        setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
      } else {
        setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
        setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
        setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
      }
    }
    function onCoverageCleared({ playerId }: { playerId: string }) {
      setPlayerCoverage(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
    }
    function onOffenseSet() { setPhase('countdown') }
    function onHikeCountdown({ count }: { count: number }) {
      setHikeCount(count)
      if (count === 0) setHikeReady(true)
    }
    function onBallSnapped() { setHikeCount(null); setHikeReady(false); setPhase('live'); setScrambling(false); setThrowawayPos(null); setLiveCarrierId(null); setTouchdownBanner(null) }
    function onQbScrambling() { setScrambling(true); thrownRef.current = true }   // [185] lock throws
    function onPositionsUpdate(updates: PositionUpdate[]) {
      setLivePositions(prev => {
        const next = { ...prev }
        for (const u of updates) {
          if (u.x != null && u.y != null) next[u.id] = { x: u.x, y: u.y, openness: u.openness, xfActive: u.xfActive }
        }
        return next
      })
      // [193] Track who has the ball so the camera can follow them (incl. interception returns).
      const ball = updates.find(u => u.state === 'ball')
      setLiveCarrierId(ball ? ball.id : null)
    }
    function onClockUpdate({ quarter, clock }: { quarter: number; clock: number }) {
      setGameQuarter(quarter as GameState['quarter'])
      setGameClock(clock)
    }
    function onScoreUpdate(s: Score) { setScore(s) }   // [195] touchdown / scoring sync
    function onHalftime() { setHalftime(true) }         // [218] cleared at the next snap (game_state)
    function onSpecialTeamsUpdate(st: SpecialTeamsState | null) { setSpecialTeams(st) }   // [Special Teams][1]
    // [delay of game] Play clock hit zero — the server applied a 5-yard penalty (it sends the updated
    // game_state first, then this), so show the notice.
    function onPlayClockExpired() { setPlayNotice('Delay of game — 5 yard penalty') }
    function onGameOver(data: GameOver) { gameOverRef.current = true; setGameOver(data); setPhase('dead') }   // [219] no more snaps
    // [224][225] The play is over — show the notice and raise the click-blocker so taps on the field
    // can't fire throw/scramble actions during the dead window (the server would reject them, and a
    // rejection used to disconnect the player). Cleared when the next snap's game_state arrives.
    function onPlayResult(r: PlayResult) {
      // Kicks get the dedicated, game_state-proof banner; everything else uses the play notice.
      const kr = kickResultText(r)
      if (kr) { setKickResult(kr); setPlayNotice(null) }
      else      setPlayNotice(summarizePlay(r))
      setPlayOver(true)
    }
    function onTouchdown({ scored, score }: { scored: boolean; score: Score }) {
      // [196] Show the celebration banner and update the score immediately. (Audio/animation
      // will hook in here later.) The banner clears at the next snap.
      setScore(score)
      setTouchdownBanner({ scored })
    }
    function onCarrierVision(vision: CarrierVision | null) {
      setCarrierVision(vision)
    }
    // [pass-line feedback] Both teams see the pass line; a 2s auto-clear effect hides it after.
    function onPassThrown({ receiverId }: { receiverId: string }) {
      setTargetReceiverId(receiverId)
    }
    // [run power] The ball carrier broke a tackle — flash a notice (the play continues).
    function onTackleBroken() {
      setPlayNotice('Tackle Broken!')
    }
    function onGameState(gs: GameState) {
      setPhase(gs.phase)
      setHikeCount(null)
      setHikeReady(false)
      setLivePositions({})
      setCarrierVision(null)
      thrownRef.current = false   // [166] new play — the throw decision is open again
      setTargetReceiverId(null)   // [168] clear the pass line for the new play
      setScrambling(false)        // [184] new play — scramble available again
      setThrowawayPos(null)       // [187] new play — hide the throwaway button
      setLiveCarrierId(null)      // [193] new play — clear the ball carrier
      setLockedFormation(null)    // each play starts unset — the offense must toggle Set Formation again
      setGameClock(gs.clock)
      setGameQuarter(gs.quarter)
      setScore(gs.score)          // [195] keep the score synced on play boundaries / reconnect
      setDown(gs.down)            // [197][198] reflect the new series (e.g. 1st & 10 after a conversion)
      setDistance(gs.distance)

      // Follow the real line of scrimmage. Within a drive, shift the carried-over players by how
      // far the ball moved since the last snap so they stay lined up on the new LOS. Skip this when
      // the formation is being reset anyway — a turnover (role flip + mirrored LOS) or a postgame
      // reset — since a simple delta isn't valid across a direction change; instead the new defense
      // just lines up fresh on the new LOS.
      const ready     = losReadyRef.current
      const losDelta  = ready ? gs.yardLine - prevLosRef.current : 0
      // [hash] How far the ball moved laterally since the last snap — the formation slides with it.
      const newBallX  = gs.ballX ?? FIELD_MID
      const xDelta    = ready ? newBallX - prevBallXRef.current : 0
      losReadyRef.current = true
      const resetting = gameOverRef.current || turnoverPendingRef.current
      if (!resetting && (losDelta !== 0 || xDelta !== 0)) {
        // [hash] Shift carried-over players by the LOS (vertical) and ball (lateral) deltas. A player
        // that would be pushed out of bounds is clamped to where its body still fits (1.5 yd).
        setPlacedPlayers(prev => prev.map(p => ({ ...p, x: clampX(p.x + xDelta), y: p.y + losDelta })))
        setDlPositions(prev => prev.map(p => ({ ...p, x: clampX(p.x + xDelta), y: p.y + losDelta })))
        setOpponentPositions(prev => prev.map(p => ({ ...p, x: clampX(p.x + xDelta), y: p.y + losDelta })))
        // Zone landmarks live in offense-relative yards too, so they ride up the field with the
        // new LOS (and sideways with the ball) instead of being left behind on the old spot.
        setZoneCenters(prev => {
          const next: Record<string, { x: number; y: number }> = {}
          for (const [id, c] of Object.entries(prev)) next[id] = { x: clampX(c.x + xDelta), y: c.y + losDelta }
          return next
        })
      }
      if (turnoverPendingRef.current) {
        setDlPositions(getDLPlayers(gs.yardLine, newBallX))   // the new defense lines up on the new LOS + hash
        turnoverPendingRef.current = false
      }
      prevLosRef.current = gs.yardLine
      setLosYardLine(gs.yardLine)
      prevBallXRef.current = newBallX
      setBallX(newBallX)
      setFatigue(gs.fatigue ?? {})   // [fatigue] authoritative stamina snapshot for the bars
      setSpecialTeams(gs.specialTeams ?? null)   // [Special Teams][1] sync the kicking state on play boundaries / reconnect
      setDecision(gs.decision ?? null)           // [Special Teams][2][3] 4th-down menu (offense only; cleared once chosen)
      setXfActiveIds(gs.xfActiveIds ?? [])       // [294] active X-Factors — star shows pre-snap too
      setTouchdownBanner(null)    // [196] clear the celebration once the next play is set up
      setHalftime(false)          // [218] halftime ends when the next drive lines up
      setPlayNotice(null)         // [224][225] clear the play notice for the new play
      setPlayOver(false)          // next snap is lining up — drop the post-play click-blocker

      // [222] The only game_state after a game ends is the postgame reset — clear the final
      // overlay and wipe the carried-over formation so both players start the fresh game clean.
      if (gameOverRef.current) {
        gameOverRef.current = false
        setGameOver(null)
        setPlacedPlayers([])
        setOpponentPositions([])
        setDlPositions(getDLPlayers(YARD_LINE))
        prevBallXRef.current = FIELD_MID   // [hash] new game spots at center
        setBallX(FIELD_MID)
        setPlayerRoutes({})
        setRouteDepths({})
        setPlayerCoverage({})
        setManTargets({})
        setZoneTypes({})
        setZoneCenters({})
      }
    }
    socket.on('player_placed', onPlayerPlaced)
    socket.on('player_removed', onPlayerRemoved)
    socket.on('coverage_assigned', onCoverageAssigned)
    socket.on('coverage_cleared', onCoverageCleared)
    socket.on('offense_set', onOffenseSet)
    socket.on('hike_countdown', onHikeCountdown)
    socket.on('ball_snapped', onBallSnapped)
    socket.on('qb_scrambling', onQbScrambling)
    socket.on('positions_update', onPositionsUpdate)
    socket.on('pass_thrown', onPassThrown)
    socket.on('tackle_broken', onTackleBroken)
    socket.on('carrier_vision', onCarrierVision)
    socket.on('clock_update', onClockUpdate)
    socket.on('score_update', onScoreUpdate)
    socket.on('touchdown', onTouchdown)
    socket.on('halftime', onHalftime)
    socket.on('game_over', onGameOver)
    socket.on('play_result', onPlayResult)
    socket.on('game_state', onGameState)
    socket.on('special_teams_update', onSpecialTeamsUpdate)
    socket.on('play_clock_expired', onPlayClockExpired)
    return () => {
      socket.off('player_placed', onPlayerPlaced)
      socket.off('player_removed', onPlayerRemoved)
      socket.off('coverage_assigned', onCoverageAssigned)
      socket.off('coverage_cleared', onCoverageCleared)
      socket.off('offense_set', onOffenseSet)
      socket.off('hike_countdown', onHikeCountdown)
      socket.off('ball_snapped', onBallSnapped)
      socket.off('qb_scrambling', onQbScrambling)
      socket.off('positions_update', onPositionsUpdate)
      socket.off('pass_thrown', onPassThrown)
      socket.off('tackle_broken', onTackleBroken)
      socket.off('carrier_vision', onCarrierVision)
      socket.off('clock_update', onClockUpdate)
      socket.off('score_update', onScoreUpdate)
      socket.off('touchdown', onTouchdown)
      socket.off('halftime', onHalftime)
      socket.off('game_over', onGameOver)
      socket.off('play_result', onPlayResult)
      socket.off('game_state', onGameState)
      socket.off('special_teams_update', onSpecialTeamsUpdate)
      socket.off('play_clock_expired', onPlayClockExpired)
    }
  }, [room.role])

  // [pass-line feedback] The pass line is a brief cue — once a target is set (by either team's
  // pass_thrown), clear it after 2 seconds. (A new play / scramble / throwaway also clears it.)
  useEffect(() => {
    if (!targetReceiverId) return
    const timer = setTimeout(() => setTargetReceiverId(null), 2000)
    return () => clearTimeout(timer)
  }, [targetReceiverId])

  // [187] Throwaway availability: the QB must hold the ball for 2 seconds on a live pass play
  // before the option appears, and it pops up at a RANDOM screen location to reward a quick
  // reaction. It vanishes once the ball is thrown or the QB scrambles.
  useEffect(() => {
    const isOffense = (room.role ?? 'offense') === 'offense'
    if (!isOffense || phase !== 'live' || playType !== 'pass' || scrambling || thrownRef.current) {
      setThrowawayPos(null)
      return
    }
    const timer = setTimeout(() => {
      if (thrownRef.current || scrambling) return
      // Keep it on the OFFENSIVE side of the field — the backfield band below the LOS (which sits
      // ~1/3 up from the bottom) — so it never covers the downfield receivers/coverage the QB is
      // reading. Still randomized horizontally (and a little vertically) to reward a quick reaction.
      setThrowawayPos({ top: 70 + Math.random() * 16, left: 15 + Math.random() * 65 })
    }, 2000)
    return () => clearTimeout(timer)
  }, [room.role, phase, playType, scrambling])

  // New game: wipe all play design state and storage when the user creates or joins a room.
  // Reconnects bypass 'connecting' (go through 'reconnecting' directly to 'ready') so this
  // only fires for intentional new-game flows.
  useEffect(() => {
    if (room.status !== 'connecting') return
    losReadyRef.current = false   // re-establish the LOS baseline from the new game's first game_state
    prevLosRef.current  = YARD_LINE
    setLosYardLine(YARD_LINE)
    prevBallXRef.current = FIELD_MID   // [hash] baseline lateral spot re-establishes from the first game_state
    setBallX(FIELD_MID)
    setPlacedPlayers([])
    setOpponentPositions([])
    setDlPositions(getDLPlayers(YARD_LINE))
    setPlayerRoutes({})
    setRouteDepths({})
    setPlayerCoverage({})
    setManTargets({})
    setZoneTypes({})
    setZoneCenters({})
    setLockedFormation(null)
    setLivePositions({})
    sessionStorage.removeItem('ef2_placed_players')
  }, [room.status])

  // [192] Possession changed (turnover): the client's role just flipped, so the old formation
  // belongs to the other side now. Wipe the per-play design and start fresh as the new role.
  // Guarded by the previous role so it never fires on the initial assignment or a reconnect
  // (which would clobber the restored formation).
  const prevRoleRef = useRef<string | null>(null)
  useEffect(() => {
    const r = room.role
    if (prevRoleRef.current && r && prevRoleRef.current !== r) {
      setPlacedPlayers([])
      setOpponentPositions([])
      setDlPositions(getDLPlayers(YARD_LINE))
      setPlayerRoutes({})
      setRouteDepths({})
      setPlayerCoverage({})
      setManTargets({})
      setZoneTypes({})
      setZoneCenters({})
      setLockedFormation(null)
      setLivePositions({})
      turnoverPendingRef.current = true   // next game_state lines up fresh on the mirrored LOS
      sessionStorage.removeItem('ef2_placed_players')
    }
    prevRoleRef.current = r
  }, [room.role])

  // Restore placed players on mount when reconnecting to an existing session.
  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) return
    try {
      const saved = sessionStorage.getItem('ef2_placed_players')
      if (saved) setPlacedPlayers(JSON.parse(saved))
    } catch {}
  }, [])

  // Persist placed players so a page reload restores positions.
  useEffect(() => {
    sessionStorage.setItem('ef2_placed_players', JSON.stringify(placedPlayers))
  }, [placedPlayers])

  // Register the auto-placed defensive line on the server at the start of every play.
  // The DL are generated client-side (getDLPlayers) and — unlike the offense's OL/QB,
  // which reach the server through the locked playDesign — nothing sends them on their
  // own until the user drags one. The server also wipes all field players between plays,
  // so without this the DL are never simulated and stand frozen on the snap.
  // Only the defender sends them (placePlayer validates team against role).
  useEffect(() => {
    if (room.status !== 'ready' || room.role !== 'defense' || phase !== 'pre_snap') return
    for (const dl of dlPositions) {
      placePlayer({ id: dl.id, x: dl.x, y: dl.y, label: dl.label ?? 'DL', team: 'd', ratings: teamRoster.ratingsById[dl.id], xFactor: teamRoster.xFactorById[dl.id] })
    }
  }, [room.status, room.role, phase, dlPositions])

  // [207] Substitutions between plays. The server wipes all field players between plays, so the
  // carried-over formation — and any personnel the player swapped in/out before the next snap —
  // must be re-registered each pre-snap. We re-send this team's placed players (and echo them to
  // the opponent) on entering pre_snap; mid-pre-snap drops/removes are handled live by
  // handleDrop / handleRemove. (The offense's set also rides along in set_offense, but the
  // defense has no such path, so without this its DBs/LBs would vanish on the next play.)
  // Deliberately not keyed on placedPlayers — that would re-blast the whole formation on every
  // drag; the snapshot captured at pre_snap entry is the correct carried-over set.
  useEffect(() => {
    if (room.status !== 'ready' || phase !== 'pre_snap') return
    const team: 'o' | 'd' = room.role === 'defense' ? 'd' : 'o'
    for (const p of placedPlayers) {
      placePlayer({ id: p.id, x: p.x, y: p.y, label: p.label ?? '', team, ratings: teamRoster.ratingsById[p.id], xFactor: teamRoster.xFactorById[p.id] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, room.role, phase])

  // [268][270] Pregame team selection sits between joining and gameplay.
  if (room.status === 'team_select') {
    return (
      <TeamSelectScreen
        role={room.role}
        slot={room.slot}
        validTeamIds={room.validTeamIds}
        picks={room.picks}
        pickError={room.pickError}
        onSelect={room.selectTeam}
        onLock={room.lockTeam}
      />
    )
  }

  // [VS screen] Both players locked — play the hype intro before kickoff.
  if (room.status === 'vs') {
    return <VSScreen picks={room.picks} slot={room.slot} onContinue={room.enterGame} />
  }

  if (room.status !== 'ready') return <RoomScreen {...room} />

  const role = room.role ?? 'offense'

  const gameState: GameState = { ...MOCK_STATE, role, phase, clock: gameClock, quarter: gameQuarter, score, down, distance, yardLine: losYardLine, specialTeams, ballX }
  const isPreSnap = phase === 'pre_snap'

  // The QB lines up at the ball's hash (ballX), 6 yards behind the LOS — so the backfield (and the
  // runner's bounds) follow the ball laterally instead of sitting at the field middle.
  const QB_X = ballX
  const QB_Y = losYardLine - 6

  // On a run, the ball carrier is the HIGHER-OVR RB on the field (so two-back sets hand to the better
  // back); ties keep placement order.
  const placedRBs = placedPlayers.filter(p => p.label === 'RB')
  const runnerRB  = placedRBs.length > 0
    ? [...placedRBs].sort((a, b) => (rosterOvr.get(b.id) ?? 0) - (rosterOvr.get(a.id) ?? 0))[0]
    : null
  const runnerId  = playType === 'run' && runnerRB ? runnerRB.id : null

  // Runner must stay within 2 yards of QB horizontally and behind or level with QB (the own end zone
  // is fair game when backed up, matching getPositionYBounds).
  const runnerBounds = {
    minX: QB_X - 2,
    maxX: QB_X + 2,
    minY: Math.max(-9.5, losYardLine - 10),
    maxY: QB_Y,
  }

  const placedIds    = new Set(placedPlayers.map(p => p.id))
  // If the opponent moved a DL, the received position overrides the local auto-placed one
  const opponentMap = new Map(opponentPositions.map(p => [p.id, p]))

  // During live play, positions_update moves players; outside live, use design positions.
  // The ball carrier ([193]) is tagged 'ball' so the renderer draws the football on them and
  // the camera follows them.
  const xfActiveSet = new Set(xfActiveIds)
  const applyLivePos = (p: PositionUpdate): PositionUpdate => {
    // [294] The gold star shows BEFORE and after the snap: pre-snap from the server's active set,
    // during live from the per-tick xfActive flag.
    const starred = xfActiveSet.has(p.id)
    if (phase !== 'live') return starred ? { ...p, xfActive: true } : p
    const lp = livePositions[p.id]
    // Carry the server-computed openness so the renderer can color pass catchers ([169]); it's
    // only present once the receiver has declared (first cut / 1.3s), so before that the receiver
    // keeps its base color.
    const base = lp ? { ...p, x: lp.x, y: lp.y, openness: lp.openness, xfActive: lp.xfActive } : p
    const withStar = (starred || base.xfActive) ? { ...base, xfActive: true } : base
    return p.id === liveCarrierId ? { ...withStar, state: 'ball' } : withStar
  }

  const allPositions = [
    // Label our own QB by name (offense view only — the defender doesn't know the opponent's name).
    ...getOLQBPlayers(losYardLine, ballX).map(p => applyLivePos(role === 'offense' ? { ...p, name: rosterName.get(p.id) } : p)),
    ...dlPositions.map(p => applyLivePos(opponentMap.get(p.id) ?? p)),
    // Attach the roster name so the field can show the player's last name (renderer uses position for OL/DL).
    ...placedPlayers.map(p => applyLivePos({ ...p, route: playerRoutes[p.id], name: rosterName.get(p.id) })),
    // On defense, reveal the offense's RB/WR/TE names (only those positions, only for the defender).
    ...opponentPositions.filter(p => !p.id.startsWith('auto_dl')).map(p => {
      const lp = applyLivePos(p)
      return role === 'defense' && NAME_REVEAL_LABELS.has(lp.label ?? '')
        ? { ...lp, name: oppNameById.get(lp.id) }
        : lp
    }),
  ]

  const availableOffense = teamRoster.offense.filter(p => !placedIds.has(p.id))
  const availableDefense = teamRoster.defense.filter(p => !placedIds.has(p.id))

  // 11-player limit — auto-placed count differs by role
  const autoCount    = role === 'offense' ? getOLQBPlayers(YARD_LINE).length : getDLPlayers(YARD_LINE).length
  const fieldCount   = autoCount + placedPlayers.length
  const limitReached = fieldCount >= 11

  // Formation validation — live feedback shown as a banner on the field. The required number of
  // placements is the on-field skill slots (11 minus the auto-placed OL+QB / DL), NOT the size of
  // the selectable pool — the roster offers more players than a team fields, so it picks a subset.
  const requiredPlacements = 11 - autoCount
  const formationErrors = role === 'offense'
    ? validateOffensiveFormation(placedPlayers, requiredPlacements, losYardLine)
    : validateDefensiveFormation(placedPlayers, requiredPlacements)

  const blitzIds = Object.entries(playerCoverage)
    .filter(([, type]) => type === 'blitz')
    .map(([id]) => id)

  // Only show the remove button for own non-auto placed players
  const myTeam = role === 'offense' ? 'o' : 'd'
  const canRemoveSelected = selectedId != null
    && !selectedId.startsWith('auto_')
    && allPositions.find(p => p.id === selectedId)?.team === myTeam
    && (myTeam !== 'o' || isPreSnap)
    && phase !== 'live'

  // Route menu: shown for WR / TE / RB selected on offense
  const ROUTE_POSITIONS    = ['WR', 'TE', 'RB']
  const COVERAGE_POSITIONS = ['LB', 'CB', 'S', 'DL']
  const selectedPlayer  = selectedId ? allPositions.find(p => p.id === selectedId) : null
  const showRouteMenu   = role === 'offense'
    && isPreSnap
    && selectedPlayer != null
    && ROUTE_POSITIONS.includes(selectedPlayer.label ?? '')
  const showCoverageMenu = role === 'defense'
    && phase !== 'live'
    && selectedPlayer != null
    && COVERAGE_POSITIONS.includes(selectedPlayer.label ?? '')

  const spyIds = Object.entries(playerCoverage)
    .filter(([, type]) => type === 'spy')
    .map(([id]) => id)

  function handleRemove(playerId: string) {
    setPlacedPlayers(prev => prev.filter(p => p.id !== playerId))
    setPlayerRoutes(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setRouteDepths(prev => { const n = { ...prev }; delete n[playerId]; return n })
    // A removed defender takes their assignment with them — clear the man/zone line locally and
    // on the server so no orphaned coverage stays on the field.
    setPlayerCoverage(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
    if (playerCoverage[playerId]) clearCoverage(playerId)
    setSelectedId(null)
    setLockedFormation(null)
    removePlayer(playerId)
  }

  function handleRouteSelect(playerId: string, route: RouteType) {
    setPlayerRoutes(prev => ({ ...prev, [playerId]: route }))
  }

  const ELIGIBLE_RECEIVER_LABELS = ['WR', 'TE', 'RB']
  // Within this distance (yards), a defender will double-team a guarded receiver
  // rather than chase an unguarded one that's farther away.
  const DOUBLE_TEAM_RANGE = 3

  function findBestTarget(defenderId: string, currentTargets: Record<string, string>): string | null {
    const defender = allPositions.find(p => p.id === defenderId)
    if (!defender) return null
    const eligibles = allPositions.filter(
      p => p.team === 'o' && ELIGIBLE_RECEIVER_LABELS.includes(p.label ?? '')
    )
    if (eligibles.length === 0) return null

    // Exclude this defender's own current assignment when deciding who's "guarded"
    const otherAssigned = new Set(
      Object.entries(currentTargets)
        .filter(([defId]) => defId !== defenderId)
        .map(([, tgtId]) => tgtId)
    )
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

    const nearest = (list: typeof eligibles) =>
      list.length === 0 ? null : list.reduce((best, r) => dist(defender, r) < dist(defender, best) ? r : best)

    const unguarded = eligibles.filter(r => !otherAssigned.has(r.id))
    const guarded   = eligibles.filter(r =>  otherAssigned.has(r.id))

    const nearestUnguarded = nearest(unguarded)
    const nearestGuarded   = nearest(guarded)

    if (!nearestUnguarded) return nearestGuarded?.id ?? null
    if (!nearestGuarded)   return nearestUnguarded.id

    const dGuarded   = dist(defender, nearestGuarded)
    const dUnguarded = dist(defender, nearestUnguarded)

    // Double-team: guarded player is very close AND closer than any open receiver
    if (dGuarded <= DOUBLE_TEAM_RANGE && dGuarded < dUnguarded) return nearestGuarded.id
    return nearestUnguarded.id
  }

  function handleCoverageSelect(playerId: string, coverage: CoverageType, zoneType?: ZoneType) {
    setPlayerCoverage(prev => ({ ...prev, [playerId]: coverage }))

    if (coverage === 'man') {
      setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
      const targetId = findBestTarget(playerId, manTargets)
      setManTargets(prev => targetId ? { ...prev, [playerId]: targetId } : prev)
      assignCoverage(targetId ? { playerId, type: 'man', targetId } : { playerId, type: 'man' })

    } else if (coverage === 'zone' && zoneType) {
      setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setZoneTypes(prev => ({ ...prev, [playerId]: zoneType }))
      // Reuse existing center or initialize 3 yards above the defender
      let center = zoneCenters[playerId] ?? null
      if (!center) {
        const def = allPositions.find(p => p.id === playerId)
        if (def) {
          center = { x: def.x, y: def.y + 3 }
          setZoneCenters(prev => ({ ...prev, [playerId]: center! }))
        }
      }
      assignCoverage(center
        ? { playerId, type: 'zone', zoneType, zoneCenterX: center.x, zoneCenterY: center.y }
        : { playerId, type: 'zone', zoneType })

    } else {
      setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
      setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
      assignCoverage({ playerId, type: coverage })
    }
  }

  function handleClearAssignment(playerId: string) {
    setPlayerCoverage(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setManTargets(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setZoneTypes(prev => { const n = { ...prev }; delete n[playerId]; return n })
    setZoneCenters(prev => { const n = { ...prev }; delete n[playerId]; return n })
    clearCoverage(playerId)
  }

  function handleZoneCenterMove(defenderId: string, x: number, y: number) {
    if (phase === 'live') return
    setZoneCenters(prev => ({ ...prev, [defenderId]: { x, y } }))
    const zt = zoneTypes[defenderId]
    if (zt) assignCoverage({ playerId: defenderId, type: 'zone', zoneType: zt, zoneCenterX: x, zoneCenterY: y })
  }

  function handleRouteDepthChange(playerId: string, depth: number) {
    setRouteDepths(prev => ({ ...prev, [playerId]: depth }))
    setLockedFormation(null)
  }

  function handlePlayType(type: 'run' | 'pass') {
    setPlayType(type)
    setLockedFormation(null)
    if (type !== 'run' || role !== 'offense') return
    // [run] Switching to a run: drop the ball carrier into a legal backfield spot if it's out of
    // position (e.g. split out wide on the previous pass call). The higher-OVR RB is the carrier and
    // the one moved; a back already legally placed is left where the user put it.
    const rbs = placedPlayers.filter(p => p.label === 'RB')
    if (rbs.length === 0) return
    const runner = [...rbs].sort((a, b) => (rosterOvr.get(b.id) ?? 0) - (rosterOvr.get(a.id) ?? 0))[0]
    const inX = Math.abs(runner.x - ballX) <= 2
    const inY = runner.y >= losYardLine - 10 && runner.y <= losYardLine - 6
    if (inX && inY) return   // already legal — leave the user's placement
    const next     = placedPlayers.map(p => p.id === runner.id ? { ...p, x: clampX(ballX), y: losYardLine - 8 } : p)
    const enforced = enforceOffensiveFormation(next, losYardLine)
    setPlacedPlayers(enforced)
    // Broadcast the adjusted formation so the SERVER and the DEFENSE see the RB in its new backfield
    // spot — without this the auto-move only lived on the offense's screen.
    for (const p of enforced) {
      placePlayer({ id: p.id, x: p.x, y: p.y, label: p.label ?? '', team: 'o',
        ratings: teamRoster.ratingsById[p.id], xFactor: teamRoster.xFactorById[p.id] })
    }
  }

  function handleRunAngle(delta: number) {
    setRunAngle(prev => Math.max(-60, Math.min(60, prev + delta)))
    setLockedFormation(null)
  }

  function handleLockFormation() {
    if (formationErrors.length > 0) return
    const snapshot = allPositions.map(p => ({ ...p, routeDepthScale: routeDepths[p.id] }))
    setLockedFormation(snapshot)
    setOffense({
      playType,
      runAngle,
      players: snapshot.map(p => ({
        id:              p.id,
        x:               p.x,
        y:               p.y,
        label:           p.label ?? '',
        team:            p.team,
        route:           p.route,
        routeDepthScale: p.routeDepthScale,
        ratings:         teamRoster.ratingsById[p.id],   // [293] per-team ratings → simulation
        xFactor:         teamRoster.xFactorById[p.id],   // [294] potential X-Factor ability
      })),
    })
  }

  function handleHike() {
    snapBall()
  }

  function handleDrop(playerId: string, clientX: number, clientY: number) {
    if (role === 'offense' && !isPreSnap) return
    if (phase === 'live') return
    if (limitReached) return
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return

    const roster = role === 'offense' ? teamRoster.offense : teamRoster.defense
    const player = roster.find(p => p.id === playerId)
    if (!player) return

    const rect = canvas.getBoundingClientRect()
    const cam  = computeCamera(rect.width, rect.height, losYardLine)
    const rawX = (clientX - rect.left - cam.offsetX) / cam.yardPx
    const rawY = cam.topRelY - (clientY - rect.top) / cam.yardPx

    const rawX2 = Math.max(0.5, Math.min(FIELD.WIDTH - 0.5, rawX))
    const { minY, maxY } = getPositionYBounds(player.position, role, losYardLine)
    const rawY2 = Math.max(minY, Math.min(maxY, rawY))

    // First RB placed on a run play is the runner — constrain near QB
    const rbsExcludingThis = placedPlayers.filter(p => p.label === 'RB' && p.id !== playerId)
    const isRunner = playType === 'run' && player.position === 'RB' && rbsExcludingThis.length === 0
    const x = isRunner ? Math.max(runnerBounds.minX, Math.min(runnerBounds.maxX, rawX2)) : rawX2
    const y = isRunner ? Math.min(runnerBounds.maxY, rawY2) : rawY2

    const placed: PositionUpdate = {
      id:    playerId,
      x,
      y,
      team:  role === 'offense' ? 'o' : 'd',
      label: player.position,
    }

    setLockedFormation(null)
    const next     = [...placedPlayers.filter(p => p.id !== playerId), placed]
    const enforced = role === 'offense' ? enforceOffensiveFormation(next, losYardLine) : next
    setPlacedPlayers(enforced)
    // Enforcement can move players OTHER than the one just dropped (e.g. snapping an extra
    // backfield player up to the line). Send the whole adjusted set so the opponent sees the
    // real formation, not just the dragged player.
    if (role === 'offense') {
      for (const p of enforced) placePlayer({ id: p.id, x: p.x, y: p.y, label: p.label ?? '', team: 'o', ratings: teamRoster.ratingsById[p.id], xFactor: teamRoster.xFactorById[p.id] })
    } else {
      placePlayer({ id: playerId, x, y, label: player.position, team: placed.team, ratings: teamRoster.ratingsById[playerId], xFactor: teamRoster.xFactorById[playerId] })
    }
  }

  function handlePlayerMove(playerId: string, x: number, y: number) {
    if (role === 'offense' && !isPreSnap) return
    if (phase === 'live') return
    setLockedFormation(null)
    const isRunner = runnerId === playerId
    const fx = isRunner ? Math.max(runnerBounds.minX, Math.min(runnerBounds.maxX, x)) : x
    const fy = isRunner ? Math.min(runnerBounds.maxY, y) : y
    if (playerId.startsWith('auto_dl')) {
      setDlPositions(prev => prev.map(p => p.id === playerId ? { ...p, x: fx } : p))
      placePlayer({ id: playerId, x: fx, y: fy, label: 'DL', team: 'd', ratings: teamRoster.ratingsById[playerId], xFactor: teamRoster.xFactorById[playerId] })
    } else {
      const next     = placedPlayers.map(p => p.id === playerId ? { ...p, x: fx, y: fy } : p)
      const enforced = role === 'offense' ? enforceOffensiveFormation(next, losYardLine) : next
      setPlacedPlayers(enforced)
      // Re-send the whole offense — enforcement may have nudged players other than the one moved,
      // so the opponent's view stays in sync with the adjusted formation (not just the moved one).
      if (role === 'offense') {
        for (const p of enforced) placePlayer({ id: p.id, x: p.x, y: p.y, label: p.label ?? '', team: 'o', ratings: teamRoster.ratingsById[p.id], xFactor: teamRoster.xFactorById[p.id] })
      } else {
        const p = placedPlayers.find(p => p.id === playerId)
        if (p) placePlayer({ id: playerId, x: fx, y: fy, label: p.label ?? '', team: p.team, ratings: teamRoster.ratingsById[playerId], xFactor: teamRoster.xFactorById[playerId] })
      }
    }
  }

  // [165] Tapping a receiver during a live pass play throws to them. [166] The first tap
  // locks the decision for the play — later taps are ignored (the server also enforces this).
  function handleThrowReceiver(receiverId: string) {
    if (role !== 'offense' || playType !== 'pass' || phase !== 'live') return
    if (thrownRef.current || scrambling) return   // [185] no throwing once the QB scrambles
    thrownRef.current = true
    setThrowawayPos(null)             // [187] the ball is gone — no more throwaway
    setTargetReceiverId(receiverId)   // [168] draw the dashed line to the targeted receiver
    throwToReceiver(receiverId)
  }

  // Tapping a DEFENDER during a live pass play throws it right at him — an immediate interception.
  // Locks the throw decision for the play just like a normal throw.
  function handleThrowAtDefender(defenderId: string) {
    if (role !== 'offense' || playType !== 'pass' || phase !== 'live') return
    if (thrownRef.current || scrambling) return
    thrownRef.current = true
    setThrowawayPos(null)
    setTargetReceiverId(defenderId)   // brief line to the defender before the pick
    throwAtDefender(defenderId)
  }

  // [184] Convert the QB into a runner during a live pass play — triggered by tapping the QB on
  // the field. Optimistically locks throwing; the server confirms with qb_scrambling. Irreversible
  // for the play ([185]).
  function handleScramble() {
    if (role !== 'offense' || playType !== 'pass' || phase !== 'live') return
    if (thrownRef.current || scrambling) return
    setScrambling(true)
    thrownRef.current = true
    setThrowawayPos(null)
    scramble()
  }

  // [222] Postgame "Play Again" — ask the server to start a fresh game on the same room. The
  // reset arrives as roles_assigned + game_state, which clears the overlay and the formation.
  function handlePlayAgain() {
    resetGame()
  }

  // [187] QB throws the ball away — an intentional incompletion ([188]). Locks the play's throw
  // decision and hides the button; the server resolves it as an incomplete pass.
  function handleThrowaway() {
    if (role !== 'offense' || playType !== 'pass' || phase !== 'live') return
    if (thrownRef.current || scrambling) return
    thrownRef.current = true
    setThrowawayPos(null)
    setTargetReceiverId(null)
    throwAway()
  }

  return (
    <div className="game-screen">
      {/* Post-play click-blocker: once a play ends, swallow every tap on the field until the next
          snap lines up, so stray clicks can't fire rejected actions. Hidden at game over so the
          "Play Again" button stays clickable. */}
      {playOver && !gameOver && <div className="play-block-overlay" aria-hidden />}
      <GameCanvas
        gameState={gameState}
        positions={kickInProgress ? stFormation : allPositions}
        onPlayerMove={handlePlayerMove}
        onSelect={setSelectedId}
        onThrowReceiver={handleThrowReceiver}
        onThrowAtDefender={handleThrowAtDefender}
        onScramble={handleScramble}
        targetReceiverId={targetReceiverId}
        routeDepths={routeDepths}
        onRouteDepthChange={handleRouteDepthChange}
        runAngle={role === 'offense' && playType === 'run' ? runAngle : null}
        runnerId={runnerId}
        runnerBounds={runnerId ? runnerBounds : null}
        manTargets={manTargets}
        zoneTypes={zoneTypes}
        zoneCenters={zoneCenters}
        onZoneCenterMove={handleZoneCenterMove}
        blitzIds={blitzIds}
        spyIds={spyIds}
        snapLocked={false}
        carrierVision={carrierVision}
        showFatigue={fatigueVisible}
        fatigue={fatigue}
        ownTeam={ownTeam}
        oppTeam={oppTeam}
      />
      <GameHUD gameState={gameState} />
      {/* [41] Official field-goal distance, shown to BOTH teams while a FG/XP is being set up. */}
      {specialTeams
        && (specialTeams.kickType === 'field_goal' || specialTeams.kickType === 'extra_point')
        && specialTeams.phase === 'setup'
        && typeof specialTeams.fieldGoalDistance === 'number' && (
        <div className="fg-distance" aria-live="polite">
          <span className="fg-distance__num">{Math.round(specialTeams.fieldGoalDistance)}</span>
          <span className="fg-distance__label">yd {specialTeams.kickType === 'extra_point' ? 'extra point' : 'field goal'}</span>
        </div>
      )}
      {specialTeams && <SpecialTeamsView st={specialTeams} />}
      {decision && role === 'offense' && <FourthDownMenu decision={decision} />}
      {specialTeams?.returnDecision && <PuntReturnMenu decision={specialTeams.returnDecision} />}
      {touchdownBanner && (
        <div className={`touchdown-banner${touchdownBanner.scored ? ' touchdown-banner--scored' : ' touchdown-banner--against'}`}>
          <div className="touchdown-banner-title">TOUCHDOWN!</div>
          <div className="touchdown-banner-sub">{touchdownBanner.scored ? 'You scored' : 'Opponent scored'}</div>
        </div>
      )}
      {kickResult && !gameOver && (
        <div className="kick-result-banner" aria-live="polite">{kickResult}</div>
      )}
      {playNotice && !gameOver && !touchdownBanner && (
        <div className="play-notice" aria-live="polite">{playNotice}</div>
      )}
      {halftime && !gameOver && (
        <div className="touchdown-banner">
          <div className="touchdown-banner-title">HALFTIME</div>
        </div>
      )}
      {gameOver && (
        <div className="gameover-overlay">
          <div className="gameover-sub">Final</div>
          <div className={`gameover-title gameover-title--${gameOver.result}`}>
            {gameOver.result === 'win' ? 'You Win!' : gameOver.result === 'loss' ? 'You Lose' : 'Tie Game'}
          </div>
          <div className="gameover-scoreboard">
            <div className="gameover-team">
              <div className="gameover-team-label">You</div>
              <div className="gameover-team-score">{gameOver.score.offense}</div>
            </div>
            <div className="gameover-dash">—</div>
            <div className="gameover-team">
              <div className="gameover-team-label">Opponent</div>
              <div className="gameover-team-score">{gameOver.score.defense}</div>
            </div>
          </div>
          <button className="gameover-btn" onPointerDown={handlePlayAgain}>Play Again</button>
        </div>
      )}
      {formationErrors.length > 0 && (
        <div className="formation-banner" aria-live="polite">
          {formationErrors.map((msg, i) => (
            <div key={i} className="formation-error">{msg}</div>
          ))}
        </div>
      )}
      {role === 'offense' && isPreSnap && !kickInProgress && (
        <div className="play-design-controls">
          {playType === 'run' && (
            <div className="run-angle-controls">
              <button
                className="run-angle-btn"
                onPointerDown={() => handleRunAngle(-10)}
                disabled={runAngle <= -60}
              >◄</button>
              <span className="run-angle-label">
                {runAngle === 0 ? 'FWD' : runAngle < 0 ? `L ${Math.abs(runAngle)}°` : `R ${runAngle}°`}
              </span>
              <button
                className="run-angle-btn"
                onPointerDown={() => handleRunAngle(10)}
                disabled={runAngle >= 60}
              >►</button>
            </div>
          )}
          <div className="play-type-toggle">
            <button
              className={`play-type-btn${playType === 'run' ? ' play-type-btn--run' : ''}`}
              onPointerDown={() => handlePlayType('run')}
            >RUN</button>
            <button
              className={`play-type-btn${playType === 'pass' ? ' play-type-btn--pass' : ''}`}
              onPointerDown={() => handlePlayType('pass')}
            >PASS</button>
          </div>
        </div>
      )}
      {role === 'offense' && formationErrors.length === 0 && phase === 'pre_snap' && (
        <button
          className={`formation-ready-btn${lockedFormation ? ' formation-ready-btn--set' : ''}`}
          onPointerDown={lockedFormation ? undefined : handleLockFormation}
        >
          {lockedFormation ? 'Formation Set' : 'Set Formation'}
        </button>
      )}
      {phase === 'countdown' && hikeCount !== null && hikeCount > 0 && (
        <div className="hike-countdown-banner">
          Offense is set… {hikeCount}
        </div>
      )}
      {role === 'offense' && phase === 'countdown' && (
        <button className="hike-btn" onPointerDown={handleHike} disabled={!hikeReady}>
          HIKE!
        </button>
      )}
      {role === 'offense' && phase === 'live' && playType === 'pass' && !scrambling && !thrownRef.current && throwawayPos && (
        <button
          className="throwaway-btn"
          style={{ top: `${throwawayPos.top}%`, left: `${throwawayPos.left}%` }}
          onPointerDown={handleThrowaway}
        >
          Throw Away
        </button>
      )}
      {showRouteMenu && selectedPlayer && (
        <RouteMenu
          playerId={selectedPlayer.id}
          position={selectedPlayer.label!}
          currentRoute={playerRoutes[selectedPlayer.id]}
          onSelect={handleRouteSelect}
        />
      )}
      {showCoverageMenu && selectedPlayer && (
        <CoverageMenu
          playerId={selectedPlayer.id}
          position={selectedPlayer.label!}
          currentCoverage={playerCoverage[selectedPlayer.id]}
          currentZoneType={zoneTypes[selectedPlayer.id]}
          onSelect={handleCoverageSelect}
          onClear={handleClearAssignment}
        />
      )}
      {canRemoveSelected && (
        <button className={`remove-player-btn ${role === "offense" ? "remove-offense" : "remove-defense"}`} onPointerDown={() => handleRemove(selectedId!)}>
          ✕ Remove
        </button>
      )}
      {role === 'offense' && isPreSnap && !kickInProgress && (
        <RosterSidebar
          players={availableOffense}
          team="o"
          side="left"
          onDrop={handleDrop}
          fieldCount={fieldCount}
          limitReached={limitReached}
          fatigueOn={fatigueVisible}
          onToggleFatigue={() => setFatigueVisible(v => !v)}
        />
      )}
      {role === 'defense' && !kickInProgress && (
        <RosterSidebar
          players={availableDefense}
          team="d"
          side="right"
          onDrop={handleDrop}
          fieldCount={fieldCount}
          limitReached={limitReached}
          fatigueOn={fatigueVisible}
          onToggleFatigue={() => setFatigueVisible(v => !v)}
        />
      )}
    </div>
  )
}
