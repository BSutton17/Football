// [275] X-Factor presentation metadata: each signature ability gets its own color + icon so it
// reads at a glance on the team card. `xFactorMeta` falls back to a neutral star for any ability
// not explicitly listed here.

export interface XFactorMeta {
  color: string   // accent color for the chip
  icon:  string   // single-glyph icon (emoji)
}

export const X_FACTORS: Record<string, XFactorMeta> = {
  'Shifty':                     { color: '#22d3ee', icon: '⚡' },
  'Ball Hawk':                  { color: '#f59e0b', icon: '🦅' },
  'Intimidator':                { color: '#ef4444', icon: '😤' },
  'Slant Slayer':               { color: '#a855f7', icon: '🗡️' },
  'Deep Pass Demon':            { color: '#8b5cf6', icon: '👹' },
  'Fast Thinking':              { color: '#34d399', icon: '🧠' },
  'High Point':                 { color: '#38bdf8', icon: '🙌' },
  'Mossed':                     { color: '#fb7185', icon: '🔥' },
  "I'm Always F*cking Open":    { color: '#10b981', icon: '🎯' },
  'Tight Window':               { color: '#f472b6', icon: '🪡' },
  'Cannon':                     { color: '#f97316', icon: '💣' },
  'Shake It Off':               { color: '#facc15', icon: '💨' },
  'Team Chemistry':             { color: '#60a5fa', icon: '🤝' },
  'Serious Dedication':         { color: '#4ade80', icon: '💪' },
}

const FALLBACK: XFactorMeta = { color: '#9ca3af', icon: '⭐' }

export function xFactorMeta(name?: string): XFactorMeta | null {
  if (!name) return null
  return X_FACTORS[name] ?? FALLBACK
}
