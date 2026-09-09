import type { CoverageType, ZoneType, ManCommit } from '../types/routes.ts'
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
  // [man commit] The commitment this defender is playing, and the toggle for it.
  currentManCommit: ManCommit | null | undefined
  onManCommit: (playerId: string, commit: ManCommit) => void
  // [dl drop] Whether THIS lineman is the one dropping, and the toggle. Only one may drop at a time.
  isDroppingDL: boolean
  onToggleDLDrop: (playerId: string) => void
}

// [man commit] Four ways to sell out in man coverage. Each takes something away and, by the same
// token, gives something up — the label is deliberately terse because these sit in a tight row.
const MAN_COMMITS: { id: ManCommit; label: string; title: string }[] = [
  { id: 'in',    label: 'IN',  title: 'Inside — takes away slants, digs and posts' },
  { id: 'out',   label: 'OUT', title: 'Outside — takes away outs, corners and comebacks' },
  { id: 'over',  label: 'OVR', title: 'Over the top — takes away everything deep' },
  { id: 'under', label: 'UND', title: 'Underneath — takes away the short stuff' },
]

const BASE_OPTIONS: { type: CoverageType; label: string }[] = [
  { type: 'man',   label: 'Man'   },
  { type: 'blitz', label: 'Blitz' },
  { type: 'spy',   label: 'Spy'   },
]

const DL_OPTIONS: { type: CoverageType; label: string }[] = [
  { type: 'blitz', label: 'Blitz' },
  { type: 'spy',   label: 'Spy'   },
]

export default function CoverageMenu({ playerId, position, currentCoverage, currentZoneType, onSelect, onClear, onZoneAll, zoneAllLabel, zoneAllDisabled, currentManCommit, onManCommit, isDroppingDL, onToggleDLDrop }: Props) {
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

      {/* [dl drop] One lineman may peel off the rush and drop into a hook zone behind the line.
          Only one at a time — dropping a second sends the first back to rushing. */}
      {isDL && (
        <button
          className={`coverage-btn coverage-btn--drop${isDroppingDL ? ' coverage-btn--active' : ''}`}
          onPointerDown={() => onToggleDLDrop(playerId)}
          title={isDroppingDL ? 'Send him back to rushing the passer' : 'Drop him into a short hook zone'}
        >
          {isDroppingDL ? 'Rush' : 'Drop Into Zone'}
        </button>
      )}

      {baseOpts.map(({ type, label }) => (
        <button
          key={type}
          className={`coverage-btn${currentCoverage === type ? ' coverage-btn--active' : ''}`}
          onPointerDown={() => onSelect(playerId, type)}
        >
          {label}
        </button>
      ))}

      {/* [man commit] Only meaningful once he is actually in man. Pressing the active one again
          clears it and he goes back to playing honest leverage. */}
      {currentCoverage === 'man' && (
        <>
          <div className="zone-section-label">MAN</div>
          <div className="zone-btn-grid">
            {MAN_COMMITS.map(({ id, label, title }) => (
              <button
                key={id}
                className={`zone-btn man-commit-btn${currentManCommit === id ? ' zone-btn--active' : ''}`}
                onPointerDown={() => onManCommit(playerId, id)}
                title={title}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

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
