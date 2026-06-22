import { teamColors } from '../data/teamColors.ts'
import { teamLogo } from '../data/teamLogos.ts'

interface Props {
  teamId: string
  size?: number        // diameter in px
  selected?: boolean   // [272] animates (lifts + glows) when selected
}

// [272] A large team logo: the team's real logo image (public/teams/) framed in a circular badge
// of its colors. Teams without an image fall back to a styled abbreviation badge. Scales/glows
// when selected.
export default function TeamLogo({ teamId, size = 96, selected = false }: Props) {
  const { primary, secondary } = teamColors(teamId)
  const ring = Math.max(2, size * 0.06)
  const src  = teamLogo(teamId)

  return (
    <div
      className={`team-logo${selected ? ' team-logo--selected' : ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${primary} 0%, ${shade(primary, -0.35)} 100%)`,
        border: `${ring}px solid ${secondary}`,
        // The glow color tracks the team's accent so each badge pulses in its own colors.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--logo-glow' as any]: secondary,
      }}
    >
      {src ? (
        <img className="team-logo-img" src={src} alt={`${teamId} logo`} draggable={false} />
      ) : (
        <span
          className="team-logo-abbr"
          style={{ fontSize: size * 0.34, color: '#fff', textShadow: `0 1px 3px rgba(0,0,0,0.6)` }}
        >
          {teamId}
        </span>
      )}
    </div>
  )
}

// Darken (amount < 0) or lighten a hex color for the radial gradient's outer edge.
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const r = clamp(((n >> 16) & 0xff) * (1 + amount))
  const g = clamp(((n >> 8) & 0xff) * (1 + amount))
  const b = clamp((n & 0xff) * (1 + amount))
  return `rgb(${r}, ${g}, ${b})`
}
