import { useMemo, useState } from 'react'
import TeamLogo from '../components/TeamLogo.tsx'
import { accentColor, teamColors } from '../data/teamColors.ts'
import { teamById } from '../data/nflTeams.ts'
import { Lombardi } from './art.tsx'
import { AwardList, AWARDS_FOOTNOTE } from './AwardShow.tsx'
import {
  isUserIn, lastPlayed, lineFor, modeLine, opponentIn, ordinal, outcomeFor, passerRating, projectedLine, recordText, scheduleRows,
  scoreFor, superBowlArt, teamAbbr, teamName,
} from './format.ts'
import { saveTrophyImage, trophyFromSeason } from './trophyImage.ts'
import type { SeasonGame, SeasonLine, SeasonView, TeamStatRow } from './types.ts'

type Tab = 'schedule' | 'scores' | 'standings' | 'playoffs' | 'stats'
const TAB_NAMES: Record<Tab, string> = { schedule: 'Schedule', scores: 'Scores', standings: 'Standings', playoffs: 'Playoffs', stats: 'Stats' }

interface Props {
  season: SeasonView
  busy: boolean
  onBack: () => void
  onPlay: () => void
  onSim: () => void
}

export default function SeasonHome({ season, busy, onBack, onPlay, onSim }: Props) {
  const [tab, setTab] = useState<Tab>(() => (season.phase === 'regular' ? 'schedule' : 'playoffs'))
  const accent = accentColor(season.teamId)
  const { primary } = teamColors(season.teamId)
  const line = lineFor(season.standings, season.teamId)
  const played = season.record.w + season.record.l + season.record.t > 0
  const club = teamById(season.teamId)
  const divisionName = club ? `${club.conference} ${club.division}` : ''

  return (
    <div
      className="season-screen season-home"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={{ ['--a' as any]: accent, ['--p' as any]: primary }}
    >
      <header className="season-bar">
        <button className="season-back" onClick={onBack} aria-label="Back to saves">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
        </button>
        <TeamLogo teamId={season.teamId} size={38} />
        <div className="season-bar-text">
          <div className="season-bar-name">{teamName(season.teamId)}</div>
          <div className="season-bar-sub">
            {season.year} · {recordText(season.record)}{line && played ? ` · ${ordinal(line.place)} in ${divisionName}` : ''}
          </div>
        </div>
      </header>

      <div className="season-home-body">
        <NextUp season={season} busy={busy} onPlay={onPlay} onSim={onSim} />

        <div className="season-panel">
          <nav className="season-tabs" role="tablist">
            {(Object.keys(TAB_NAMES) as Tab[]).map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`season-tab${tab === t ? ' season-tab--on' : ''}`}
                onClick={() => setTab(t)}
              >
                {TAB_NAMES[t]}
              </button>
            ))}
          </nav>
          <div className="season-tabbody">
            {tab === 'schedule' && <ScheduleTab season={season} />}
            {tab === 'scores' && <ScoresTab season={season} />}
            {tab === 'standings' && <StandingsTab season={season} />}
            {tab === 'playoffs' && <PlayoffsTab season={season} />}
            {tab === 'stats' && <StatsTab season={season} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── What is next ─────────────────────────────────────────────────────────

function NextUp({ season, busy, onPlay, onSim }: Omit<Props, 'onBack'>) {
  const [confirming, setConfirming] = useState(false)
  const game = season.currentGame
  const last = lastPlayed(season)
  const lastLine = last ? (
    <div className="next-last">
      Last game: <b className={`outcome outcome--${outcomeFor(last, season.teamId)}`}>{outcomeFor(last, season.teamId)}</b>{' '}
      {scoreFor(last, season.teamId)} {last.home === season.teamId ? 'vs' : 'at'} {teamAbbr(opponentIn(last, season.teamId))}
    </div>
  ) : null

  if (season.phase === 'complete') return <SeasonOver season={season} />

  const label = season.phase === 'playoffs' ? season.roundName : `Week ${season.week}`

  if (!game) {
    const isPlayoffBye = season.phase === 'playoffs'
    return (
      <section className="next">
        <div className="next-label">{label}</div>
        <div className="next-bye">{isPlayoffBye ? 'First-round bye' : 'Bye week'}</div>
        <p className="season-muted">{isPlayoffBye ? 'You earned the week off. Everyone else plays.' : 'No game this week. The rest of the league plays.'}</p>
        <div className="next-actions">
          <button className="season-btn season-btn--accent" disabled={busy} onClick={onSim}>
            {busy ? 'Simulating…' : 'Continue'}
          </button>
        </div>
        {lastLine}
      </section>
    )
  }

  const opp = opponentIn(game, season.teamId)
  const home = game.home === season.teamId
  const oppLine = lineFor(season.standings, opp)
  const superBowl = game.round === 4
  const inProgress = season.activeGameId === game.id

  return (
    <section className={`next${superBowl ? ' next--sb' : ''}`}>
      <div className="next-label">{superBowl ? `Super Bowl ${season.superBowl.numeral}` : label}</div>

      <div className="next-match">
        <div className="next-team">
          <TeamLogo teamId={season.teamId} size={72} />
          <div className="next-abbr">{teamAbbr(season.teamId)}</div>
          <div className="next-rec">{game.homeSeed || game.awaySeed ? `#${home ? game.homeSeed : game.awaySeed} seed` : recordText(season.record)}</div>
        </div>
        <div className="next-vs">
          {superBowl
            ? <img className="next-sbart" src={superBowlArt(season.year)} alt="" draggable={false} />
            : <span>{game.neutral ? 'vs' : home ? 'vs' : 'at'}</span>}
        </div>
        <div className="next-team">
          <TeamLogo teamId={opp} size={72} />
          <div className="next-abbr">{teamAbbr(opp)}</div>
          <div className="next-rec">{game.homeSeed || game.awaySeed ? `#${home ? game.awaySeed : game.homeSeed} seed` : recordText(oppLine)}</div>
        </div>
      </div>

      <div className="next-where">
        {superBowl ? 'Neutral site. Neither team has home field.'
          : game.neutral ? 'Neutral site. Neither team has home field.'
          : home ? 'Home game. Your players earn X-Factors a little easier.'
          : `Road game. The ${teamName(opp).split(' ').slice(-1)[0]} have home field.`}
      </div>

      {inProgress ? (
        <div className="next-actions">
          <button className="season-btn season-btn--accent season-btn--big" disabled={busy} onClick={onPlay}>Resume Game</button>
        </div>
      ) : confirming ? (
        <div className="next-confirm">
          <p>Simulate this game? The result is final.</p>
          <div className="next-actions">
            <button className="season-btn" disabled={busy} onClick={() => { setConfirming(false); onSim() }}>Simulate</button>
            <button className="season-btn season-btn--ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="next-actions">
          <button className="season-btn season-btn--accent season-btn--big" disabled={busy} onClick={onPlay}>Play</button>
          <button className="season-btn" disabled={busy} onClick={() => setConfirming(true)}>{busy ? 'Simulating…' : 'Sim'}</button>
        </div>
      )}
      {lastLine}
      <div className="next-mode">{modeLine(season)}</div>
    </section>
  )
}

function SeasonOver({ season }: { season: SeasonView }) {
  const champion = season.champion
  const won = season.finish === 'champion'
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try { await saveTrophyImage(trophyFromSeason(season)) } finally { setSaving(false) }
  }

  return (
    <section className={`next next--over${won ? ' next--won' : ''}`}>
      <div className="next-label">{season.year} season complete</div>
      {won && <Lombardi className="next-lombardi" />}
      {!won && champion && <TeamLogo teamId={champion} size={84} />}
      <div className="next-bye">{won ? 'Super Bowl champions' : `${teamName(champion)} won it all`}</div>
      <p className="season-muted">
        {won ? 'You did it. ' : ''}You finished {recordText(season.record)}
        {season.finish === 'missed' ? ' and missed the playoffs.' : season.finish === 'eliminated' ? ' and went out in the playoffs.' : '.'}
      </p>
      {won && (
        <div className="next-actions">
          <button className="season-btn season-btn--accent" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Trophy'}</button>
        </div>
      )}
      <p className="season-muted season-small">There is one season per save. Start a new one from the save screen to play again.</p>
    </section>
  )
}

