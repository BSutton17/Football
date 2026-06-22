import type { CoverageType, ZoneType } from '../types/routes.ts'
import { ZONE_CONFIGS, ZONE_TYPE_ORDER } from '../game/zones.ts'

interface Props {
  playerId: string
  position: string
  currentCoverage: CoverageType | undefined
  currentZoneType: ZoneType | undefined
  onSelect: (playerId: string, coverage: CoverageType, zoneType?: ZoneType) => void
  onClear: (playerId: string) => void
}

const BASE_OPTIONS: { type: CoverageType; label: string }[] = [
  { type: 'man',   label: 'Man'   },
  { type: 'blitz', label: 'Blitz' },
  { type: 'spy',   label: 'Spy'   },
]

const DL_OPTIONS: { type: CoverageType; label: string }[] = [
  { type: 'blitz', label: 'Blitz' },
  { type: 'spy',   label: 'Spy'   },
]

export default function CoverageMenu({ playerId, position, currentCoverage, currentZoneType, onSelect, onClear }: Props) {
  const isDL     = position === 'DL'
  const baseOpts = isDL ? DL_OPTIONS : BASE_OPTIONS
  const showZones = !isDL

  return (
    <div className="coverage-menu">
      <div className="coverage-menu-header">{position}</div>

      {baseOpts.map(({ type, label }) => (
        <button
          key={type}
          className={`coverage-btn${currentCoverage === type ? ' coverage-btn--active' : ''}`}
          onPointerDown={() => onSelect(playerId, type)}
        >
          {label}
        </button>
      ))}

      {showZones && (
        <>
          <div className="zone-section-label">ZONE</div>
          <div className="zone-btn-grid">
            {ZONE_TYPE_ORDER.map(zt => {
              const cfg    = ZONE_CONFIGS[zt]
              const active = currentCoverage === 'zone' && currentZoneType === zt
              return (
                <button
                  key={zt}
                  className={`zone-btn${active ? ' zone-btn--active' : ''}`}
                  style={{ '--zone-color': cfg.color } as React.CSSProperties}
                  onPointerDown={() => onSelect(playerId, 'zone', zt)}
                  title={cfg.label}
                >
                  {cfg.shortLabel}
                </button>
              )
            })}
          </div>
          {currentCoverage === 'zone' && currentZoneType && (
            <div
              className="zone-selected-name"
              style={{ color: ZONE_CONFIGS[currentZoneType].color }}
            >
              {ZONE_CONFIGS[currentZoneType].label}
            </div>
          )}
        </>
      )}

      {currentCoverage && (
        <button
          className="coverage-btn coverage-btn--none"
          onPointerDown={() => onClear(playerId)}
        >
          None
        </button>
      )}
    </div>
  )
}
