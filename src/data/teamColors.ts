// Per-team colors that theme the team cards and drive the logo badges ([271][272]).
// Keyed by team id (the abbreviation used in nflTeams.ts). `primary` is the dominant
// jersey color, `secondary` the accent. These are not licensed marks — the "logo" is a
// styled abbreviation badge in the team's colors (see TeamLogo).

export interface TeamColors {
  primary: string
  secondary: string
}

export const TEAM_COLORS: Record<string, TeamColors> = {
  // AFC East
  BUF: { primary: '#00338D', secondary: '#C60C30' },
  MIA: { primary: '#008E97', secondary: '#FC4C02' },
  NE:  { primary: '#002244', secondary: '#C60C30' },
  NYJ: { primary: '#125740', secondary: '#FFFFFF' },
  // AFC North
  BAL: { primary: '#241773', secondary: '#9E7C0C' },
  CIN: { primary: '#FB4F14', secondary: '#101820' },
  CLE: { primary: '#311D00', secondary: '#FF3C00' },
  PIT: { primary: '#101820', secondary: '#FFB612' },
  // AFC South
  HOU: { primary: '#03202F', secondary: '#A71930' },
  IND: { primary: '#002C5F', secondary: '#A2AAAD' },
  JAX: { primary: '#006778', secondary: '#D7A22A' },
  TEN: { primary: '#0C2340', secondary: '#4B92DB' },
  // AFC West
  DEN: { primary: '#FB4F14', secondary: '#002244' },
  KC:  { primary: '#E31837', secondary: '#FFB81C' },
  LV:  { primary: '#101820', secondary: '#A5ACAF' },
  LAC: { primary: '#0080C6', secondary: '#FFC20E' },
  // NFC East
  DAL: { primary: '#003594', secondary: '#869397' },
  NYG: { primary: '#0B2265', secondary: '#A71930' },
  PHI: { primary: '#004C54', secondary: '#A5ACAF' },
  WAS: { primary: '#5A1414', secondary: '#FFB612' },
  // NFC North
  CHI: { primary: '#0B162A', secondary: '#C83803' },
  DET: { primary: '#0076B6', secondary: '#B0B7BC' },
  GB:  { primary: '#203731', secondary: '#FFB612' },
  MIN: { primary: '#4F2683', secondary: '#FFC62F' },
  // NFC South
  ATL: { primary: '#A71930', secondary: '#101820' },
  CAR: { primary: '#0085CA', secondary: '#101820' },
  NO:  { primary: '#D3BC8D', secondary: '#101820' },
  TB:  { primary: '#D50A0A', secondary: '#34302B' },
  // NFC West
  ARI: { primary: '#97233F', secondary: '#000000' },
  LAR: { primary: '#003594', secondary: '#FFA300' },
  SF:  { primary: '#AA0000', secondary: '#B3995D' },
  SEA: { primary: '#002244', secondary: '#69BE28' },
}

const FALLBACK: TeamColors = { primary: '#1f2937', secondary: '#9ca3af' }

export function teamColors(teamId: string): TeamColors {
  return TEAM_COLORS[teamId] ?? FALLBACK
}

// Perceived brightness (0–1) of a #rrggbb color — weighted for human perception.
export function brightness(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

// Legible text/icon color (black or white) to draw ON a given fill — black on light fills, white on
// dark ones. Used for the O/X marker so it stays readable on any team color.
export function textColorOn(hex: string): string {
  return brightness(hex) >= 0.55 ? '#000000' : '#ffffff'
}

// A legible accent color for text/phrases on the dark stadium background. Several teams use black
// (or near-black) as a brand color, which disappears against the backdrop — so we pick whichever of
// the team's two colors is brighter (usually the primary for those teams, e.g. Bengals orange,
// Saints gold), guaranteeing the phrase and overall stay readable.
export function accentColor(teamId: string): string {
  const { primary, secondary } = teamColors(teamId)
  return brightness(primary) >= brightness(secondary) ? primary : secondary
}
