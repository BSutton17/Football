// ── Authoring a defensive shell ([authored]) ────────────────────────────────
//
// ⚠️ THIS IS A FORM, NOT A CANVAS, AND THAT IS NOT A SHORTCUT. The offense and the defense are
// not mirror images in this engine. `coverages.js` puts it plainly: "The engine has no idea what
// Cover 3 is. Its vocabulary is eleven independent per-player assignments." A shell is a set of
// JOBS — three deep, four under, rush four — expressed in LANDMARKS, and `expandShell` fits real
// defenders to whoever the offense actually split out. Drawing eleven paths would mean authoring
// a separate shell for every offensive formation; describing jobs means one shell covers them all.
//
// ⚠️ WHO COVERS WHOM IS NOT AUTHORED EITHER. `matchMen` pairs man defenders to receivers by
// position eligibility and field side, which is what stops a corner being manned on a tight end.
// Authoring the matchups would have to be redone for every new formation.

import { useState } from 'react'
import {
  createItem, updateItem, deleteItem,
  JOB_TYPES, ZONE_TYPES, SPOTS, DEF_POSITIONS,
} from './api'
import type { Playbook, Shell, ShellJob, JobType } from './api'

const blank = (): Shell => ({ name: '', kind: 'zone', forcedLeverage: null, jobs: [] })

const JOB_HELP: Record<JobType, string> = {
  deep: 'Splits the deep part of the field. Depth is how far off the line he starts.',
  under: 'An underneath zone — needs a zone type (flat, curl or hook).',
  rush: 'Comes after the quarterback.',
  man: 'Covers a receiver. Who, exactly, is worked out at the snap by position and field side.',
  spy: 'Mirrors the quarterback rather than taking a receiver or a zone.',
}

