// ── Authoring the defense ([authored]) ──────────────────────────────────────
//
// Mirrors the offense: a FORMATION is the alignment of all eleven, and a SHELL is what those
// eleven are told to do.
//
// ⚠️ ONE DELIBERATE DIFFERENCE FROM THE OFFENSE. On offense, moving a receiver edits the
// FORMATION and every play built on it follows. On defense, moving a defender while building a
// shell saves onto the SHELL — so Cover 2 and Cover 3 out of one nickel can show different
// pictures. That is the user's choice and it is the opposite rule on purpose.
//
// ⚠️ WHAT HAPPENS AT THE SNAP, which is why the authored spot is only a starting point:
//   MAN  — the receiver can line up anywhere, so the defender travels with him.
//   ZONE — he holds the spot authored for him, so the shell keeps the shape it was drawn with.

import { useMemo, useState } from 'react'
import Field from './Field'
import type { FieldPlayer } from './Field'
import {
  createItem, updateItem, deleteItem,
  DEF_SLOT_POOL, DEF_FRONTS, coverageFor, JOBS, ZONE_TYPES, COVER_ROLES,
} from './api'
import type { Playbook, DefFormation, Shell, DefAssignment, DefJob, ApiError } from './api'

const labelOf = (slot: string) => slot.replace(/[0-9]+$/, '')

const ALL_DEF_SLOTS = Object.entries(DEF_SLOT_POOL).flatMap(([label, n]) =>
  Array.from({ length: n }, (_, i) => `${label}${i + 1}`))

// A sensible 4-3 back seven to start from, so nobody places seven players from an empty field.
// The four linemen are not here because they are not authored — the engine always puts the same
// four out and neither player can move them.
const STARTER: DefFormation = {
  name: '',
  category: '4-3',
  spots: [
    { slot: 'LB1', dx: -5, depth: 5 }, { slot: 'LB2', dx: 0, depth: 5 }, { slot: 'LB3', dx: 5, depth: 5 },
    { slot: 'CB1', dx: -16, depth: 6 }, { slot: 'CB2', dx: 16, depth: 6 },
    { slot: 'S1', dx: -8, depth: 13 }, { slot: 'S2', dx: 8, depth: 13 },
  ],
}

// ── Defensive formations ────────────────────────────────────────────────────

