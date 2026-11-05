import { useEffect, useRef } from 'react'

// ── The Lombardi ([seasons]) ───────────────────────────────────────────────
//
// Drawn here, not a photograph: a regulation football at the top of a tapered three-sided stand, in
// polished silver. Used on the champion screen, the trophy case and the saved image.

export const LOMBARDI_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 420" width="200" height="420">
  <defs>
    <linearGradient id="silver" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#7d858f"/><stop offset="0.22" stop-color="#f7f9fb"/>
      <stop offset="0.48" stop-color="#b4bcc6"/><stop offset="0.72" stop-color="#eef1f4"/>
      <stop offset="1" stop-color="#6d747e"/>
    </linearGradient>
    <linearGradient id="silverDark" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#565c65"/><stop offset="0.3" stop-color="#d7dce2"/>
      <stop offset="0.6" stop-color="#8e96a0"/><stop offset="1" stop-color="#4c525a"/>
    </linearGradient>
    <radialGradient id="ball" cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#ccd2d9"/>
      <stop offset="1" stop-color="#6b727b"/>
    </radialGradient>
  </defs>
  <!-- The football, tilted back for the throw -->
  <g transform="rotate(-38 100 78)">
    <ellipse cx="100" cy="78" rx="78" ry="45" fill="url(#ball)" stroke="#767d87" stroke-width="1.5"/>
    <path d="M36 62 Q100 38 164 62" fill="none" stroke="#858c96" stroke-width="1.6"/>
    <path d="M36 94 Q100 118 164 94" fill="none" stroke="#858c96" stroke-width="1.6"/>
    <g stroke="#f4f6f8" stroke-width="3.4" stroke-linecap="round">
      <path d="M72 78 H128"/>
      <path d="M80 70 V86"/><path d="M92 70 V86"/><path d="M104 70 V86"/><path d="M116 70 V86"/>
    </g>
  </g>
  <!-- The kicking tee the ball sits on, flowing down into the stand -->
  <path d="M76 132 C84 150 88 162 90 178 L110 178 C112 162 116 150 124 132 Q100 148 76 132 Z" fill="url(#silver)"/>
  <!-- The tapered stand -->
  <path d="M90 178 L110 178 L128 376 L72 376 Z" fill="url(#silver)"/>
  <path d="M100 178 L110 178 L128 376 L100 376 Z" fill="url(#silverDark)" opacity="0.55"/>
  <path d="M90 178 L94 178 L80 376 L72 376 Z" fill="#ffffff" opacity="0.35"/>
  <!-- Base -->
  <rect x="62" y="376" width="76" height="9" rx="2" fill="url(#silverDark)"/>
  <rect x="54" y="385" width="92" height="23" rx="3" fill="url(#silver)"/>
  <rect x="54" y="404" width="92" height="4" rx="1" fill="#59606a"/>
</svg>`

export const LOMBARDI_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(LOMBARDI_SVG)}`

export function Lombardi({ className }: { className?: string }) {
  return <img className={className} src={LOMBARDI_SRC} alt="The Lombardi Trophy" draggable={false} />
}

// ── Confetti ─────────────────────────────────────────────────────────────

interface Piece {
  x: number; y: number; vx: number; vy: number; size: number; color: string
  rot: number; vr: number; wobble: number; shape: 'rect' | 'ribbon'
}

export function Confetti({ colors, seconds = 9 }: { colors: string[]; seconds?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    size()
    window.addEventListener('resize', size)

    const palette = colors.length ? colors : ['#ffffff', '#ffd24a']
    const pieces: Piece[] = []
    const spawn = (count: number, fromX: number, spread: number) => {
      const w = canvas.width / dpr, h = canvas.height / dpr
      for (let i = 0; i < count; i++) {
        pieces.push({
          x: fromX * w,
          y: h * 0.72,
          vx: (Math.random() - 0.5) * spread + (fromX < 0.5 ? 2.5 : -2.5),
          vy: -7 - Math.random() * 10,
          size: 5 + Math.random() * 7,
          color: palette[Math.floor(Math.random() * palette.length)],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.34,
          wobble: Math.random() * Math.PI * 2,
          shape: Math.random() < 0.3 ? 'ribbon' : 'rect',
        })
      }
    }

    // Two cannons, then a steady fall from the top until the time is up.
    spawn(90, 0.08, 9)
    spawn(90, 0.92, 9)
    const start = performance.now()
    let lastBurst = start
    let raf = 0

    const frame = (now: number) => {
      const w = canvas.width / dpr, h = canvas.height / dpr
      const elapsed = (now - start) / 1000
      if (elapsed < seconds && now - lastBurst > 90 && pieces.length < 420) {
        lastBurst = now
        for (let i = 0; i < 3; i++) {
          pieces.push({
            x: Math.random() * w, y: -12, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2,
            size: 5 + Math.random() * 6, color: palette[Math.floor(Math.random() * palette.length)],
            rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, wobble: Math.random() * Math.PI * 2,
            shape: Math.random() < 0.3 ? 'ribbon' : 'rect',
          })
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i]
        p.vy = Math.min(p.vy + 0.17, 4.2)
        p.vx *= 0.985
        p.wobble += 0.09
        p.x += p.vx + Math.sin(p.wobble) * 0.9
        p.y += p.vy
        p.rot += p.vr
        if (p.y > h + 24) { pieces.splice(i, 1); continue }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        // Turning end over end in the air: narrow as it edges round.
        ctx.scale(1, Math.abs(Math.cos(p.wobble)) * 0.8 + 0.2)
        ctx.fillStyle = p.color
        if (p.shape === 'ribbon') ctx.fillRect(-p.size * 0.22, -p.size, p.size * 0.44, p.size * 2)
        else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.72)
        ctx.restore()
      }
      if (pieces.length || elapsed < seconds) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size) }
  }, [colors, seconds])

  return <canvas className="season-confetti" ref={ref} aria-hidden />
}
