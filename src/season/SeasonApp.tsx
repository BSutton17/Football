import { useCallback, useEffect, useRef, useState } from 'react'
import TeamLogo from '../components/TeamLogo.tsx'
import TeamSelectScreen from '../components/TeamSelectScreen.tsx'
import { accentColor } from '../data/teamColors.ts'
import { NFL_TEAMS } from '../data/nflTeams.ts'
import { socket } from '../socket/index.ts'
import type { Difficulty, GameMode } from '../types/game.ts'
import { api, Refused, SignedOut } from './api.ts'
import { Lombardi } from './art.tsx'
import { clearAuth, loadAuth, peekAuth, setActiveSeason, type AuthRecord } from './authStore.ts'
import AwardShow from './AwardShow.tsx'
import Celebration from './Celebration.tsx'
import Cinematic from './Cinematic.tsx'
import { modeLine, recordText, statusLine, teamName } from './format.ts'
import SeasonHome from './SeasonHome.tsx'
import SignIn from './SignIn.tsx'
import { saveTrophyImage } from './trophyImage.ts'
import type { SeasonHome as HomeData, SeasonSettings, SeasonSummary, SeasonView } from './types.ts'

// ── Seasons: everything between games ([seasons]) ──────────────────────────
//
// Sign in, three saves, set a new season up, follow it, and celebrate. A game itself runs through the
// ordinary game screen; `onPlay` hands over to it and this comes back when it is done.

type View =
  | { name: 'loading' }
  | { name: 'signin' }
  | { name: 'saves' }
  | { name: 'trophies' }
  | { name: 'settings'; slot: number; replace: boolean }
  | { name: 'team'; slot: number; replace: boolean; settings: SeasonSettings }
  | { name: 'cinematic'; season: SeasonView }
  | { name: 'season'; id: string }

interface Props {
  onBack: () => void
  onPlay: (season: SeasonView, token: string) => void
  // The season to open straight into, on the way back from a game.
  focusSeasonId?: string | null
  startError?: string | null
  starting?: boolean
}

