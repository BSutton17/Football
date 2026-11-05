// ── "They can save their trophy if they want" ([seasons]) ──────────────────
//
// A picture of it, made here on a canvas: the Lombardi, the team, the year and the record. A phone gets
// the share sheet, which has Save Image, and that is also the only thing that works from a home-screen
// app, where a download link goes nowhere. Anything else gets an ordinary download.

import { teamColors, accentColor } from '../data/teamColors.ts'
import { teamLogo } from '../data/teamLogos.ts'
import { LOMBARDI_SRC } from './art.tsx'
import { recordText, superBowlArt, teamAbbr, teamName } from './format.ts'
import type { Trophy } from './types.ts'

const W = 1080, H = 1350

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function fit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export async function renderTrophyImage(t: Trophy): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const { primary } = teamColors(t.teamId)
  const accent = accentColor(t.teamId)

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, primary)
  bg.addColorStop(0.62, '#0d0f13')
  bg.addColorStop(1, '#050608')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 560)
  glow.addColorStop(0, 'rgba(255,255,255,0.28)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const [trophy, logo, art] = await Promise.all([
    loadImage(LOMBARDI_SRC),
    teamLogo(t.teamId) ? loadImage(teamLogo(t.teamId)!) : Promise.resolve(null),
    loadImage(superBowlArt(t.year)),
  ])

  if (trophy) fit(ctx, trophy, W / 2 - 240, 60, 480, 900)
  if (art) fit(ctx, art, 56, 60, 240, 190)
  if (logo) fit(ctx, logo, W - 56 - 190, 60, 190, 190)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 44px system-ui, sans-serif'
  ctx.fillText(`SUPER BOWL ${t.numeral} CHAMPIONS`, W / 2, 1040)
  ctx.font = '800 92px system-ui, sans-serif'
  ctx.fillStyle = accent
  const name = teamName(t.teamId)
  ctx.fillText(name.length > 19 ? teamAbbr(t.teamId) : name, W / 2, 1140)
  ctx.font = '600 40px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText(`${t.year} season · ${recordText(t.record)} · ${t.playoffRecord.w}-${t.playoffRecord.l} in the playoffs`, W / 2, 1210)
  if (t.final) {
    ctx.font = '500 34px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    const homeWon = t.final.hs > t.final.as
    const [winner, winnerPts, loser, loserPts] = homeWon
      ? [t.final.home, t.final.hs, t.final.away, t.final.as]
      : [t.final.away, t.final.as, t.final.home, t.final.hs]
    ctx.fillText(`${teamAbbr(winner)} ${winnerPts}, ${teamAbbr(loser)} ${loserPts}${t.final.ot ? ' (OT)' : ''}`, W / 2, 1268)
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

// Returns false only if nothing could be done at all. Cancelling the share sheet counts as done.
export async function saveTrophyImage(t: Trophy): Promise<boolean> {
  const blob = await renderTrophyImage(t)
  if (!blob) return false
  const fileName = `${teamAbbr(t.teamId)}-super-bowl-${t.numeral}.png`
  const file = new File([blob], fileName, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Super Bowl ${t.numeral} Champions` })
      return true
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return true
      // Anything else falls through to the download.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

// What a champion's season screen has to hand, shaped like the stored trophy.
export function trophyFromSeason(view: {
  id: string; year: number; teamId: string; record: Trophy['record']; superBowl: { numeral: string }
  playoffs: { games: { round?: number; home: string; away: string; hs?: number; as?: number; ot?: boolean; status: string }[] } | null
}): Trophy {
  const games = view.playoffs?.games ?? []
  const mine = games.filter(g => g.status === 'final' && (g.home === view.teamId || g.away === view.teamId))
  const wins = mine.filter(g => (g.home === view.teamId ? g.hs! > g.as! : g.as! > g.hs!)).length
  const final = games.find(g => g.round === 4)
  return {
    _id: view.id,
    seasonId: view.id,
    year: view.year,
    numeral: view.superBowl.numeral,
    teamId: view.teamId,
    record: view.record,
    playoffRecord: { w: wins, l: mine.length - wins },
    final: final ? { home: final.home, away: final.away, hs: final.hs ?? 0, as: final.as ?? 0, ot: !!final.ot } : null,
    createdAt: new Date().toISOString(),
  }
}
