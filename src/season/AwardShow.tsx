import { useEffect, useMemo, useRef, useState } from 'react'
import { teamColors, accentColor, textColorOn } from '../data/teamColors.ts'
import TeamLogo from '../components/TeamLogo.tsx'
import { Confetti } from './art.tsx'
import { chipValue, votesLine, teamName } from './format.ts'
import type { Award, SeasonView } from './types.ts'

// ── The league's awards, on the night ([awards]) ───────────────────────────
//
// Same language as the new-season title sequence: graphics and light, in the winner's own colours.
//
//   1. The year comes up out of the dark under gold lights: the NFL Honors.
//   2. Each award in turn, smallest to biggest: its name, then a light running over the finalists.
//   3. A flash, the screen floods with the winner's club colour and the logo lands with a shockwave and a
//      shake. His name, his real numbers, how the vote went.
//   4. Everything on one page, to read at leisure. The Stats tab has the same page afterwards.
//
// A tap moves on at any point, and "Skip to results" goes straight to the page. It stays on the save
// until Continue, so a crash or a closed app does not lose it.

const INTRO_MS = 3000
const SWEEP_MS = 170

function announceMs(a: Award) {
  if (a.id === 'mvp') return 3800
  return a.voters === 50 ? 2600 : 1800
}
const revealMs = (a: Award) => (a.id === 'mvp' ? 6000 : 3600)

type Phase = 'intro' | 'announce' | 'reveal' | 'recap'

export default function AwardShow({ season, onDone }: { season: SeasonView; onDone: () => void }) {
  const awards = useMemo(() => season.awards ?? [], [season.awards])
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const award = awards[index]

  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => { if (!awards.length) done.current() }, [awards.length])

  function next() {
    if (phase === 'intro') { setPhase('announce'); return }
    if (phase === 'announce') { setPhase('reveal'); return }
    if (phase === 'reveal') {
      if (index + 1 < awards.length) { setIndex(index + 1); setPhase('announce') } else setPhase('recap')
    }
  }
  const nextRef = useRef(next)
  nextRef.current = next

  useEffect(() => {
    if (phase === 'recap' || !award) return
    const wait = phase === 'intro' ? INTRO_MS : phase === 'announce' ? announceMs(award) : revealMs(award)
    const t = window.setTimeout(() => nextRef.current(), wait)
    return () => window.clearTimeout(t)
  }, [phase, index, award])

  if (!award) return null

  if (phase === 'recap') return <Recap season={season} awards={awards} onContinue={onDone} />

  const colors = teamColors(award.winner.teamId)
  const style = phase === 'reveal'
    ? {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--p' as any]: colors.primary, ['--s' as any]: colors.secondary, ['--a' as any]: accentColor(award.winner.teamId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--on-p' as any]: textColorOn(colors.primary),
      }
    : {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--p' as any]: '#9a7a2c', ['--a' as any]: '#ffd97a',
      }

  return (
    <div className={`cine honors honors--${phase}`} onPointerDown={next} role="button" aria-label="Next" style={style}>
      {phase !== 'reveal' && (
        <div className="cine-beams" aria-hidden>
          <div className="cine-beam cine-beam--a" />
          <div className="cine-beam cine-beam--b" />
        </div>
      )}

      {phase === 'intro' && (
        <div className="cine-year" key="intro">
          <div className="cine-year-num">{season.year}</div>
          <div className="cine-year-label">NFL Honors</div>
        </div>
      )}

      {phase === 'announce' && <Announce key={award.id} award={award} />}
      {phase === 'reveal' && <Reveal key={award.id} award={award} mine={award.winner.teamId === season.teamId} />}

      <button
        className="honors-skip"
        onPointerDown={(e) => { e.stopPropagation(); setPhase('recap') }}
      >
        Skip to results
      </button>
      {phase !== 'intro' && <div className="honors-count" aria-hidden>{index + 1} / {awards.length}</div>}
    </div>
  )
}

