// ── The play sandbox ([authored]) ───────────────────────────────────────────
//
// Dev-only authoring for formations and plays. Reached at ?sandbox=1 and never bundled into a
// game screen, because it talks to an endpoint that only exists on a dev machine.
//
// The two editors are deliberately different, and that difference is the user's rule:
//
//   FORMATION — players are DRAGGABLE. This is where alignment is decided.
//   PLAY      — players are FIXED and dragging draws a ROUTE instead. To move someone you edit
//               the formation, and doing so updates every play built on it rather than erasing
//               them, because routes are stored as offsets from a slot rather than field points.

import { useEffect, useMemo, useState } from 'react'
import Field, { BALL_X, LOS } from './Field'
import type { FieldPlayer } from './Field'
import {
  getPlaybook, createItem, updateItem, deleteItem, ApiError,
} from './api'
import type { Playbook, Formation, Play, Category, PlayType, RouteOffset, Assignment } from './api'
import { beautifyRoute } from '../game/routeDraw'
import { DefFormationEditor, ShellEditor } from './DefenseEditors'

const ALL_SLOTS = ['WR1', 'WR2', 'WR3', 'WR4', 'TE1', 'TE2', 'TE3', 'RB1', 'RB2']
const MAX_SKILL = 5
const labelOf = (slot: string) => slot.replace(/[0-9]+$/, '')

const blank = (): Formation => ({ name: '', category: 'gun', spots: [] })

