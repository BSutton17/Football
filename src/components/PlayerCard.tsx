import type { RosterPlayer } from '../types/player.ts'
import { teamColors, accentColor } from '../data/teamColors.ts'
import { teamLogo } from '../data/teamLogos.ts'
import { xFactorMeta } from '../data/xFactors.ts'

interface Props {
  player: RosterPlayer
  teamId: string
  index?: number   // for staggered entrance animation
}

// A sports trading-card style player tile: big overall, position, name, a portrait zone (team
// crest watermark + silhouette, since real player photos aren't available), and a glowing
// X-Factor chip. Used for a team's top three players ([274][275]).
export default function PlayerCard({ player, teamId, index = 0 }: Props) {
  const { primary, secondary } = teamColors(teamId)
  const logo = teamLogo(teamId)
  const xf   = xFactorMeta(player.xFactor)

  return (
    <div
      className="pcard"
      style={{
        animationDelay: `${0.12 + index * 0.1}s`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--p' as any]: primary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--s' as any]: secondary,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--accent' as any]: accentColor(teamId),
      }}
    >
      <div className="pcard-top">
        <span className="pcard-ovr">{player.ovr ?? '—'}</span>
        <span className="pcard-pos">{player.position}</span>
      </div>

      <div className="pcard-portrait">
        {logo && <img className="pcard-portrait-crest" src={logo} alt="" aria-hidden draggable={false} />}
        <svg className="pcard-silhouette" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5ZM4 21a8 8 0 0 1 16 0v.5H4V21Z"
          />
        </svg>
      </div>

      <div className="pcard-name">{player.name}</div>

      {xf && (
        <div
          className="pcard-xf"
          style={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--xf' as any]: xf.color,
          }}
          title={player.xFactor}
        >
          <span className="pcard-xf-icon">{xf.icon}</span>
          <span className="pcard-xf-name">{player.xFactor}</span>
        </div>
      )}
    </div>
  )
}