export default function SeasonApp({ onBack, onPlay, focusSeasonId, startError, starting }: Props) {
  const [auth, setAuth] = useState<AuthRecord | null>(() => peekAuth())
  const [view, setView] = useState<View>({ name: 'loading' })
  const [home, setHome] = useState<HomeData | null>(null)
  const [season, setSeason] = useState<SeasonView | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [unreachable, setUnreachable] = useState(false)

  const tokenRef = useRef<string | null>(auth?.token ?? null)
  tokenRef.current = auth?.token ?? null

  const signOutLocally = useCallback(() => {
    clearAuth()
    setActiveSeason(null)
    setAuth(null)
    setHome(null)
    setSeason(null)
    setView({ name: 'signin' })
  }, [])

  // Everything goes through here, so a server that cannot be reached always reads the same way, and
  // ⚠️ ONLY A REAL 401 EVER SIGNS ANYBODY OUT. Being offline, or the server waking up, does not.
  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await fn()
      setUnreachable(false)
      return result
    } catch (err) {
      if (err instanceof SignedOut) { signOutLocally(); return null }
      if (err instanceof Refused) { setProblem('That did not work. Please try again.'); return null }
      setUnreachable(true)
      return null
    }
  }, [signOutLocally])

  const loadHome = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return null
    const data = await guard(() => api.home(token))
    if (data) setHome(data)
    return data
  }, [guard])

  const openSeason = useCallback(async (id: string) => {
    const token = tokenRef.current
    if (!token) return
    const r = await guard(() => api.season(token, id))
    if (r) {
      setSeason(r.season)
      setView({ name: 'season', id })
    }
  }, [guard])

  // On the way in: who is this, and where were they?
  useEffect(() => {
    let live = true
    void (async () => {
      const record = await loadAuth()
      if (!live) return
      if (!record) { setView({ name: 'signin' }); return }
      try { localStorage.removeItem('ef2_auth_handoff') } catch { /* nothing to clean up */ }
      setAuth(record)
      tokenRef.current = record.token
      if (focusSeasonId) {
        await openSeason(focusSeasonId)
      } else {
        await loadHome()
        setView(v => (v.name === 'loading' ? { name: 'saves' } : v))
      }
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A failed start of a game is told to the socket, not to a request.
  useEffect(() => {
    function onError({ code, message }: { code: string; message: string }) {
      if (code === 'signed_out') { signOutLocally(); return }
      setProblem(message)
    }
    socket.on('season_error', onError)
    return () => { socket.off('season_error', onError) }
  }, [signOutLocally])

  useEffect(() => { if (startError) setProblem(startError) }, [startError])

  async function onSignedIn(record: AuthRecord) {
    setAuth(record)
    tokenRef.current = record.token
    await loadHome()
    setView({ name: 'saves' })
  }

  async function signOut() {
    const token = tokenRef.current
    signOutLocally()
    if (token) { try { await api.logout(token) } catch { /* the local sign-out is what counts */ } }
  }

  async function createSeason(slot: number, teamId: string, settings: SeasonSettings, replace: boolean) {
    const token = tokenRef.current
    if (!token) return
    setBusy(true)
    const r = await guard(() => api.newSeason(token, { slot, teamId, settings, replace }))
    setBusy(false)
    if (r) {
      setSeason(r.season)
      setView({ name: 'cinematic', season: r.season })
    }
  }

  async function sim() {
    const token = tokenRef.current
    if (!token || !season) return
    setBusy(true)
    const r = await guard(() => api.sim(token, season.id))
    setBusy(false)
    if (r) setSeason(r.season)
  }

  async function acknowledge() {
    const token = tokenRef.current
    if (!token || !season) return
    // Off the screen at once. The server is told as well, so it stays gone after a relaunch.
    setSeason({ ...season, screens: season.screens.slice(1) })
    const r = await guard(() => api.ack(token, season.id))
    if (r) setSeason(r.season)
  }

  async function removeSeason(id: string) {
    const token = tokenRef.current
    if (!token) return
    // Gone from the screen at once, and a second tap on the way to a refresh is not an error.
    setHome(h => (h ? { ...h, slots: h.slots.map(s => (s?.id === id ? null : s)) } : h))
    await guard(() => api.remove(token, id).catch((err) => {
      if (err instanceof Refused && err.code === 'not_found') return null
      throw err
    }))
    await loadHome()
  }

  // ── Screens ────────────────────────────────────────────────────────────

  const banner = (
    <>
      {unreachable && (
        <div className="season-toast">
          <span>Could not reach the server.</span>
          <button onClick={() => { setUnreachable(false); void (season && view.name === 'season' ? openSeason(season.id) : loadHome()) }}>Retry</button>
        </div>
      )}
      {problem && (
        <div className="season-toast season-toast--problem" onClick={() => setProblem(null)}>
          <span>{problem}</span>
          <button>Dismiss</button>
        </div>
      )}
    </>
  )

  if (view.name === 'loading') {
    return (
      <div className="season-screen season-center">
        <div className="season-spinner" aria-hidden />
        {banner}
      </div>
    )
  }

  if (view.name === 'signin') {
    return <SignIn onSignedIn={onSignedIn} onBack={onBack} />
  }

  if (view.name === 'cinematic') {
    return <Cinematic season={view.season} onDone={() => setView({ name: 'season', id: view.season.id })} />
  }

  if (view.name === 'settings') {
    return (
      <SettingsStep
        replacing={view.replace}
        onBack={() => setView({ name: 'saves' })}
        onNext={(settings) => setView({ name: 'team', slot: view.slot, replace: view.replace, settings })}
      />
    )
  }

  if (view.name === 'team') {
    return (
      <>
        <TeamStep
          home={home}
          onBack={() => setView({ name: 'settings', slot: view.slot, replace: view.replace })}
          onPick={(teamId) => createSeason(view.slot, teamId, view.settings, view.replace)}
        />
        {busy && <div className="season-veil"><div className="season-spinner" aria-hidden /></div>}
        {banner}
      </>
    )
  }

  if (view.name === 'season' && season) {
    return (
      <>
        <SeasonHome
          season={season}
          busy={busy || !!starting}
          onBack={() => { setSeason(null); void loadHome(); setView({ name: 'saves' }) }}
          onPlay={() => { setProblem(null); if (tokenRef.current) onPlay(season, tokenRef.current) }}
          onSim={sim}
        />
        {season.screens[0]?.type === 'awards' && <AwardShow key={season.screens.length} season={season} onDone={acknowledge} />}
        {season.screens[0] && season.screens[0].type !== 'awards' && (
          <Celebration key={season.screens.length} season={season} screen={season.screens[0]} onContinue={acknowledge} />
        )}
        {starting && <div className="season-veil"><div className="season-spinner" aria-hidden /></div>}
        {banner}
      </>
    )
  }

  if (view.name === 'trophies') {
    return <TrophyCase home={home} onBack={() => setView({ name: 'saves' })} />
  }

  return (
    <>
      <SavesScreen
        home={home}
        auth={auth}
        onBack={onBack}
        onOpen={openSeason}
        onNew={(slot, replace) => setView({ name: 'settings', slot, replace })}
        onDelete={removeSeason}
        onTrophies={() => setView({ name: 'trophies' })}
        onSignOut={signOut}
      />
      {banner}
    </>
  )
}

// ── The three saves ──────────────────────────────────────────────────────

function SavesScreen({ home, auth, onBack, onOpen, onNew, onDelete, onTrophies, onSignOut }: {
  home: HomeData | null
  auth: AuthRecord | null
  onBack: () => void
  onOpen: (id: string) => void
  onNew: (slot: number, replace: boolean) => void
  onDelete: (id: string) => void
  onTrophies: () => void
  onSignOut: () => void
}) {
  const [confirm, setConfirm] = useState<SeasonSummary | null>(null)
  const [confirmNew, setConfirmNew] = useState<SeasonSummary | null>(null)
  const slots = home?.slots ?? []
  const year = home?.schedule.year
  const trophies = home?.trophies.length ?? 0

  return (
    <div className="season-screen season-saves">
      <header className="season-bar">
        <button className="season-back" onClick={onBack} aria-label="Back to the lobby">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
        </button>
        <div className="season-bar-text">
          <div className="season-bar-title">Seasons</div>
          <div className="season-bar-sub">{auth?.user.name}</div>
        </div>
        <button className="season-chip" onClick={onTrophies} disabled={!trophies}>
          <Lombardi className="season-chip-trophy" /> {trophies}
        </button>
        <button className="season-chip" onClick={onSignOut}>Sign out</button>
      </header>

      <div className="saves">
        {/* ⚠️ NOT THREE EMPTY SLOTS. Offline, or with the server still waking up, the saves simply have
            not arrived, and showing them as empty says your seasons are gone. */}
        {!home && (
          <div className="season-empty">
            <div className="season-spinner" style={{ alignSelf: 'center' }} aria-hidden />
            <p className="season-muted">Loading your seasons…</p>
          </div>
        )}
        {slots.map((s, i) => s ? (
          <div
            key={s.id}
            className="save"
            role="button"
            tabIndex={0}
            onClick={() => onOpen(s.id)}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style={{ ['--a' as any]: accentColor(s.teamId) }}
          >
            <TeamLogo teamId={s.teamId} size={64} />
            <div className="save-text">
              <div className="save-team">{teamName(s.teamId)}</div>
              <div className="save-status">{statusLine(s)} · {recordText(s.record)}</div>
              <div className="save-meta">{s.year} · {modeLine(s)}</div>
            </div>
            {s.activeGameId && <span className="save-live">Resume</span>}
            {/* "There is only one season": a finished save has nothing left but to start again. */}
            {s.phase === 'complete' && (
              <button
                className="save-again"
                onClick={(e) => { e.stopPropagation(); setConfirmNew(s) }}
              >
                New Season
              </button>
            )}
            <button
              className="save-delete"
              aria-label="Delete this save"
              onClick={(e) => { e.stopPropagation(); setConfirm(s) }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M9 3v1H4v2h16V4h-5V3H9zM6 8l1 13h10l1-13H6z" /></svg>
            </button>
          </div>
        ) : (
          <button key={`empty-${i}`} className="save save--empty" onClick={() => onNew(i, false)}>
            <span className="save-plus" aria-hidden>+</span>
            <div className="save-text">
              <div className="save-team">New Season</div>
              <div className="save-status">{year ? `${year} NFL schedule` : 'Save ' + (i + 1)}</div>
            </div>
          </button>
        ))}
      </div>

      {confirmNew && (
        <div className="season-veil" onClick={() => setConfirmNew(null)}>
          <div className="season-dialog" onClick={e => e.stopPropagation()}>
            <h2>Start a new season here?</h2>
            <p>This replaces your {confirmNew.year} {teamName(confirmNew.teamId)} season. Any trophy you won stays in your case.</p>
            <div className="next-actions">
              <button className="season-btn season-btn--accent" onClick={() => onNew(confirmNew.slot, true)}>Start New Season</button>
              <button className="season-btn season-btn--ghost" onClick={() => setConfirmNew(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="season-veil" onClick={() => setConfirm(null)}>
          <div className="season-dialog" onClick={e => e.stopPropagation()}>
            <h2>Delete this season?</h2>
            <p>{teamName(confirm.teamId)}, {statusLine(confirm)}, {recordText(confirm.record)}. This cannot be undone. Any trophy you won stays in your case.</p>
            <div className="next-actions">
              <button className="season-btn season-btn--danger" onClick={() => { onDelete(confirm.id); setConfirm(null) }}>Delete</button>
              <button className="season-btn season-btn--ghost" onClick={() => setConfirm(null)}>Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Setting a new season up ──────────────────────────────────────────────

const MODES: { id: GameMode; name: string; blurb: string }[] = [
  { id: 'automatic', name: 'Automatic', blurb: 'Tap to hike and the play runs itself.' },
  { id: 'manual', name: 'Manual', blurb: 'Electric football: players move only while you hold GO.' },
]
const DIFFICULTIES: { id: Difficulty; name: string; blurb: string }[] = [
  { id: 'easy', name: 'Easy', blurb: 'Vanilla coverages and it misreads the field. Receivers are colored by how open they are.' },
  { id: 'medium', name: 'Medium', blurb: 'The full playbook, including pressure. No coverage colors.' },
  { id: 'hard', name: 'Hard', blurb: 'Disguised pressure and tight alignment. No coverage colors.' },
]
const QUARTERS = [3, 4, 5, 6]

function SettingsStep({ onBack, onNext, replacing }: { onBack: () => void; onNext: (s: SeasonSettings) => void; replacing: boolean }) {
  const [mode, setMode] = useState<GameMode>('automatic')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [quarterMinutes, setQuarterMinutes] = useState(5)

  return (
    <div className="season-screen season-settings">
      <header className="season-bar">
        <button className="season-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
        </button>
        <div className="season-bar-text">
          <div className="season-bar-title">New Season</div>
          <div className="season-bar-sub">{replacing ? 'This replaces the season in this save' : 'These stay the same for the whole season'}</div>
        </div>
      </header>

      <div className="settings">
        <section className="setting">
          <h2>How you play</h2>
          <div className="choice-row">
            {MODES.map(m => (
              <button key={m.id} className={`choice${mode === m.id ? ' choice--on' : ''}`} onClick={() => setMode(m.id)}>{m.name}</button>
            ))}
          </div>
          <p className="season-muted season-small">{MODES.find(m => m.id === mode)!.blurb}</p>
        </section>

        <section className="setting">
          <h2>Difficulty</h2>
          <div className="choice-row">
            {DIFFICULTIES.map(d => (
              <button key={d.id} className={`choice${difficulty === d.id ? ' choice--on' : ''}`} onClick={() => setDifficulty(d.id)}>{d.name}</button>
            ))}
          </div>
          <p className="season-muted season-small">{DIFFICULTIES.find(d => d.id === difficulty)!.blurb}</p>
        </section>

        <section className="setting">
          <h2>Quarter length</h2>
          <div className="choice-row">
            {QUARTERS.map(q => (
              <button key={q} className={`choice${quarterMinutes === q ? ' choice--on' : ''}`} onClick={() => setQuarterMinutes(q)}>{q} min</button>
            ))}
          </div>
        </section>

        <button className="season-btn season-btn--accent season-btn--big" onClick={() => onNext({ mode, difficulty, quarterMinutes })}>
          Choose Your Team
        </button>
      </div>
    </div>
  )
}

function TeamStep({ home, onBack, onPick }: { home: HomeData | null; onBack: () => void; onPick: (teamId: string) => void }) {
  const [picked, setPicked] = useState(NFL_TEAMS[0].id)
  return (
    <TeamSelectScreen
      role={null}
      slot={0}
      validTeamIds={NFL_TEAMS.map(t => t.id)}
      picks={{ 0: { teamId: picked, locked: false } }}
      pickError={null}
      onSelect={setPicked}
      onLock={onPick}
      quarterMinutes={5}
      onQuarterMinutes={() => {}}
      defenseSeesOpenness
      onDefenseVision={() => {}}
      season={{
        sos: home?.schedule.sos ?? {},
        lastYear: home?.schedule.lastYear ?? {},
        sosYear: home?.schedule.sosYear ?? null,
        onBack,
      }}
    />
  )
}

// ── The trophy case ──────────────────────────────────────────────────────

function TrophyCase({ home, onBack }: { home: HomeData | null; onBack: () => void }) {
  const [saving, setSaving] = useState<string | null>(null)
  async function save(i: number) {
    const t = home!.trophies[i]
    setSaving(t._id)
    try { await saveTrophyImage(t) } finally { setSaving(null) }
  }
  return (
    <div className="season-screen season-saves">
      <header className="season-bar">
        <button className="season-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z" /></svg>
        </button>
        <div className="season-bar-text">
          <div className="season-bar-title">Trophy Case</div>
          <div className="season-bar-sub">Yours for good, even after the save is gone</div>
        </div>
      </header>
      <div className="trophies">
        {(home?.trophies ?? []).map((t, i) => (
          <div className="trophy" key={t._id}>
            <Lombardi className="trophy-art" />
            <div className="save-text">
              <div className="save-team">Super Bowl {t.numeral}</div>
              <div className="save-status">{teamName(t.teamId)}</div>
              <div className="save-meta">{t.year} · {recordText(t.record)} · {t.playoffRecord.w}-{t.playoffRecord.l} in the playoffs</div>
            </div>
            <button className="season-btn" disabled={saving === t._id} onClick={() => save(i)}>
              {saving === t._id ? 'Saving…' : 'Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