function Announce({ award }: { award: Award }) {
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setLit(n => n + 1), SWEEP_MS)
    return () => window.clearInterval(t)
  }, [])
  const count = award.finalists.length
  return (
    <div className="honors-announce">
      <div className="honors-group">{award.group}</div>
      <h1 className="honors-name">{award.name}</h1>
      <ul className="honors-finalists" aria-hidden>
        {award.finalists.map((f, i) => (
          <li key={f.id} className={`honors-finalist${lit % count === i ? ' honors-finalist--lit' : ''}`}>
            <TeamLogo teamId={f.teamId} size={30} />
            <span>{f.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Reveal({ award, mine }: { award: Award; mine: boolean }) {
  const { winner } = award
  const { primary, secondary } = teamColors(winner.teamId)
  const pieces = useMemo(() => [primary, secondary, '#ffd97a', '#ffffff'], [primary, secondary])
  const votes = votesLine(award)
  return (
    <>
      <div className="cine-flash" />
      <div className="cine-slam honors-slam">
        <div className="cine-flood" />
        <div className="cine-shock" />
        <div className="cine-shock cine-shock--late" />
        {(mine || award.id === 'mvp') && <Confetti colors={pieces} seconds={award.id === 'mvp' ? 6 : 3.5} />}
        <div className="honors-award">{award.name}</div>
        <div className="cine-logo honors-logo"><TeamLogo teamId={winner.teamId} size={150} selected /></div>
        <div className="honors-winner">{winner.name}</div>
        <div className="honors-who">
          {winner.pos} · {teamName(winner.teamId)} · {winner.record}
          {mine && <span className="honors-mine">Your player</span>}
        </div>
        {winner.chips.length > 0 && (
          <div className="honors-chips">
            {winner.chips.map(c => <div className="honors-chip" key={c.label}><b>{chipValue(c.value)}</b>{c.label}</div>)}
          </div>
        )}
        {award.sharedWith?.length ? (
          <div className="honors-note">Shared with {award.sharedWith.map(p => `${p.name} (${p.teamId})`).join(', ')}</div>
        ) : null}
        {winner.note && !award.sharedWith?.length && <div className="honors-note">{winner.note}</div>}
        {votes && <div className="honors-note">{votes}</div>}
      </div>
    </>
  )
}

export function AwardList({ awards, teamId }: { awards: Award[]; teamId: string }) {
  // Biggest first when it is a list to read, the reverse of the order they were announced in.
  const ordered = useMemo(() => [...awards].reverse(), [awards])
  return (
    <ul className="award-list">
      {ordered.map(a => (
        <li key={a.id} className={`award-row${a.winner.teamId === teamId ? ' award-row--mine' : ''}`}>
          <TeamLogo teamId={a.winner.teamId} size={40} />
          <div className="award-text">
            <div className="award-name">{a.name}</div>
            <div className="award-winner">{a.winner.name}{a.sharedWith?.length ? ` & ${a.sharedWith.map(p => p.name).join(' & ')}` : ''}</div>
            <div className="award-line">
              {a.winner.pos} · {a.winner.teamId}
              {a.winner.chips.length > 0 && ' · '}
              {a.winner.chips.map(c => `${chipValue(c.value)} ${c.label}`).join(' · ')}
            </div>
            {a.winner.note && !a.sharedWith?.length && <div className="award-line">{a.winner.note}</div>}
            {votesLine(a) && <div className="award-line">{votesLine(a)}</div>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export const AWARDS_FOOTNOTE = 'Decided on the regular season. A game you played counts at a full game\'s pace in the voting. Awards for conduct off the field, like Walter Payton Man of the Year, are not given.'

function Recap({ season, awards, onContinue }: { season: SeasonView; awards: Award[]; onContinue: () => void }) {
  const mine = awards.filter(a => a.winner.teamId === season.teamId).length
  return (
    <div className="season-screen honors-recap">
      <header className="season-bar">
        <div className="season-bar-text">
          <div className="season-bar-title">{season.year} NFL Honors</div>
          <div className="season-bar-sub">{mine ? `Your team won ${mine} ${mine === 1 ? 'award' : 'awards'}` : 'The winners'}</div>
        </div>
        <button className="season-btn season-btn--accent" onClick={onContinue}>Continue</button>
      </header>
      <div className="honors-recap-body">
        <AwardList awards={awards} teamId={season.teamId} />
        <p className="season-muted season-small honors-foot">{AWARDS_FOOTNOTE}</p>
      </div>
    </div>
  )
}
