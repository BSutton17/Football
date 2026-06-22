import { useState, useMemo, useEffect, useRef } from 'react'
import { NFL_TEAMS, type NflTeam } from '../data/nflTeams.ts'
import type { RosterPlayer, TeamRole } from '../types/player.ts'
import type { TeamPick } from '../hooks/useRoom.ts'
import { computeTeamRatings } from '../data/teamRatings.ts'
import { teamColors, accentColor } from '../data/teamColors.ts'
import TeamLogo from './TeamLogo.tsx'
import PlayerCard from './PlayerCard.tsx'

interface Props {
  role: TeamRole | null
  slot: number | null
  validTeamIds: string[]
  picks: Record<number, TeamPick>
  pickError: string | null
  onSelect: (teamId: string) => void
  onLock: (teamId: string) => void
}

function rankedRoster(team: NflTeam): RosterPlayer[] {
  return [
    ...(team.qb ? [team.qb] : []),
    ...team.offense,
    ...(team.oline ?? []),
    ...team.defense,
    ...(team.dline ?? []),
  ].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))
}

// [team select] A primetime, CFB25-inspired team picker for portrait mobile: an animated stadium
// stage themed to the focused team — massive brush-font phrase behind a big logo, top-three
// trading cards, an opponent matchup strip, and a swipeable team carousel with a Random button.
export default function TeamSelectScreen({ role, slot, validTeamIds, picks, pickError, onSelect, onLock }: Props) {
  const teams: NflTeam[] = useMemo(() => {
    const byId = new Map(NFL_TEAMS.map(t => [t.id, t]))
    const ids = validTeamIds.length ? validTeamIds : NFL_TEAMS.map(t => t.id)
    return ids.map(id => byId.get(id)).filter((t): t is NflTeam => !!t)
  }, [validTeamIds])

  const mySlot  = slot ?? 0
  const oppSlot = 1 - mySlot
  const myPick  = picks[mySlot] ?? null
  const oppPick = picks[oppSlot] ?? null
  const myLocked = !!myPick?.locked

  const [focusedId, setFocusedId] = useState<string | null>(null)
  useEffect(() => {
    setFocusedId(prev => prev ?? myPick?.teamId ?? teams[0]?.id ?? null)
  }, [teams, myPick?.teamId])

  // Whether the team carousel ("scroll bar") is shown — toggled from the footer so it can be
  // hidden to free up room for the team's content.
  const [railVisible, setRailVisible] = useState(true)

  const focused = teams.find(t => t.id === focusedId) ?? teams[0] ?? null

  // Keep the focused team centered in the carousel (re-centers when the rail is re-shown too).
  const railRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusedId || !railVisible || !railRef.current) return
    const el = railRef.current.querySelector<HTMLElement>(`[data-tid="${focusedId}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [focusedId, railVisible])

  function focus(teamId: string) {
    setFocusedId(teamId)
    if (!myLocked) onSelect(teamId)   // browsing broadcasts a provisional pick
  }

  // [282] A team the opponent has LOCKED is off-limits — can't be locked here.
  const oppLockedId = oppPick?.locked ? oppPick.teamId : null

  function randomTeam() {
    if (teams.length === 0) return
    const pool = teams.filter(t => t.id !== focusedId && t.id !== oppLockedId)
    const src  = pool.length ? pool : teams.filter(t => t.id !== oppLockedId)
    if (src.length === 0) return
    focus(src[Math.floor(Math.random() * src.length)].id)
  }

  const nameOf = (id?: string) => (id ? teams.find(t => t.id === id)?.name ?? id : '')
  const oppColors = oppPick ? teamColors(oppPick.teamId) : null

  if (!focused) return null
  const takenByOpp = oppLockedId === focused.id   // [282] focused team is claimed by the opponent
  const fc = teamColors(focused.id)
  const { overall, offense, defense } = computeTeamRatings(focused)
  const top3 = rankedRoster(focused).slice(0, 3)

  return (
    <div
      className="ts2-screen"
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--p' as any]: fc.primary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--s' as any]: fc.secondary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--accent' as any]: accentColor(focused.id),
      }}
    >
      {/* Animated stadium backdrop */}
      <div className="ts2-bg" aria-hidden>
        <div className="ts2-bg-wash" key={`wash-${focused.id}`} />
        <div className="ts2-bg-beam ts2-bg-beam--a" />
        <div className="ts2-bg-beam ts2-bg-beam--b" />
        <div className="ts2-bg-smoke" />
        <div className="ts2-bg-particles" />
      </div>

      {/* Opponent matchup strip */}
      <header
        className={`ts2-opp${oppPick?.locked ? ' ts2-opp--locked' : ''}`}
        style={oppColors ? {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--op' as any]: oppColors.primary,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--os' as any]: oppColors.secondary,
        } : undefined}
      >
        <div className="ts2-opp-side">
          {oppPick ? <TeamLogo teamId={oppPick.teamId} size={34} /> : <span className="ts2-opp-dot" />}
          <div className="ts2-opp-text">
            <span className="ts2-opp-label">OPPONENT</span>
            <span className="ts2-opp-name">
              {oppPick ? (oppPick.locked ? `${nameOf(oppPick.teamId)} ✓` : nameOf(oppPick.teamId)) : 'Choosing…'}
            </span>
          </div>
        </div>
        <span className="ts2-opp-vs">VS</span>
        <div className="ts2-opp-me">
          <span className="ts2-opp-label">YOU</span>
          {role && <span className={`ts2-role ts2-role--${role}`}>{role === 'offense' ? 'OFFENSE' : 'DEFENSE'}</span>}
        </div>
      </header>

      {/* Stage — re-keyed per team so the entrance animations replay on each change */}
      <main className="ts2-stage" key={focused.id}>
        <div className="ts2-phrase-wrap">
          {focused.phrase && <div className="ts2-phrase">{focused.phrase}</div>}
        </div>

        <div className="ts2-logo">
          <TeamLogo teamId={focused.id} size={128} selected />
        </div>

        <div className="ts2-name">{focused.name}</div>

        <div className="ts2-ratings">
          <div className="ts2-ovr">
            <span className="ts2-ovr-num">{overall}</span>
            <span className="ts2-ovr-lbl">OVR</span>
          </div>
          <div className="ts2-subovr"><b>{offense}</b><span>OFF</span></div>
          <div className="ts2-subovr"><b>{defense}</b><span>DEF</span></div>
        </div>

        <div className="ts2-cards">
          {top3.map((p, i) => (
            <PlayerCard key={p.id} player={p} teamId={focused.id} index={i} />
          ))}
        </div>
      </main>

      {/* Carousel + actions */}
      <footer className="ts2-footer">
        {railVisible && (
        <div className="ts2-rail" ref={railRef}>
          {teams.map(t => {
            const isFocused = t.id === focused.id
            const isMine    = myPick?.teamId === t.id
            const isOpp     = oppPick?.teamId === t.id
            const isTaken   = oppLockedId === t.id
            return (
              <button
                key={t.id}
                data-tid={t.id}
                type="button"
                className={`ts2-chip${isFocused ? ' ts2-chip--focused' : ''}${isMine ? ' ts2-chip--mine' : ''}${isTaken ? ' ts2-chip--taken' : ''}`}
                onClick={() => focus(t.id)}
                aria-label={isTaken ? `${t.name} (taken)` : t.name}
              >
                <TeamLogo teamId={t.id} size={isFocused ? 52 : 40} selected={isFocused} />
                {isTaken
                  ? <span className="ts2-chip-taken" title="Taken by opponent">🔒</span>
                  : isOpp && <span className="ts2-chip-opp" title="Opponent's pick">●</span>}
              </button>
            )
          })}
        </div>
        )}

        <div className="ts2-actions">
          <button className="ts2-random" onClick={randomTeam} disabled={myLocked}>🎲</button>
          <button
            className="ts2-railtoggle"
            onClick={() => setRailVisible(v => !v)}
            aria-pressed={!railVisible}
            title={railVisible ? 'Hide teams' : 'Show teams'}
          >
            {railVisible ? '🙈 Hide' : '👁 Teams'}
          </button>
          {myLocked ? (
            <div className="ts2-locked">
              <span className="ts2-locked-team">✓ {nameOf(myPick?.teamId)} locked</span>
              <button className="ts2-change" onClick={() => onSelect(focused.id)}>Change</button>
            </div>
          ) : (
            <button className="ts2-lock" onClick={() => onLock(focused.id)} disabled={takenByOpp}>
              {takenByOpp ? 'TEAM TAKEN' : 'LOCK IN'}
            </button>
          )}
        </div>
        {pickError && !myLocked && <div className="ts2-pickerror">{pickError}</div>}
        {myLocked && <div className="ts2-waiting">Waiting for opponent…</div>}
      </footer>
    </div>
  )
}