// ── Schedule ─────────────────────────────────────────────────────────────

function ScheduleTab({ season }: { season: SeasonView }) {
  const rows = scheduleRows(season)
  return (
    <ul className="sched">
      {rows.map(({ week, game }) => {
        const current = season.phase === 'regular' && week === season.week
        if (!game) {
          return (
            <li key={week} className={`sched-row sched-row--bye${current ? ' sched-row--now' : ''}`}>
              <span className="sched-week">{week}</span>
              <span className="sched-opp">Bye</span>
            </li>
          )
        }
        const opp = opponentIn(game, season.teamId)
        const result = outcomeFor(game, season.teamId)
        return (
          <li key={week} className={`sched-row${current ? ' sched-row--now' : ''}`}>
            <span className="sched-week">{week}</span>
            <span className="sched-at">{game.home === season.teamId ? 'vs' : 'at'}</span>
            <TeamLogo teamId={opp} size={26} />
            <span className="sched-opp">{teamName(opp)}</span>
            {result
              ? <span className="sched-result"><b className={`outcome outcome--${result}`}>{result}</b> {scoreFor(game, season.teamId)}</span>
              : <span className="sched-result sched-result--tbd">{game.neutral ? 'Neutral' : ''}</span>}
          </li>
        )
      })}
    </ul>
  )
}

