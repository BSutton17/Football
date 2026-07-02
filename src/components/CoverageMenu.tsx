import type { CoverageType, ZoneType } from '../types/routes.ts'
import { ZONE_CONFIGS, ZONE_TYPE_ORDER } from '../game/zones.ts'

interface Props {
  playerId: string
  position: string
  currentCoverage: CoverageType | undefined
  currentZoneType: ZoneType | undefined
  onSelect: (playerId: string, coverage: CoverageType, zoneType?: ZoneType) => void
  onClear: (playerId: string) => void
  // [zone all] Apply a whole coverage shell to every defender at once; label shows the NEXT preset.
  onZoneAll: () => void
  zoneAllLabel: string
  zoneAllDisabled: boolean   // grayed out until all 11 defenders are on the field
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

export default function CoverageMenu({ playerId, position, currentCoverage, currentZoneType, onSelect, onClear, onZoneAll, zoneAllLabel, zoneAllDisabled }: Props) {
  const isDL     = position === 'DL'
  const baseOpts = isDL ? DL_OPTIONS : BASE_OPTIONS
  const showZones = !isDL

  return (
    <div className="coverage-menu">
      <div className="coverage-menu-header">{position}</div>

      {/* [zone all] One-press coverage shell for the WHOLE defense (never moves anyone). Cycles
          Cover 2 → Cover 3 → Cover 4 → Reset; the label shows what the next press applies. Disabled
          until all 11 defenders are on the field. */}
      <button
        className="coverage-btn coverage-btn--zoneall"
        onPointerDown={zoneAllDisabled ? undefined : onZoneAll}
        disabled={zoneAllDisabled}
        title={zoneAllDisabled ? 'Place all 11 defenders first' : 'Assign a full coverage shell to every defender'}
      >
        Zone All: {zoneAllDisabled ? 'Place 11' : zoneAllLabel}
      </button>

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