export function DefFormationEditor({ book, onSaved, onError }: {
  book: Playbook; onSaved: (m: string) => void; onError: (e: unknown) => void
}) {
  const [id, setId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DefFormation>(structuredClone(STARTER))
  const [selected, setSelected] = useState<string | null>(null)
  const [ghostId, setGhostId] = useState<string>('')

  const players: FieldPlayer[] = draft.spots.map(s => ({ ...s, label: labelOf(s.slot) }))
  const used = new Set(draft.spots.map(s => s.slot))
  const counts = players.reduce<Record<string, number>>((a, p) => ({ ...a, [p.label]: (a[p.label] ?? 0) + 1 }), {})
  const front = DEF_FRONTS[draft.category] ?? DEF_FRONTS['4-3']
  const wanted = coverageFor(draft.category)
  const ghosts: FieldPlayer[] = (book.formations[ghostId]?.spots ?? []).map(s => ({ ...s, label: labelOf(s.slot) }))

  const load = (fid: string) => { setId(fid); setDraft(structuredClone(book.defFormations[fid])); setSelected(null) }
  const reset = () => { setId(null); setDraft(structuredClone(STARTER)); setSelected(null) }

  const toggle = (slot: string) => {
    if (used.has(slot)) setDraft(d => ({ ...d, spots: d.spots.filter(s => s.slot !== slot) }))
    else if (draft.spots.length < coverageFor(draft.category)) {
      const label = labelOf(slot)
      const depth = label === 'LB' ? 5 : label === 'S' ? 13 : 6
      setDraft(d => ({ ...d, spots: [...d.spots, { slot, dx: 0, depth }] }))
      setSelected(slot)
    }
  }

  const save = async () => {
    try {
      if (id) { await updateItem('defFormations', id, draft); onSaved(`Saved ${draft.name}`) }
      else { const r = await createItem('defFormations', draft); setId(r.id); onSaved(`Created ${draft.name}`) }
    } catch (e) { onError(e) }
  }

  const del = async () => {
    if (!id) return
    try { await deleteItem('defFormations', id); reset(); onSaved('Deleted') }
    catch (e) {
      const err = e as ApiError
      if (err.dependents?.length && confirm(`${err.errors[0]}\n\nDelete those shells too?`)) {
        try { await deleteItem('defFormations', id, true); reset(); onSaved('Deleted with its shells') }
        catch (e2) { onError(e2) }
      } else onError(e)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <Sidebar
        title="Defensive formations"
        items={Object.entries(book.defFormations).map(([fid, f]) => ({
          id: fid, label: f.name, sub: `${DEF_FRONTS[f.category]?.name ?? f.category} · ${personnelLine(f)}`,
        }))}
        activeId={id} onPick={load} onNew={reset}
      />

      <div style={{ flex: '1 1 480px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={draft.category}
            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={input}>
            {Object.entries(DEF_FRONTS).map(([k, f]) => <option key={k} value={k}>{f.name}</option>)}
          </select>
          <input placeholder="Sub-formation name (Over, Under, Bear, Mike Walk…)" value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            style={{ ...input, flex: 1, minWidth: 200 }} />
          <select value={ghostId} onChange={e => setGhostId(e.target.value)} style={input}
            title="Show an offensive formation faintly, to align against">
            <option value="">(no offense shown)</option>
            {Object.entries(book.formations).map(([fid, f]) => <option key={fid} value={fid}>vs {f.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {ALL_DEF_SLOTS.map(s => (
            <button key={s} onClick={() => toggle(s)}
              disabled={!used.has(s) && draft.spots.length >= wanted}
              style={chip(used.has(s), !used.has(s) && draft.spots.length >= wanted)}>{s}</button>
          ))}
          <span style={{ alignSelf: 'center', fontSize: 12, color: draft.spots.length === wanted ? '#7ee08a' : '#e0a24e' }}>
            {draft.spots.length}/{wanted}
          </span>
        </div>

        <Field players={players} opponents={ghosts} opponentSide="offense" side="defense" draggable
          dlCount={front.dl}
          selected={selected} onSelect={setSelected}
          onMove={(slot, dx, depth) =>
            setDraft(d => ({ ...d, spots: d.spots.map(s => (s.slot === slot ? { ...s, dx, depth } : s)) }))} />

        <p style={{ fontSize: 12, color: '#8b9a90', margin: '8px 0' }}>
          This formation <b>declares its personnel</b>: {personnelLine(draft)}.
          {(counts.CB ?? 0) >= 4 ? ' Four corners is dime.' : (counts.CB ?? 0) === 3 ? ' Three corners is nickel.' : ''}
          {' '}The AI picks between formations by what the offense shows.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={!draft.name || draft.spots.length !== wanted} style={primary}>
            {id ? 'Save changes' : 'Create formation'}
          </button>
          {id && <button onClick={del} style={danger}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

// ── Shells ──────────────────────────────────────────────────────────────────

export function ShellEditor({ book, onSaved, onError }: {
  book: Playbook; onSaved: (m: string) => void; onError: (e: unknown) => void
}) {
  const defIds = Object.keys(book.defFormations)
  const [id, setId] = useState<string | null>(null)
  const [formationId, setFormationId] = useState(defIds[0] ?? '')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'man' | 'zone'>('zone')
  const [forcedLeverage, setForcedLeverage] = useState<'in' | 'out' | null>(null)
  const [assignments, setAssignments] = useState<Record<string, DefAssignment>>({})
  const [alignments, setAlignments] = useState<Record<string, { dx: number; depth: number }>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [ghostId, setGhostId] = useState<string>('')

  const formation = book.defFormations[formationId]
  const players: FieldPlayer[] = useMemo(
    () => (formation?.spots ?? []).map(s => ({ ...s, ...(alignments[s.slot] ?? {}), label: labelOf(s.slot) })),
    [formation, alignments],
  )
  const ghosts: FieldPlayer[] = (book.formations[ghostId]?.spots ?? []).map(s => ({ ...s, label: labelOf(s.slot) }))

  const load = (sid: string) => {
    const s = book.shells[sid]
    setId(sid); setName(s.name); setFormationId(s.formationId); setKind(s.kind)
    setForcedLeverage(s.forcedLeverage ?? null)
    setAssignments(structuredClone(s.assignments ?? {}))
    setAlignments(structuredClone(s.alignments ?? {}))
    setSelected(null)
  }
  const reset = () => {
    setId(null); setName(''); setKind('zone'); setForcedLeverage(null)
    setAssignments({}); setAlignments({}); setSelected(null)
  }

  const setJob = (slot: string, patch: Partial<DefAssignment>) =>
    setAssignments(a => ({ ...a, [slot]: { ...(a[slot] ?? { job: 'zone' as DefJob }), ...patch } }))

  const save = async () => {
    const shell: Shell = { name, formationId, kind, forcedLeverage, assignments, alignments }
    try {
      if (id) { await updateItem('shells', id, shell); onSaved(`Saved ${name}`) }
      else { const r = await createItem('shells', shell); setId(r.id); onSaved(`Created ${name}`) }
    } catch (e) { onError(e) }
  }

  if (!defIds.length) {
    return <p style={{ color: '#e0a24e' }}>Create a defensive formation first — a shell is built on one.</p>
  }

  const covering = Object.values(assignments).filter(a => a.job === 'man' || a.job === 'zone').length
  const sel = selected ? assignments[selected] : null

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <Sidebar
        title="Shells"
        items={Object.entries(book.shells).map(([sid, s]) => ({
          id: sid, label: s.name,
          sub: `${s.kind} · ${book.defFormations[s.formationId]?.name ?? s.formationId}`,
        }))}
        activeId={id} onPick={load} onNew={reset}
      />

      <div style={{ flex: '1 1 480px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={formationId} onChange={e => { setFormationId(e.target.value); setAssignments({}); setAlignments({}) }} style={input}>
            {defIds.map(fid => <option key={fid} value={fid}>{book.defFormations[fid].name}</option>)}
          </select>
          <input placeholder="Shell name (Cover 3, Nickel Blitz…)" value={name}
            onChange={e => setName(e.target.value)} style={{ ...input, flex: 1, minWidth: 170 }} />
          <select value={kind} onChange={e => setKind(e.target.value as 'man' | 'zone')} style={input}>
            <option value="zone">Zone</option>
            <option value="man">Man</option>
          </select>
          <select value={ghostId} onChange={e => setGhostId(e.target.value)} style={input}>
            <option value="">(no offense shown)</option>
            {Object.entries(book.formations).map(([fid, f]) => <option key={fid} value={fid}>vs {f.name}</option>)}
          </select>
        </div>

        <Field players={players} opponents={ghosts} opponentSide="offense" side="defense" draggable
          dlCount={DEF_FRONTS[formation?.category ?? '4-3']?.dl ?? 4}
          selected={selected} onSelect={setSelected}
          onMove={(slot, dx, depth) => setAlignments(a => ({ ...a, [slot]: { dx, depth } }))} />

        <p style={{ fontSize: 12, color: '#8b9a90', margin: '8px 0' }}>
          Drag to adjust — moves save onto <b>this shell</b>, not the formation, so another shell out
          of the same formation keeps its own look.
          {Object.keys(alignments).length > 0 && (
            <>
              {' '}<button onClick={() => setAlignments({})} style={{ ...chip(false, false), padding: '1px 7px' }}>
                reset {Object.keys(alignments).length} nudge(s)
              </button>
            </>
          )}
        </p>

        {/* Per-defender assignment */}
        {selected ? (
          <div style={{ background: '#16241a', border: '1px solid #2c3a30', borderRadius: 6, padding: '9px 12px', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ color: '#7ee08a', minWidth: 42 }}>{selected}</b>
              {JOBS.map(j => (
                <button key={j} onClick={() => setJob(selected, { job: j })}
                  style={chip(sel?.job === j, false)}>{j}</button>
              ))}
              <button onClick={() => setAssignments(a => { const n = { ...a }; delete n[selected]; return n })}
                style={{ ...chip(false, false), color: '#ff8b8b' }}>clear</button>
            </div>

            {sel?.job === 'zone' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#6b7a70' }}>zone:</span>
                {ZONE_TYPES.map(z => (
                  <button key={z} onClick={() => setJob(selected, { zone: z })} style={chip(sel.zone === z, false)}>{z}</button>
                ))}
              </div>
            )}

            {sel?.job === 'man' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#6b7a70' }}>covers:</span>
                  <button onClick={() => setJob(selected, { target: null })} style={chip(!sel.target, false)}>automatic</button>
                  {COVER_ROLES.map(r => (
                    <button key={r} onClick={() => setJob(selected, { target: r })} style={chip(sel.target === r, false)}>{r}</button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#6b7a70', marginTop: 5 }}>
                  Roles, not slots — X is the widest receiver left, Z the widest right, Y the tight end.
                  That is what lets one shell work against every offensive formation.
                  <b> Automatic</b> lets the engine pair by position and field side, which is the usual answer.
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#4d5a52', margin: '0 0 10px' }}>Click a defender to give him a job.</p>
        )}

        {/* Leverage */}
        <div style={{ background: '#16241a', border: '1px solid #2c3a30', borderRadius: 6, padding: '9px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#9fb0a4', marginBottom: 6 }}>
            <b style={{ color: '#e8ecf1' }}>Leverage</b> — which way man defenders shade.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([null, 'in', 'out'] as const).map(v => (
              <button key={String(v)} onClick={() => setForcedLeverage(v)} style={chip(forcedLeverage === v, false)}>
                {v === null ? 'AI chooses' : v === 'in' ? 'Always inside' : 'Always outside'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7a70', marginTop: 6 }}>
            With no safety over the top the engine plays UNDER regardless — leverage never overrides that.
          </div>
        </div>

        {Object.keys(assignments).length > 0 && covering === 0 && (
          <div style={{ fontSize: 12, color: '#ff8b8b', marginBottom: 10 }}>
            Nobody is covering anyone — this shell rushes and spies only, which is a touchdown.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={!name || Object.keys(assignments).length === 0} style={primary}>
            {id ? 'Save changes' : 'Create shell'}
          </button>
          {id && <button onClick={async () => {
            try { await deleteItem('shells', id); reset(); onSaved('Deleted') } catch (e) { onError(e) }
          }} style={danger}>Delete</button>}
        </div>
      </div>
    </div>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function personnelLine(f: DefFormation) {
  const c: Record<string, number> = {}
  for (const s of f.spots ?? []) { const l = labelOf(s.slot); c[l] = (c[l] ?? 0) + 1 }
  return ['CB', 'S', 'LB'].map(l => `${c[l] ?? 0} ${l}`).join(' · ')
}

function Sidebar({ title, items, activeId, onPick, onNew }: {
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
const chip = (on: boolean, disabled: boolean): React.CSSProperties => ({
  background: on ? '#3d7a4e' : '#16241a', color: disabled ? '#4d5a52' : '#e8ecf1',
  border: `1px solid ${on ? '#3d7a4e' : '#2c3a30'}`, borderRadius: 5,
  padding: '4px 9px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
})
