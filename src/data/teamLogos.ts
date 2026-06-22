// Team logo image paths. The files live in public/teams/ (served at /teams/...). Most are .jpeg
// (renamed from the dropped source images — the bytes are still their original webp/png, which the
// browser's <img> decoder sniffs and renders, preserving transparency). Three remain .svg because
// they were vector files and no rasterizer was available to convert them to a real raster image.
//
// Every team now has an image; teams absent here would fall back to the colored abbreviation badge.

export const TEAM_LOGOS: Record<string, string> = {
  // AFC
  BUF: '/teams/BUF.jpeg', MIA: '/teams/MIA.jpeg', NE: '/teams/NE.jpeg', NYJ: '/teams/NYJ.svg',
  BAL: '/teams/BAL.jpeg', CIN: '/teams/CIN.jpeg', CLE: '/teams/CLE.jpeg', PIT: '/teams/PIT.jpeg',
  HOU: '/teams/HOU.jpeg', IND: '/teams/IND.jpeg', JAX: '/teams/JAX.jpeg', TEN: '/teams/TEN.jpeg',
  DEN: '/teams/DEN.jpeg', KC: '/teams/KC.jpeg', LV: '/teams/LV.svg', LAC: '/teams/LAC.jpeg',
  // NFC
  DAL: '/teams/DAL.svg', NYG: '/teams/NYG.jpeg', PHI: '/teams/PHI.jpeg', WAS: '/teams/WAS.jpeg',
  CHI: '/teams/CHI.svg', DET: '/teams/DET.jpeg', GB: '/teams/GB.jpeg', MIN: '/teams/MIN.jpeg',
  ATL: '/teams/ATL.jpeg', CAR: '/teams/CAR.jpeg', NO: '/teams/NO.jpeg', TB: '/teams/TB.jpeg',
  ARI: '/teams/ARI.jpeg', LAR: '/teams/LAR.jpeg', SF: '/teams/SF.jpeg', SEA: '/teams/SEA.jpeg',
}

export function teamLogo(teamId: string): string | null {
  return TEAM_LOGOS[teamId] ?? null
}
