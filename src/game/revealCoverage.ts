import type { DevReveal } from '../types/game.ts'
import { ZONE_CONFIGS } from './zones.ts'

// [dev reveal] The computer's coverage, expressed as the EXACT props the defense's own coverage goes
// through — `manTargets`, `zoneTypes`, `zoneCenters`, `blitzIds`, `spyIds`.
//
// ⚠️ THE POINT IS TO DRAW NOTHING NEW. The first version of the reveal overlay invented its own art:
// little chips and hollow rings in DOM, laid over a canvas that already knows how to draw cloud flats,
// deep zones, dashed man lines and blitz arrows. It looked nothing like the game, which made it hard
// to read and impossible to compare against a real defensive call. (The SHELLS panel had the same
// fault for the same reason.) Feeding these five values into `drawFrame` instead means the computer's
// call is rendered by the same code that renders a human's, so being on offense with the reveal on
// looks like being on offense and defense at once.
//
// Anything added here should be a MAPPING, never a drawing.

export interface RevealCoverage {
  manTargets: Record<string, string>
  zoneTypes: Record<string, string>
  zoneCenters: Record<string, { x: number; y: number }>
  blitzIds: string[]
  spyIds: string[]
}

export const EMPTY_REVEAL_COVERAGE: RevealCoverage = {
  manTargets: {}, zoneTypes: {}, zoneCenters: {}, blitzIds: [], spyIds: [],
}

export function revealCoverage(reveal: DevReveal | null): RevealCoverage | null {
  if (!reveal || reveal.aiRole !== 'defense' || !reveal.shell) return null

  const out: RevealCoverage = {
    manTargets: {}, zoneTypes: {}, zoneCenters: {}, blitzIds: [], spyIds: [],
  }

  for (const p of reveal.shell.players) {
    if (p.job === 'man' && p.covers) {
      out.manTargets[p.id] = p.covers
      continue
    }
    if (p.job === 'zone' && p.zone && p.zoneCenterX != null && p.zoneCenterY != null) {
      // ⚠️ A ZONE THE RENDERER CANNOT DRAW IS REPORTED, NOT FORWARDED. `drawZones` looks the name up
      // in ZONE_CONFIGS and silently skips a miss — so a shell naming a zone this client does not
      // know (a server-side rename, a fifth zone type) would make the overlay quietly draw nothing,
      // and "I can't see the zones" is a miserable thing to debug. The authored shells use exactly
      // the four names below; if that ever stops being true, this says so out loud.
      if (!(p.zone in ZONE_CONFIGS)) {
        console.warn(`[dev reveal] unknown zone "${p.zone}" on ${p.id} — the renderer cannot draw it`)
        continue
      }
      // Zone centres are stored offense-relative on the server, which is the frame this client
      // already renders in — so they need no conversion, only forwarding.
      out.zoneTypes[p.id] = p.zone
      out.zoneCenters[p.id] = { x: p.zoneCenterX, y: p.zoneCenterY }
      continue
    }
    if (p.job === 'spy') { out.spyIds.push(p.id); continue }
    // ⚠️ A RUSHER IS NOT A BLITZER. Every defender the server has no assignment for reads as
    // 'rush', and that includes the four auto-placed linemen. Marking those as blitzers would paint
    // blitz art across the base front on every single snap, which says nothing: a blitz is an EXTRA
    // rusher, so only the non-linemen count.
    if (p.job === 'rush' && !p.id.startsWith('auto_dl')) out.blitzIds.push(p.id)
  }

  return out
}