export default function ShellEditor({ book, onSaved, onError }: {
  book: Playbook
  onSaved: (msg: string) => void
  onError: (e: unknown) => void
}) {
  const [id, setId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Shell>(blank())

  const load = (sid: string) => { setId(sid); setDraft(structuredClone(book.shells[sid])) }
  const reset = () => { setId(null); setDraft(blank()) }

  const setJob = (i: number, patch: Partial<ShellJob>) =>
    setDraft(d => ({ ...d, jobs: d.jobs.map((j, k) => (k === i ? { ...j, ...patch } : j)) }))

  const addJob = (job: JobType) =>
    setDraft(d => ({
      ...d,
      jobs: [...d.jobs, {
        job,
        positions: job === 'deep' ? ['S'] : job === 'rush' ? ['LB'] : ['LB'],
        ...(job === 'deep' ? { depth: 15, spot: 'third' } : {}),
        ...(job === 'under' ? { depth: 6, zone: 'hook', spot: 'middle' } : {}),
      }],
    }))

  const save = async () => {
    try {
      if (id) { await updateItem('shells', id, draft); onSaved(`Saved ${draft.name}`) }
      else { const r = await createItem('shells', draft); setId(r.id); onSaved(`Created ${draft.name}`) }
    } catch (e) { onError(e) }
  }

  const covers = draft.jobs.some(j => j.job === 'deep' || j.job === 'under' || j.job === 'man')
  const hasMan = draft.jobs.some(j => j.job === 'man')

  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ flex: '0 0 218px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7a70', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saved shells</span>
          <button onClick={reset} style={{ ...chip(false), padding: '2px 8px' }}>+ New</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 460, overflowY: 'auto' }}>
          {Object.keys(book.shells).length === 0 && <span style={{ fontSize: 13, color: '#4d5a52' }}>None yet.</span>}
          {Object.entries(book.shells).map(([sid, s]) => (
            <button key={sid} onClick={() => load(sid)} style={{
              textAlign: 'left', padding: '6px 9px', borderRadius: 5, cursor: 'pointer',
              background: id === sid ? '#24402c' : '#16241a',
              border: `1px solid ${id === sid ? '#3d7a4e' : '#22302880'}`, color: '#e8ecf1',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#8b9a90' }}>{s.kind} · {s.jobs.length} jobs</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: '1 1 460px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input placeholder="Shell name (Cover 3, Nickel Blitz…)" value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            style={{ ...input, flex: 1, minWidth: 200 }} />
          <select value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value as 'man' | 'zone' }))} style={input}>
            <option value="zone">Zone</option>
            <option value="man">Man</option>
          </select>
        </div>

        {/* Leverage: the one shading decision the AI makes for itself. */}
        <div style={{ background: '#16241a', border: '1px solid #2c3a30', borderRadius: 6, padding: '9px 12px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#9fb0a4', marginBottom: 6 }}>
            <b style={{ color: '#e8ecf1' }}>Leverage</b> — which way man defenders shade.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([null, 'in', 'out'] as const).map(v => (
              <button key={String(v)} onClick={() => setDraft(d => ({ ...d, forcedLeverage: v }))}
                style={chip(draft.forcedLeverage === v)}>
                {v === null ? 'AI chooses' : v === 'in' ? 'Always inside' : 'Always outside'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7a70', marginTop: 6 }}>
            {draft.kind === 'zone'
              ? 'A zone shell has no man defenders to shade, so this has no effect.'
              : draft.forcedLeverage === null
                ? 'The AI picks inside, outside or auto per call — three options it mixes between.'
                : 'Pinned. Use this when the call only makes sense one way.'}
            {' '}With no safety over the top, the engine plays UNDER regardless — leverage never overrides that.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#6b7a70', alignSelf: 'center', marginRight: 4 }}>Add job:</span>
          {JOB_TYPES.map(j => (
            <button key={j} onClick={() => addJob(j)} style={chip(false)} title={JOB_HELP[j]}>+ {j}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {draft.jobs.length === 0 && (
            <span style={{ fontSize: 13, color: '#4d5a52' }}>No jobs yet — add the deep players first, then the underneath ones.</span>
          )}
          {draft.jobs.map((j, i) => (
            <div key={i} style={{ background: '#16241a', border: '1px solid #2c3a30', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13, color: '#7ee08a', minWidth: 46 }}>{j.job}</b>

                <span style={{ fontSize: 11, color: '#6b7a70' }}>who:</span>
                {DEF_POSITIONS.map(pos => (
                  <button key={pos}
                    onClick={() => setJob(i, {
                      positions: j.positions.includes(pos)
                        ? j.positions.filter(p => p !== pos)
                        : [...j.positions, pos],
                    })}
                    style={chip(j.positions.includes(pos))}>{pos}</button>
                ))}

                {(j.job === 'deep' || j.job === 'under') && (
                  <>
                    <span style={{ fontSize: 11, color: '#6b7a70' }}>depth</span>
                    <input type="number" value={j.depth ?? 0} onChange={e => setJob(i, { depth: Number(e.target.value) })}
                      style={{ ...input, width: 56 }} />
                    <select value={j.spot ?? ''} onChange={e => setJob(i, { spot: e.target.value || undefined })} style={input}>
                      <option value="">(spot)</option>
                      {SPOTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </>
                )}

                {j.job === 'under' && (
                  <select value={j.zone ?? ''} onChange={e => setJob(i, { zone: e.target.value || undefined })} style={input}>
                    <option value="">(zone)</option>
                    {ZONE_TYPES.map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                )}

                <div style={{ flex: 1 }} />
                <button onClick={() => setDraft(d => ({ ...d, jobs: d.jobs.filter((_, k) => k !== i) }))}
                  style={{ ...chip(false), color: '#ff8b8b' }}>remove</button>
              </div>
              {j.job === 'under' && !j.zone && (
                <div style={{ fontSize: 11, color: '#e0a24e', marginTop: 5 }}>An underneath zone needs a zone type.</div>
              )}
              {j.positions.length === 0 && (
                <div style={{ fontSize: 11, color: '#e0a24e', marginTop: 5 }}>Pick at least one position that can do this job.</div>
              )}
            </div>
          ))}
        </div>

        {draft.jobs.length > 0 && !covers && (
          <div style={{ fontSize: 12, color: '#ff8b8b', marginBottom: 10 }}>
            Nobody is covering anyone — this shell rushes and spies only, which is a touchdown.
          </div>
        )}
        {draft.kind === 'man' && !hasMan && (
          <div style={{ fontSize: 12, color: '#e0a24e', marginBottom: 10 }}>
            Marked as man but has no <code>man</code> job — did you mean zone?
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={!draft.name || draft.jobs.length === 0} style={primary}>
            {id ? 'Save changes' : 'Create shell'}
          </button>
          {id && (
            <button onClick={async () => {
              try { await deleteItem('shells', id); reset(); onSaved('Deleted') } catch (e) { onError(e) }
            }} style={danger}>Delete</button>
          )}
        </div>
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
const chip = (on: boolean): React.CSSProperties => ({
  background: on ? '#3d7a4e' : '#16241a', color: '#e8ecf1',
  border: `1px solid ${on ? '#3d7a4e' : '#2c3a30'}`, borderRadius: 5,
  padding: '4px 9px', fontSize: 12, cursor: 'pointer',
})
