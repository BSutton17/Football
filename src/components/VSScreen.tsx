import { useEffect, useMemo, useState } from 'react'
import { NFL_TEAMS, type NflTeam } from '../data/nflTeams.ts'
import type { RosterPlayer } from '../types/player.ts'
import type { TeamPick } from '../hooks/useRoom.ts'
import { teamColors, accentColor } from '../data/teamColors.ts'
import { teamLogo } from '../data/teamLogos.ts'
import { computeTeamRatings } from '../data/teamRatings.ts'
import TeamLogo from './TeamLogo.tsx'

// [298] Preload a set of image URLs, reporting 0–1 progress so the screen can show the game
// preparing. Resolves each image (success or error) so a missing asset never stalls the bar.
function useImagePreload(urls: string[]): number {
  const [done, setDone] = useState(0)
  const key = urls.join('|')
  useEffect(() => {
    setDone(0)
    if (urls.length === 0) { setDone(0); return }
    let live = true
    let count = 0
    const bump = () => { if (live) setDone(++count) }
    for (const url of urls) {
      const img = new Image()
      img.onload = bump
      img.onerror = bump
      img.src = url
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return urls.length ? done / urls.length : 1
}

interface Props {
  picks: Record<number, TeamPick>
  slot: number | null
  onContinue: () => void
}

const HOLD_MS = 5200   // how long the VS intro plays before auto-advancing to kickoff

function topThree(team: NflTeam): RosterPlayer[] {
  return [
    ...(team.qb ? [team.qb] : []),
    ...team.offense,
    ...(team.oline ?? []),
    ...team.defense,
    ...(team.dline ?? []),
  ].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0)).slice(0, 3)
}

// [VS screen] The hype moment after both players lock in: a full split — each team a full-width
// band in its colors with a massive phrase, logo, rating and top players — joined by a glowing VS.
// Slowly zooms, then hands off to kickoff (tap to skip).
export default function VSScreen({ picks, slot, onContinue }: Props) {
  const byId = useMemo(() => new Map(NFL_TEAMS.map(t => [t.id, t])), [])
  const top = byId.get(picks[0]?.teamId ?? '')
  const bot = byId.get(picks[1]?.teamId ?? '')

  // [298] Preload the matchup logos so the progress bar reflects real asset readiness.
  const logoUrls = useMemo(
    () => [picks[0]?.teamId, picks[1]?.teamId].map(id => (id ? teamLogo(id) : null)).filter((s): s is string => !!s),
    [picks],
  )
  const progress = useImagePreload(logoUrls)
  const ready = progress >= 1

  // Auto-advance to kickoff once assets are ready (or immediately if a team is somehow missing).
  useEffect(() => {
    if (!top || !bot) { const t = setTimeout(onContinue, 50); return () => clearTimeout(t) }
    if (!ready) return   // hold on the prep screen until the matchup assets finish loading
    const t = setTimeout(onContinue, HOLD_MS)
    return () => clearTimeout(t)
  }, [onContinue, top, bot, ready])

  if (!top || !bot) return null

  return (
    // Non-interactive — both players wait through the intro (no tap-to-skip), so they stay in sync.
    <div className="vs2">
      <Band team={top} mine={slot === 0} position="top" />
      <div className="vs2-seam">
        <span className="vs2-badge">VS</span>
      </div>
      <Band team={bot} mine={slot === 1} position="bottom" />
      {ready ? (
        <div className="vs2-hint vs2-hint--static">Kicking off…</div>
      ) : (
        <div className="vs2-loading">
          <div className="vs2-loading-label">Preparing matchup… {Math.round(progress * 100)}%</div>
          <div className="vs2-loading-track"><div className="vs2-loading-fill" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}
    </div>
  )
}

function Band({ team, mine, position }: { team: NflTeam; mine: boolean; position: 'top' | 'bottom' }) {
  const c = teamColors(team.id)
  const { overall } = computeTeamRatings(team)
  const stars = topThree(team)
  return (
    <div
      className={`vs2-band vs2-band--${position}`}
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--p' as any]: c.primary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--s' as any]: c.secondary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--accent' as any]: accentColor(team.id),
      }}
    >
      <div className="vs2-band-bg" aria-hidden>
        <div className="vs2-band-beam" />
        <div className="vs2-band-particles" />
      </div>

      {mine && <span className="vs2-you">YOU</span>}
      {team.phrase && <div className="vs2-phrase">{team.phrase}</div>}

      <div className="vs2-row">
        <TeamLogo teamId={team.id} size={104} selected />
        <div className="vs2-meta">
          <div className="vs2-name">{team.name}</div>
          <div className="vs2-ovr">{overall} <span>OVR</span></div>
          <div className="vs2-stars">
            {stars.map(p => (
              <span key={p.id} className="vs2-star">
                <b>{p.ovr}</b> {p.position} {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