// ── Scores ───────────────────────────────────────────────────────────────

function ScoresTab({ season }: { season: SeasonView }) {
  const newestFinished = useMemo(() => {
    let w = 1
    for (const g of season.games) if (g.status === 'final' && (g.week ?? 0) > w) w = g.week!
    return w
  }, [season.games])
  const [week, setWeek] = useState(newestFinished)
  const games = season.games.filter(g => g.week === week)

  return (
    <div>
      <div className="week-pills">
        {Array.from({ length: 18 }, (_, i) => i + 1).map(w => (
          <button key={w} className={`week-pill${w === week ? ' week-pill--on' : ''}`} onClick={() => setWeek(w)}>{w}</button>
        ))}
      </div>
      <ul className="scores">
        {games.map(g => <ScoreRow key={g.id} game={g} teamId={season.teamId} />)}
      </ul>
    </div>
  )
}

function ScoreRow({ game, teamId, labelSeeds = false }: { game: SeasonGame; teamId: string; labelSeeds?: boolean }) {
  const final = game.status === 'final'
  const awayWon = final && game.as! > game.hs!
  const homeWon = final && game.hs! > game.as!
  const mine = isUserIn(game, teamId)
  const side = (id: string, score: number | undefined, won: boolean, seed?: number | null) => (
    <div className={`score-side${won ? ' score-side--won' : ''}`}>
      {labelSeeds && seed ? <span className="score-seed">{seed}</span> : null}
      <TeamLogo teamId={id} size={24} />
      <span className="score-abbr">{teamAbbr(id)}</span>
      <span className="score-num">{final ? score : ''}</span>
    </div>
  )
  return (
    <li className={`score${mine ? ' score--mine' : ''}`}>
      {side(game.away, game.as, awayWon, game.awaySeed)}
      {side(game.home, game.hs, homeWon, game.homeSeed)}
      {final && game.ot && <span className="score-ot">OT</span>}
      {!final && <span className="score-ot">{game.neutral ? 'Neutral' : ''}</span>}
    </li>
  )
}

// ── Standings ────────────────────────────────────────────────────────────

const conferenceOf = (season: SeasonView): 'AFC' | 'NFC' =>
  Object.values(season.standings.AFC).some(d => d.some(l => l.id === season.teamId)) ? 'AFC' : 'NFC'

