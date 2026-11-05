import { useMemo, useState } from 'react'
import { teamColors, accentColor } from '../data/teamColors.ts'
import TeamLogo from '../components/TeamLogo.tsx'
import { Confetti, Lombardi } from './art.tsx'
import { ordinal, recordText, superBowlArt, teamName, teamNick } from './format.ts'
import { saveTrophyImage, trophyFromSeason } from './trophyImage.ts'
import type { SeasonScreen, SeasonView } from './types.ts'

// The moments the season stops for: into the playoffs, out of them, a conference title, and the
// Super Bowl. Each is acknowledged once, and they are kept on the save until they have been, so a crash
// or a closed app cannot skip one.

interface Props {
  season: SeasonView
  screen: SeasonScreen
  onContinue: () => void
}

export default function Celebration({ season, screen, onContinue }: Props) {
  const { primary, secondary } = teamColors(season.teamId)
  const accent = accentColor(season.teamId)
  const colors = useMemo(() => [primary, secondary, accent, '#ffffff'], [primary, secondary, accent])
  const [saving, setSaving] = useState(false)

  async function saveTrophy() {
    setSaving(true)
    try { await saveTrophyImage(trophyFromSeason(season)) } finally { setSaving(false) }
  }

  const style = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ['--p' as any]: primary, ['--a' as any]: accent,
  }

  if (screen.type === 'super_bowl_champion') {
    return (
      <div className="celebrate celebrate--gold" style={style}>
        <Confetti colors={colors} seconds={14} />
        <div className="celebrate-inner celebrate-inner--champ">
          <img className="celebrate-sb" src={superBowlArt(season.year)} alt={`Super Bowl ${season.superBowl.numeral}`} draggable={false} />
          <Lombardi className="celebrate-lombardi" />
          <div className="celebrate-copy">
            <div className="celebrate-kicker">Super Bowl {season.superBowl.numeral} Champions</div>
            <h1 className="celebrate-title">{teamName(season.teamId)}</h1>
            <p className="celebrate-sub">{season.year} season · {recordText(season.record)}</p>
            <div className="celebrate-actions">
              <button className="season-btn season-btn--accent" onClick={saveTrophy} disabled={saving}>
                {saving ? 'Saving…' : 'Save Trophy'}
              </button>
              <button className="season-btn" onClick={onContinue}>Continue</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (screen.type === 'conference_champion') {
    return (
      <div className="celebrate" style={style}>
        <Confetti colors={colors} />
        <div className="celebrate-inner">
          <TeamLogo teamId={season.teamId} size={132} selected />
          <div className="celebrate-kicker">{season.year} {screen.conference} Champions</div>
          <h1 className="celebrate-title">{teamName(season.teamId)}</h1>
          <p className="celebrate-sub">You are going to Super Bowl {season.superBowl.numeral}.</p>
          <button className="season-btn season-btn--accent" onClick={onContinue}>On to the Super Bowl</button>
        </div>
      </div>
    )
  }

  if (screen.type === 'made_playoffs') {
    return (
      <div className="celebrate" style={style}>
        <div className="celebrate-inner">
          <TeamLogo teamId={season.teamId} size={118} selected />
          <div className="celebrate-kicker">Congratulations</div>
          <h1 className="celebrate-title">You made the playoffs</h1>
          <p className="celebrate-sub">
            {recordText(season.record)} and the {ordinal(screen.seed)} seed in the {teamConference(season)}.
            {screen.bye ? ' You have the week off, and home field all the way.' : ''}
          </p>
          <button className="season-btn season-btn--accent" onClick={onContinue}>Continue</button>
        </div>
      </div>
    )
  }

  if (screen.type === 'eliminated') {
    return (
      <div className="celebrate celebrate--over" style={style}>
        <div className="celebrate-inner">
          <TeamLogo teamId={season.teamId} size={104} />
          <div className="celebrate-kicker">Season over</div>
          <h1 className="celebrate-title">Eliminated</h1>
          <p className="celebrate-sub">The {teamNick(screen.by)} ended your run in the {screen.round}.</p>
          <button className="season-btn" onClick={onContinue}>See how it ended</button>
        </div>
      </div>
    )
  }

  // Missed the playoffs.
  return (
    <div className="celebrate celebrate--over" style={style}>
      <div className="celebrate-inner">
        <TeamLogo teamId={season.teamId} size={104} />
        <div className="celebrate-kicker">Season over</div>
        <h1 className="celebrate-title">No playoffs this year</h1>
        <p className="celebrate-sub">You finished {recordText(season.record)}, which was not enough.</p>
        <button className="season-btn" onClick={onContinue}>See how it ended</button>
      </div>
    </div>
  )
}

function teamConference(season: SeasonView): string {
  return season.playoffs?.seeds.AFC.includes(season.teamId) ? 'AFC' : 'NFC'
}