export default function Sandbox() {
  const [book, setBook] = useState<Playbook | null>(null)
  const [mode, setMode] = useState<'offense' | 'defense'>('offense')
  const [tab, setTab] = useState<'formations' | 'plays' | 'defFormations' | 'shells'>('formations')
  const [error, setError] = useState<string[]>([])
  const [note, setNote] = useState('')

  const reload = () =>
    getPlaybook().then(setBook).catch((e: ApiError) => setError([e.message, ...e.errors]))
  useEffect(() => { reload() }, [])

  const say = (msg: string) => { setNote(msg); setError([]); setTimeout(() => setNote(''), 2500) }
  const fail = (e: unknown) => {
    const err = e as ApiError
    setError([err.message, ...(err.errors ?? [])])
  }

  if (!book) {
    return (
      <Shell>
        {error.length
          ? <Errors list={error} />
          : <p style={{ color: '#9fb0a4' }}>Loading the playbook…</p>}
      </Shell>
    )
  }

  return (
    <Shell>
      {/* Which side of the ball you are authoring. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '1px solid #2c3a30' }}>
          {(['offense', 'defense'] as const).map(m => (
            <button key={m}
              onClick={() => { setMode(m); setTab(m === 'offense' ? 'formations' : 'defFormations'); setError([]) }}
              style={{
                background: mode === m ? (m === 'offense' ? '#2f5f7d' : '#7d2f36') : '#16241a',
                color: '#e8ecf1', border: 0, padding: '8px 20px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', letterSpacing: 0.4,
              }}>
              {m === 'offense' ? 'OFFENSE' : 'DEFENSE'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {note && <span style={{ color: '#7ee08a', alignSelf: 'center', fontSize: 13 }}>{note}</span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(mode === 'offense'
          ? (['formations', 'plays'] as const)
          : (['defFormations', 'shells'] as const)
        ).map(t => (
          <button key={t} onClick={() => { setTab(t); setError([]) }} style={tabStyle(tab === t)}>
            {{ formations: 'Formations', plays: 'Plays', defFormations: 'Formations', shells: 'Shells' }[t]}
            <span style={{ opacity: 0.55, marginLeft: 6 }}>{Object.keys(book[t]).length}</span>
          </button>
        ))}
      </div>

      {book.audit && !book.audit.ok && (
        <Errors title="The saved playbook has problems" list={book.audit.problems} />
      )}
      {error.length > 0 && <Errors list={error} />}

      {tab === 'formations' && <FormationEditor book={book} onSaved={(m) => { say(m); reload() }} onError={fail} />}
      {tab === 'plays' && <PlayEditor book={book} onSaved={(m) => { say(m); reload() }} onError={fail} />}
      {tab === 'defFormations' && <DefFormationEditor book={book} onSaved={(m) => { say(m); reload() }} onError={fail} />}
      {tab === 'shells' && <ShellEditor book={book} onSaved={(m) => { say(m); reload() }} onError={fail} />}
    </Shell>
  )
}

// ── Formations ──────────────────────────────────────────────────────────────

function FormationEditor({ book, onSaved, onError }: {
  book: Playbook; onSaved: (m: string) => void; onError: (e: unknown) => void
}) {
  const [id, setId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Formation>(blank())
  const [selected, setSelected] = useState<string | null>(null)

  const load = (fid: string) => { setId(fid); setDraft(structuredClone(book.formations[fid])); setSelected(null) }
  const reset = () => { setId(null); setDraft(blank()); setSelected(null) }

  const players: FieldPlayer[] = draft.spots.map(s => ({ ...s, label: labelOf(s.slot) }))
  const used = new Set(draft.spots.map(s => s.slot))
  const [vsId, setVsId] = useState('')
  const opponents: FieldPlayer[] = (book.defFormations[vsId]?.spots ?? []).map(s => ({ ...s, label: labelOf(s.slot) }))

  // Mirrors whyNoRun on the server: a back has to be behind the line AND inside the formation.
  // The tackles sit at ±3.5, so within about seven is still behind it.
  const backs = draft.spots.filter(sp => labelOf(sp.slot) === 'RB')
  const inBackfield = backs.filter(sp => sp.depth >= 2 && Math.abs(sp.dx) <= 7)
  const canRun = inBackfield.length > 0
  const runBlocker = backs.length === 0
    ? 'no back in this formation'
    : backs.every(sp => Math.abs(sp.dx) > 7)
      ? 'the back is split out wide'
      : 'the back is not behind the line'

  const addSlot = (slot: string) => {
    if (used.has(slot) || draft.spots.length >= MAX_SKILL) return
    // Drop him somewhere sensible so he is visible and draggable, not at 0,0.
    const dx = labelOf(slot) === 'RB' ? -3 : (draft.spots.length % 2 ? 1 : -1) * (6 + draft.spots.length * 3)
    const depth = labelOf(slot) === 'RB' ? 6 : 0
    setDraft(d => ({ ...d, spots: [...d.spots, { slot, dx, depth }] }))
    setSelected(slot)
  }

  const save = async () => {
    try {
      if (id) { await updateItem('formations', id, draft); onSaved(`Saved ${draft.name}`) }
      else {
        const r = await createItem('formations', draft)
        setId(r.id)
        // A formation with nobody in the backfield gets no run play, and says why rather than
        // leaving it a mystery.
        onSaved(r.runPlayId
          ? `Created ${draft.name} — and "${draft.name} Run" with it`
          : `Created ${draft.name}${r.runNote ? ` — ${r.runNote}` : ''}`)
      }
    } catch (e) { onError(e) }
  }

  const del = async () => {
    if (!id) return
    try { await deleteItem('formations', id); reset(); onSaved('Deleted') }
    catch (e) {
      const err = e as ApiError
      if (err.dependents?.length && confirm(`${err.errors[0]}\n\nDelete those plays too?`)) {
        try { await deleteItem('formations', id, true); reset(); onSaved('Deleted with its plays') }
        catch (e2) { onError(e2) }
      } else onError(e)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <List
        title="Saved formations"
        items={Object.entries(book.formations).map(([fid, f]) => ({
          id: fid, label: f.name, sub: `${f.category} · ${f.spots.map(s => s.slot).join(' ')}`,
        }))}
        activeId={id}
        onPick={load}
        onNew={reset}
      />

      <div style={{ flex: '1 1 480px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value as Category }))} style={input}>
            <option value="gun">Gun</option>
            <option value="pistol">Pistol</option>
          </select>
          <input
            placeholder="Sub-formation name (Deuce, U Off Trips Wk…)"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            style={{ ...input, flex: 1, minWidth: 200 }}
          />
          <select value={vsId} onChange={e => setVsId(e.target.value)} style={input}
            title="Show a defense on the field, to align against">
            <option value="">(no defense shown)</option>
            {Object.entries(book.defFormations).map(([fid, f]) => (
              <option key={fid} value={fid}>vs {f.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {ALL_SLOTS.map(s => (
            <button
              key={s}
              onClick={() => (used.has(s)
                ? setDraft(d => ({ ...d, spots: d.spots.filter(x => x.slot !== s) }))
                : addSlot(s))}
              disabled={!used.has(s) && draft.spots.length >= MAX_SKILL}
              style={chip(used.has(s), !used.has(s) && draft.spots.length >= MAX_SKILL)}
            >
              {s}
            </button>
          ))}
          <span style={{ alignSelf: 'center', fontSize: 12, color: draft.spots.length === MAX_SKILL ? '#7ee08a' : '#e0a24e' }}>
            {draft.spots.length}/{MAX_SKILL} skill players
          </span>
        </div>

        <Field
          players={players}
          side="offense"
          opponents={opponents}
          draggable
          selected={selected}
          onSelect={setSelected}
          onMove={(slot, dx, depth) =>
            setDraft(d => ({ ...d, spots: d.spots.map(s => (s.slot === slot ? { ...s, dx, depth } : s)) }))}
        />

        <p style={{ fontSize: 12, color: '#8b9a90', margin: '8px 0' }}>
          Drag to place. <b>dx</b> is yards from the ball's hash, <b>depth</b> is yards behind the line —
          so the formation works from anywhere on the field and from either hash.
        </p>
        {!id && (canRun
          ? (
            <p style={{ fontSize: 12, color: '#7ee08a', margin: '0 0 8px' }}>
              A run play is created with it automatically — the lane is read off the defensive front
              at the line, so there is nothing to draw. You only draw the pass plays.
            </p>
          )
          : (
            <p style={{ fontSize: 12, color: '#e0a24e', margin: '0 0 8px' }}>
              No run play: {runBlocker}. Nobody here can take a handoff, so a run would be a call
              that cannot be run.
            </p>
          ))}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={!draft.name || draft.spots.length !== MAX_SKILL} style={primary}>
            {id ? 'Save changes' : 'Create formation'}
          </button>
          {id && <button onClick={del} style={danger}>Delete</button>}
          {id && <span style={{ alignSelf: 'center', fontSize: 12, color: '#8b9a90' }}>
            Editing keeps its plays — they move with it.
          </span>}
        </div>
      </div>
    </div>
  )
}

// ── Plays ───────────────────────────────────────────────────────────────────

function PlayEditor({ book, onSaved, onError }: {
  book: Playbook; onSaved: (m: string) => void; onError: (e: unknown) => void
}) {
  const formationIds = Object.keys(book.formations)
  const [id, setId] = useState<string | null>(null)
  const [formationId, setFormationId] = useState(formationIds[0] ?? '')
  const [name, setName] = useState('')
  const [playType, setPlayType] = useState<PlayType>('pass')
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [selected, setSelected] = useState<string | null>(null)

  const [vsId, setVsId] = useState('')
  const formation = book.formations[formationId]
  const players: FieldPlayer[] = useMemo(
    () => (formation?.spots ?? []).map(s => ({ ...s, label: labelOf(s.slot) })),
    [formation],
  )
  const opponents: FieldPlayer[] = (book.defFormations[vsId]?.spots ?? []).map(s => ({ ...s, label: labelOf(s.slot) }))
  const backs = players.filter(p => p.label === 'RB')

  const load = (pid: string) => {
    const p = book.plays[pid]
    setId(pid); setName(p.name); setFormationId(p.formationId)
    setPlayType(p.playType); setAssignments(structuredClone(p.assignments)); setSelected(null)
  }
  const reset = () => { setId(null); setName(''); setPlayType('pass'); setAssignments({}); setSelected(null) }

  const routes: Record<string, RouteOffset[]> = {}
  const blocks = new Set<string>()
  let carrier: string | null = null
  for (const [slot, a] of Object.entries(assignments)) {
    if (a.kind === 'route') routes[slot] = a.points
    if (a.kind === 'block') blocks.add(slot)
    if (a.kind === 'carry') carrier = slot
  }

  const draw = (slot: string, pts: { x: number; y: number }[]) => {
    if (playType === 'run') return
    const p = players.find(x => x.slot === slot)!
    // The SAME beautifier the live game uses, so a drawn route behaves identically in both. The
    // points arrive in real field coordinates, so the anchor is the receiver's real spot.
    const offsets = beautifyRoute(pts, { x: BALL_X + p.dx, y: LOS - p.depth })
    if (!offsets) return
    setAssignments(a => ({ ...a, [slot]: { kind: 'route', points: offsets } }))
  }

  const save = async () => {
    const play: Play = { name, formationId, playType, assignments }
    try {
      if (id) { await updateItem('plays', id, play); onSaved(`Saved ${name}`) }
      else { const r = await createItem('plays', play); setId(r.id); onSaved(`Created ${name}`) }
    } catch (e) { onError(e) }
  }

  if (!formationIds.length) {
    return <p style={{ color: '#e0a24e' }}>Create a formation first — a play is built on one.</p>
  }

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <List
        title="Saved plays"
        items={Object.entries(book.plays).map(([pid, p]) => ({
          id: pid, label: p.name,
          sub: `${p.playType} · ${book.formations[p.formationId]?.name ?? p.formationId}`,
        }))}
        activeId={id}
        onPick={load}
        onNew={reset}
      />

      <div style={{ flex: '1 1 480px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={formationId} onChange={e => { setFormationId(e.target.value); setAssignments({}) }} style={input}>
            {formationIds.map(fid => (
              <option key={fid} value={fid}>{book.formations[fid].category} — {book.formations[fid].name}</option>
            ))}
          </select>
          <input placeholder="Play name" value={name} onChange={e => setName(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 180 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['pass', 'run'] as const).map(t => (
              <button key={t} onClick={() => { setPlayType(t); setAssignments({}) }} style={chip(playType === t, false)}>
                {t === 'pass' ? 'Pass' : 'Run'}
              </button>
            ))}
          </div>
          <select value={vsId} onChange={e => setVsId(e.target.value)} style={input}>
            <option value="">(no defense shown)</option>
            {Object.entries(book.defFormations).map(([fid, f]) => (
              <option key={fid} value={fid}>vs {f.name}</option>
            ))}
          </select>
        </div>

        {playType === 'run' ? (
          <div style={{ background: '#1b2a20', border: '1px solid #2c3a30', borderRadius: 6, padding: '9px 12px', marginBottom: 10 }}>
            <b style={{ color: '#7ee08a' }}>Run.</b>{' '}
            <span style={{ color: '#9fb0a4', fontSize: 13 }}>
              No lane is stored — it is chosen at the line from the defensive front, the same read a back makes.
            </span>
            {backs.length > 1 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#e0a24e' }}>Two backs — who carries?</span>
                {backs.map(b => (
                  <button key={b.slot}
                    onClick={() => setAssignments({ [b.slot]: { kind: 'carry' } })}
                    style={chip(carrier === b.slot, false)}>{b.slot}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#8b9a90', margin: '0 0 10px' }}>
            Drag from a receiver to draw his route. Players are fixed here — to move one, edit the formation.
          </p>
        )}

        <Field
          players={players}
          side="offense"
          opponents={opponents}
          routes={playType === 'run' ? {} : routes}
          blocks={blocks}
          carrier={carrier}
          selected={selected}
          onSelect={setSelected}
          onDrawRoute={draw}
        />

        {playType === 'pass' && selected && (
          <div style={{ display: 'flex', gap: 6, margin: '8px 0', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#9fb0a4' }}>{selected}:</span>
            <button onClick={() => setAssignments(a => ({ ...a, [selected]: { kind: 'block' } }))} style={chip(blocks.has(selected), false)}>
              Block
            </button>
            <button onClick={() => setAssignments(a => { const n = { ...a }; delete n[selected]; return n })} style={chip(false, false)}>
              Clear
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={save} disabled={!name} style={primary}>{id ? 'Save changes' : 'Create play'}</button>
          {id && <button onClick={async () => {
            try { await deleteItem('plays', id); reset(); onSaved('Deleted') } catch (e) { onError(e) }
          }} style={danger}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

// ── Chrome ──────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1510', color: '#e8ecf1', padding: '18px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 19, margin: '0 0 4px' }}>Play Sandbox</h1>
      <p style={{ fontSize: 12, color: '#6b7a70', margin: '0 0 16px' }}>
        Dev only — writes straight into Server/src/ai/playbook/authored.json
      </p>
      {children}
    </div>
  )
}

function Errors({ title = 'That could not be saved', list }: { title?: string; list: string[] }) {
  return (
    <div style={{ background: '#2a1618', border: '1px solid #5b2b2f', borderRadius: 6, padding: '9px 12px', margin: '0 0 12px' }}>
      <b style={{ color: '#ff8b8b', fontSize: 13 }}>{title}</b>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#ffc0c0', fontSize: 13 }}>
        {list.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  )
}

function List({ title, items, activeId, onPick, onNew }: {
  title: string
  items: { id: string; label: string; sub: string }[]
  activeId: string | null
  onPick: (id: string) => void
  onNew: () => void
}) {
  return (
    <div style={{ flex: '0 0 218px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        <button onClick={onNew} style={{ ...chip(false, false), padding: '2px 8px' }}>+ New</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 460, overflowY: 'auto' }}>
        {items.length === 0 && <span style={{ fontSize: 13, color: '#4d5a52' }}>None yet.</span>}
        {items.map(it => (
          <button key={it.id} onClick={() => onPick(it.id)} style={{
            textAlign: 'left', padding: '6px 9px', borderRadius: 5, cursor: 'pointer',
            background: activeId === it.id ? '#24402c' : '#16241a',
            border: `1px solid ${activeId === it.id ? '#3d7a4e' : '#22302880'}`, color: '#e8ecf1',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{it.label}</div>
            <div style={{ fontSize: 11, color: '#8b9a90' }}>{it.sub}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const input: React.CSSProperties = {
  background: '#16241a', color: '#e8ecf1', border: '1px solid #2c3a30',
  borderRadius: 5, padding: '6px 9px', fontSize: 13,
}
const primary: React.CSSProperties = {
  background: '#2f7d45', color: '#fff', border: 0, borderRadius: 5,
  padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const danger: React.CSSProperties = { ...primary, background: '#7d2f36' }
const tabStyle = (on: boolean): React.CSSProperties => ({
  background: on ? '#24402c' : '#16241a', color: '#e8ecf1',
  border: `1px solid ${on ? '#3d7a4e' : '#2c3a30'}`, borderRadius: 6,
  padding: '7px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
})
const chip = (on: boolean, disabled: boolean): React.CSSProperties => ({
  background: on ? '#3d7a4e' : '#16241a', color: disabled ? '#4d5a52' : '#e8ecf1',
  border: `1px solid ${on ? '#3d7a4e' : '#2c3a30'}`, borderRadius: 5,
  padding: '4px 9px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
})
