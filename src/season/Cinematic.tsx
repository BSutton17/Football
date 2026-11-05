import { useEffect, useMemo, useRef, useState } from 'react'
import { teamColors, accentColor, textColorOn } from '../data/teamColors.ts'
import { teamById } from '../data/nflTeams.ts'
import TeamLogo from '../components/TeamLogo.tsx'
import { isUserIn, opponentIn } from './format.ts'
import type { SeasonView } from './types.ts'

// ── The new-season title sequence ([seasons]) ──────────────────────────────
//
// Eight seconds, tap to skip. Graphics and light rather than footage, in the team's own colours:
//
//   1. The year comes up out of the dark under two moving lights.
//   2. The road ahead: this team's real seventeen opponents slam in one after another.
//   3. A flash, the screen floods with the team's colour, and the logo lands with a shockwave and a
//      shake. The team's own rallying cry goes up behind it.
//   4. Where it starts: Week 1.
//
// It only ever plays once, when a season is created.

const LOGO_STEP_MS = 95
const ROAD_AT_MS = 1700
const SLAM_AT_MS = 4300
const OPENER_AT_MS = 6400
const END_AT_MS = 8000

export default function Cinematic({ season, onDone }: { season: SeasonView; onDone: () => void }) {
  const opponents = useMemo(() => {
    return season.games.filter(g => isUserIn(g, season.teamId)).map(g => opponentIn(g, season.teamId))
  }, [season])
  const opener = useMemo(() => season.games.find(g => isUserIn(g, season.teamId)) ?? null, [season])

  const team = teamById(season.teamId)
  const { primary, secondary } = teamColors(season.teamId)
  const accent = accentColor(season.teamId)

  const [stage, setStage] = useState(0)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), ROAD_AT_MS),
      window.setTimeout(() => setStage(2), SLAM_AT_MS),
      window.setTimeout(() => setStage(3), OPENER_AT_MS),
      window.setTimeout(() => done.current(), END_AT_MS),
    ]
    return () => timers.forEach(t => window.clearTimeout(t))
  }, [])

  const openerHome = opener?.home === season.teamId
  const openerOpp = opener ? opponentIn(opener, season.teamId) : null

  return (
    <div
      className={`cine cine--stage${stage}`}
      onPointerDown={onDone}
      role="button"
      aria-label="Skip"
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--p' as any]: primary, ['--s' as any]: secondary, ['--a' as any]: accent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--on-p' as any]: textColorOn(primary),
      }}
    >
      <div className="cine-beams" aria-hidden>
        <div className="cine-beam cine-beam--a" />
        <div className="cine-beam cine-beam--b" />
      </div>

      {stage === 0 && (
        <div className="cine-year" key="year">
          <div className="cine-year-num">{season.year}</div>
          <div className="cine-year-label">The season begins</div>
        </div>
      )}

      {stage === 1 && (
        <div className="cine-road" key="road">
          <div className="cine-road-title">Seventeen games. One Victor.</div>
          <div className="cine-road-grid">
            {opponents.map((id, i) => (
              <div className="cine-road-logo" key={`${id}-${i}`} style={{ animationDelay: `${i * LOGO_STEP_MS}ms` }}>
                <TeamLogo teamId={id} size={56} />
              </div>
            ))}
          </div>
        </div>
      )}

      {stage >= 2 && <div className="cine-flash" key="flash" />}
      {stage >= 2 && (
        <div className="cine-slam" key="slam">
          <div className="cine-flood" />
          <div className="cine-shock" />
          <div className="cine-shock cine-shock--late" />
          {team?.phrase && <div className="cine-phrase">{team.phrase}</div>}
          <div className="cine-logo"><TeamLogo teamId={season.teamId} size={190} selected /></div>
          <div className="cine-name">{team?.name}</div>
          {stage === 3 && openerOpp && (
            <div className="cine-opener">
              Week 1 · {openerHome ? 'vs' : 'at'} {teamById(openerOpp)?.name}
            </div>
          )}
        </div>
      )}

      <div className="cine-skip">Tap to skip</div>
    </div>
  )
}