function StandingsTab({ season }: { season: SeasonView }) {
  const [conf, setConf] = useState<'AFC' | 'NFC'>(() => conferenceOf(season))
  const seeds = season.playoffs?.seeds[conf] ?? []

  return (
    <div>
      <div className="conf-toggle">
        {(['AFC', 'NFC'] as const).map(c => (
          <button key={c} className={`conf-btn${conf === c ? ' conf-btn--on' : ''}`} onClick={() => setConf(c)}>{c}</button>
        ))}
      </div>
      <div className="standings-grid">
        {(['East', 'North', 'South', 'West'] as const).map(div => (
          <table className="standings" key={div}>
            <thead>
              <tr>
                <th className="standings-team">{conf} {div}</th>
                <th>W</th><th>L</th><th>T</th><th>DIV</th><th>PF</th><th>PA</th>
              </tr>
            </thead>
            <tbody>
              {season.standings[conf][div].map(l => {
                const seed = seeds.indexOf(l.id) + 1
                return (
                  <tr key={l.id} className={l.id === season.teamId ? 'standings-me' : ''}>
                    <td className="standings-team">
                      <div className="standings-who">
                        <TeamLogo teamId={l.id} size={22} />
                        <span>{teamAbbr(l.id)}</span>
                        {seed > 0 && <span className="standings-seed">{seed}</span>}
                      </div>
                    </td>
                    <td>{l.w}</td><td>{l.l}</td><td>{l.t}</td><td>{l.div}</td><td>{l.pf}</td><td>{l.pa}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}

// ── Stats ([season stats]) ───────────────────────────────────────────────

type StatsView = 'leaders' | 'team' | 'awards'

function StatsTab({ season }: { season: SeasonView }) {
  const hasAwards = !!season.awards?.length
  const [view, setView] = useState<StatsView>(hasAwards ? 'awards' : 'leaders')
  const views: [StatsView, string][] = [['leaders', 'League Leaders'], ['team', 'Your Team'], ...(hasAwards ? [['awards', 'Awards'] as [StatsView, string]] : [])]

  if (!season.leaders.length) {
    return (
      <div className="season-empty">
        <p>No games played yet.</p>
        <p className="season-muted season-small">
          Every player in the league is tracked from Week 1. The NFL's awards are given out before the playoffs.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="conf-toggle">
        {views.map(([id, label]) => (
          <button key={id} className={`conf-btn${view === id ? ' conf-btn--on' : ''}`} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      {view === 'leaders' && <LeadersView season={season} />}
      {view === 'team' && <TeamStatsView rows={season.teamStats} />}
      {view === 'awards' && (
        <>
          <AwardList awards={season.awards ?? []} teamId={season.teamId} />
          <p className="season-muted season-small honors-foot">{AWARDS_FOOTNOTE}</p>
        </>
      )}
    </div>
  )
}

function LeadersView({ season }: { season: SeasonView }) {
  const [id, setId] = useState(season.leaders[0].id)
  const table = season.leaders.find(t => t.id === id) ?? season.leaders[0]
  return (
    <>
      <div className="week-pills">
        {season.leaders.map(t => (
          <button key={t.id} className={`leader-pill${t.id === table.id ? ' week-pill--on' : ''}`} onClick={() => setId(t.id)}>{t.label}</button>
        ))}
      </div>
      <ol className="leaders">
        {table.rows.map((r, i) => (
          <li key={r.id} className={`leader${r.teamId === season.teamId ? ' leader--mine' : ''}`}>
            <span className="leader-rank">{i + 1}</span>
            {r.teamId && <TeamLogo teamId={r.teamId} size={26} />}
            <span className="leader-name">{r.name}</span>
            <span className="leader-pos">{r.pos}</span>
            <span className="leader-value">{r.value.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

type StatColumn = { label: string; value: (l: SeasonLine) => string | number }
const n = (v: number | undefined) => Math.round(v ?? 0)
const TEAM_TABLES: { title: string; has: (l: SeasonLine) => boolean; rank: (l: SeasonLine) => number; columns: StatColumn[] }[] = [
  {
    title: 'Passing', has: l => !!l.attempts, rank: l => n(l.passYards),
    columns: [
      { label: 'C/ATT', value: l => `${n(l.completions)}/${n(l.attempts)}` },
      { label: 'YDS', value: l => n(l.passYards) },
      { label: 'TD', value: l => n(l.passTD) },
      { label: 'INT', value: l => n(l.interceptionsThrown) },
      { label: 'RTG', value: l => passerRating(l).toFixed(1) },
    ],
  },
  {
    title: 'Rushing', has: l => !!l.carries, rank: l => n(l.rushYards),
    columns: [
      { label: 'CAR', value: l => n(l.carries) },
      { label: 'YDS', value: l => n(l.rushYards) },
      { label: 'AVG', value: l => (l.carries ? (n(l.rushYards) / l.carries).toFixed(1) : '0.0') },
      { label: 'TD', value: l => n(l.rushTD) },
    ],
  },
  {
    title: 'Receiving', has: l => !!l.receptions || !!l.targets, rank: l => n(l.recYards),
    columns: [
      { label: 'REC', value: l => n(l.receptions) },
      { label: 'YDS', value: l => n(l.recYards) },
      { label: 'TD', value: l => n(l.recTD) },
    ],
  },
  {
    title: 'Defense', has: l => !!(l.tackles || l.sacks || l.interceptions || l.passesDefended), rank: l => n(l.tackles) + n(l.sacks) * 5 + n(l.interceptions) * 8,
    columns: [
      { label: 'TKL', value: l => n(l.tackles) },
      { label: 'TFL', value: l => n(l.tfl) },
      { label: 'SACK', value: l => n(l.sacks) },
      { label: 'INT', value: l => n(l.interceptions) },
      { label: 'PD', value: l => n(l.passesDefended) },
    ],
  },
]

function TeamStatsView({ rows }: { rows: TeamStatRow[] }) {
  return (
    <div className="team-stats">
      {TEAM_TABLES.map(t => {
        const players = rows.filter(r => t.has(r.line)).sort((a, b) => t.rank(b.line) - t.rank(a.line))
        if (!players.length) return null
        return (
          <table className="standings team-stats-table" key={t.title}>
            <thead>
              <tr>
                <th className="standings-team">{t.title}</th>
                {t.columns.map(c => <th key={c.label}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td className="standings-team team-stats-name">{p.name}</td>
                  {t.columns.map(c => <td key={c.label}>{c.value(p.line)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )
      })}
    </div>
  )
}

// ── Playoffs ─────────────────────────────────────────────────────────────

const ROUNDS: [number, string][] = [[1, 'Wild Card'], [2, 'Divisional'], [3, 'Conference Championship']]

// [projected] The bracket if the season ended today, laid out like the real one and labeled so it cannot be
// mistaken for it. Past the Wild Card round the matchups depend on who wins, so those rounds are described.
function ProjectedBracket({ season, conf, setConf }: { season: SeasonView; conf: 'AFC' | 'NFC'; setConf: (c: 'AFC' | 'NFC') => void }) {
  const projected = season.projectedPlayoffs!
  const seeds = projected.seeds[conf]
  const lines = Object.values(season.standings[conf]).flat()
  const recordOf = (id: string) => {
    const l = lines.find(x => x.id === id)
    return l ? `${l.w}-${l.l}${l.t ? `-${l.t}` : ''}` : ''
  }
  return (
    <div className="bracket">
      <div className="bracket-projected">
        <h3 className="bracket-projected__title">Projected Playoffs</h3>
        <p className="season-muted season-small">If the season ended today, through Week {projected.throughWeek}. {projectedLine(projected.seeds, season.teamId)}</p>
      </div>

      <div className="conf-toggle">
        {(['AFC', 'NFC'] as const).map(c => (
          <button key={c} className={`conf-btn${conf === c ? ' conf-btn--on' : ''}`} onClick={() => setConf(c)}>{c}</button>
        ))}
      </div>

      <div className="bracket-seeds">
        {seeds.map((id, i) => (
          <div key={id} className={`bracket-seed${i >= 4 ? ' bracket-seed--wild' : ''}${id === season.teamId ? ' bracket-seed--me' : ''}`}>
            <span>{i + 1}</span><TeamLogo teamId={id} size={24} /><b>{teamAbbr(id)}</b><small>{recordOf(id)}</small>
          </div>
        ))}
      </div>
      <p className="season-muted season-small">1 to 4 win their divisions. 5 to 7 are the wild cards.</p>

      <div className="bracket-round">
        <h3 className="bracket-title">Wild Card</h3>
        <div className={`bracket-bye${seeds[0] === season.teamId ? ' bracket-bye--me' : ''}`}>
          <span>1</span><TeamLogo teamId={seeds[0]} size={24} /><b>{teamAbbr(seeds[0])}</b><em>First-round bye</em>
        </div>
        <ul className="scores">
          {projected.games.filter(g => g.conf === conf).map(g => <ScoreRow key={g.id} game={g} teamId={season.teamId} labelSeeds />)}
        </ul>
      </div>

      <div className="bracket-round">
        <h3 className="bracket-title">Divisional</h3>
        <p className="season-muted season-small">The 1 seed hosts the lowest seed left. The other two winners play, the higher seed at home.</p>
      </div>
      <div className="bracket-round">
        <h3 className="bracket-title">Conference Championship</h3>
        <p className="season-muted season-small">The last two left, the higher seed at home.</p>
      </div>
      <div className="bracket-round">
        <h3 className="bracket-title">Super Bowl {season.superBowl.numeral}</h3>
        <p className="season-muted season-small">AFC against NFC on a neutral field.</p>
      </div>
    </div>
  )
}

function PlayoffsTab({ season }: { season: SeasonView }) {
  const p = season.playoffs
  const [conf, setConf] = useState<'AFC' | 'NFC'>(() => conferenceOf(season))

  if (!p && season.projectedPlayoffs) return <ProjectedBracket season={season} conf={conf} setConf={setConf} />

  if (!p) {
    return (
      <div className="season-empty">
        <p>The playoffs start after Week 18.</p>
        <p className="season-muted season-small">
          Seven teams from each conference: four division winners and three wild cards, seeded by the
          official NFL tie-breakers. The top seed gets a bye. A projected bracket appears here after Week 8.
        </p>
      </div>
    )
  }

  const superBowl = p.games.find(g => g.round === 4)

  return (
    <div className="bracket">
      <div className="conf-toggle">
        {(['AFC', 'NFC'] as const).map(c => (
          <button key={c} className={`conf-btn${conf === c ? ' conf-btn--on' : ''}`} onClick={() => setConf(c)}>{c}</button>
        ))}
      </div>

      <div className="bracket-seeds">
        {p.seeds[conf].map((id, i) => (
          <div key={id} className={`bracket-seed${id === season.teamId ? ' bracket-seed--me' : ''}`}>
            <span>{i + 1}</span><TeamLogo teamId={id} size={24} /><b>{teamAbbr(id)}</b>
          </div>
        ))}
      </div>

      {ROUNDS.map(([round, name]) => {
        const games = p.games.filter(g => g.round === round && g.conf === conf)
        if (!games.length) return null
        return (
          <div className="bracket-round" key={round}>
            <h3 className="bracket-title">{name}</h3>
            <ul className="scores">
              {games.map(g => <ScoreRow key={g.id} game={g} teamId={season.teamId} labelSeeds />)}
            </ul>
          </div>
        )
      })}

      {superBowl && (
        <div className="bracket-round bracket-round--sb">
          <img className="bracket-sbart" src={superBowlArt(season.year)} alt="" draggable={false} />
          <h3 className="bracket-title">Super Bowl {season.superBowl.numeral}</h3>
          <ul className="scores">
            <ScoreRow game={superBowl} teamId={season.teamId} />
          </ul>
        </div>
      )}
    </div>
  )
}
