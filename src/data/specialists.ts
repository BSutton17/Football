// [Special Teams] Each team's Kicker and Punter (leg Power + Accuracy, 0–99). The Kicker handles
// field goals / extra points, the Punter handles punts. The authoritative copy used by the kick
// math lives on the server (Server/src/data/specialists.js) — this client copy is for presentation
// (showing the real name in the special-teams formation). Keep the two in sync.

export interface Specialist {
  name: string
  power: number
  accuracy: number
}
export interface TeamSpecialists {
  kicker: Specialist
  punter: Specialist
}

export const SPECIALISTS: Record<string, TeamSpecialists> = {
  BUF: { kicker: { name: 'Tyler Bass',        power: 92, accuracy: 84 }, punter: { name: 'Jake Camarda',      power: 95, accuracy: 82 } },
  MIA: { kicker: { name: 'Jason Sanders',     power: 91, accuracy: 87 }, punter: { name: 'Ryan Stonehouse',   power: 99, accuracy: 76 } },
  NE:  { kicker: { name: 'Andrés Borregales', power: 90, accuracy: 82 }, punter: { name: 'Bryce Baringer',    power: 96, accuracy: 84 } },
  NYJ: { kicker: { name: 'Harrison Mevis',    power: 99, accuracy: 78 }, punter: { name: 'Austin McNamara',   power: 94, accuracy: 80 } },
  BAL: { kicker: { name: 'Tyler Loop',        power: 94, accuracy: 79 }, punter: { name: 'Jordan Stout',      power: 97, accuracy: 83 } },
  CIN: { kicker: { name: 'Cade York',         power: 96, accuracy: 82 }, punter: { name: 'Ryan Rehkow',       power: 96, accuracy: 84 } },
  CLE: { kicker: { name: 'Dustin Hopkins',    power: 90, accuracy: 89 }, punter: { name: 'Corey Bojorquez',   power: 95, accuracy: 84 } },
  PIT: { kicker: { name: 'Chris Boswell',     power: 94, accuracy: 98 }, punter: { name: 'Cameron Johnston',  power: 97, accuracy: 86 } },
  HOU: { kicker: { name: "Ka'imi Fairbairn",  power: 92, accuracy: 94 }, punter: { name: 'Tommy Townsend',    power: 96, accuracy: 88 } },
  IND: { kicker: { name: 'Spencer Shrader',   power: 92, accuracy: 81 }, punter: { name: 'Rigoberto Sanchez', power: 95, accuracy: 87 } },
  JAX: { kicker: { name: 'Cam Little',        power: 94, accuracy: 84 }, punter: { name: 'Logan Cooke',       power: 98, accuracy: 90 } },
  TEN: { kicker: { name: 'Joey Slye',         power: 98, accuracy: 82 }, punter: { name: 'Johnny Hekker',     power: 94, accuracy: 88 } },
  DEN: { kicker: { name: 'Wil Lutz',          power: 93, accuracy: 91 }, punter: { name: 'Matt Haack',        power: 93, accuracy: 82 } },
  KC:  { kicker: { name: 'Harrison Butker',   power: 95, accuracy: 97 }, punter: { name: 'Matt Araiza',       power: 99, accuracy: 83 } },
  LV:  { kicker: { name: 'Daniel Carlson',    power: 96, accuracy: 95 }, punter: { name: 'AJ Cole',           power: 99, accuracy: 92 } },
  LAC: { kicker: { name: 'Cameron Dicker',    power: 92, accuracy: 95 }, punter: { name: 'JK Scott',          power: 97, accuracy: 88 } },
  DAL: { kicker: { name: 'Brandon Aubrey',    power: 99, accuracy: 97 }, punter: { name: 'Bryan Anger',       power: 97, accuracy: 90 } },
  NYG: { kicker: { name: 'Graham Gano',       power: 92, accuracy: 91 }, punter: { name: 'Jordan Stout',      power: 98, accuracy: 88 } },
  PHI: { kicker: { name: 'Jake Elliott',      power: 94, accuracy: 94 }, punter: { name: 'Braden Mann',       power: 95, accuracy: 84 } },
  WAS: { kicker: { name: 'Zane Gonzalez',     power: 91, accuracy: 86 }, punter: { name: 'Tress Way',         power: 96, accuracy: 92 } },
  CHI: { kicker: { name: 'Cairo Santos',      power: 90, accuracy: 95 }, punter: { name: 'Tory Taylor',       power: 98, accuracy: 86 } },
  DET: { kicker: { name: 'Jake Bates',        power: 99, accuracy: 86 }, punter: { name: 'Jack Fox',          power: 99, accuracy: 95 } },
  GB:  { kicker: { name: 'Brandon McManus',   power: 92, accuracy: 93 }, punter: { name: 'Daniel Whelan',     power: 96, accuracy: 87 } },
  MIN: { kicker: { name: 'Will Reichard',     power: 91, accuracy: 92 }, punter: { name: 'Ryan Wright',       power: 98, accuracy: 85 } },
  ATL: { kicker: { name: 'Younghoe Koo',      power: 91, accuracy: 94 }, punter: { name: 'Bradley Pinion',    power: 95, accuracy: 87 } },
  CAR: { kicker: { name: 'Matthew Wright',    power: 91, accuracy: 84 }, punter: { name: 'Sam Martin',        power: 94, accuracy: 86 } },
  NO:  { kicker: { name: 'Blake Grupe',       power: 89, accuracy: 90 }, punter: { name: 'Matthew Hayball',   power: 96, accuracy: 84 } },
  TB:  { kicker: { name: 'Chase McLaughlin',  power: 93, accuracy: 94 }, punter: { name: 'Jake Camarda',      power: 97, accuracy: 86 } },
  ARI: { kicker: { name: 'Chad Ryland',       power: 95, accuracy: 86 }, punter: { name: 'Blake Gillikin',    power: 96, accuracy: 88 } },
  LAR: { kicker: { name: 'Joshua Karty',      power: 94, accuracy: 89 }, punter: { name: 'Ethan Evans',       power: 97, accuracy: 85 } },
  SF:  { kicker: { name: 'Jake Moody',        power: 92, accuracy: 91 }, punter: { name: 'Thomas Morstead',   power: 94, accuracy: 90 } },
  SEA: { kicker: { name: 'Jason Myers',       power: 94, accuracy: 93 }, punter: { name: 'Michael Dickson',   power: 99, accuracy: 94 } },
}

export function getTeamSpecialists(teamId: string | null | undefined): TeamSpecialists | null {
  return teamId ? SPECIALISTS[teamId] ?? null : null
}
