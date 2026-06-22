import type { RosterPlayer } from '../types/player.ts'

// QB and OL are auto-placed at predetermined positions — not in the sidebar. The sidebar offers a
// pool of skill players (4 WR, 3 TE, 2 RB) to pick from; a team fields any legal subset of them.
export const OFFENSE_ROSTER: RosterPlayer[] = [
  { id: 'o_wr1', name: 'Jordan Banks', position: 'WR', ovr: 88, ratings: { speed: 91, catching: 85, routeRunning: 80 } },
  { id: 'o_wr2', name: 'Marcus Cole',  position: 'WR', ovr: 82, ratings: { speed: 88, catching: 80, routeRunning: 77 } },
  { id: 'o_wr3', name: 'Leo Vance',    position: 'WR', ovr: 76, ratings: { speed: 84, catching: 76, routeRunning: 72 } },
  { id: 'o_wr4', name: 'Reggie Tate',  position: 'WR', ovr: 72, ratings: { speed: 82, catching: 73, routeRunning: 70 } },
  { id: 'o_te1', name: 'Tyler Reed',   position: 'TE', ovr: 79, ratings: { speed: 72, catching: 78, blocking: 70 } },
  { id: 'o_te2', name: 'Sam Olsen',    position: 'TE', ovr: 75, ratings: { speed: 70, catching: 74, blocking: 74 } },
  { id: 'o_te3', name: 'Cole Reyes',   position: 'TE', ovr: 71, ratings: { speed: 67, catching: 70, blocking: 79 } },
  { id: 'o_rb1', name: 'Devon Hill',   position: 'RB', ovr: 85, ratings: { speed: 87, vision: 80, catching: 72, runPower: 78 } },
  { id: 'o_rb2', name: 'Mike Doss',    position: 'RB', ovr: 77, ratings: { speed: 84, vision: 76, catching: 68, runPower: 70 } },
]

// DL is auto-placed opposite the OL — not in the sidebar. The sidebar offers a pool of defenders
// (4 CB, 3 S, 4 LB) to pick from; a team fields any legal subset of them.
export const DEFENSE_ROSTER: RosterPlayer[] = [
  { id: 'd_cb1', name: 'Andre King',  position: 'CB', ovr: 86, ratings: { speed: 90, awareness: 82, strength: 68, press: 80 } },
  { id: 'd_cb2', name: 'Kyle Bass',   position: 'CB', ovr: 80, ratings: { speed: 87, awareness: 79, strength: 65, press: 74 } },
  { id: 'd_cb3', name: 'Trey Munoz',  position: 'CB', ovr: 75, ratings: { speed: 85, awareness: 76, strength: 64, press: 70 } },
  { id: 'd_cb4', name: 'Sean Polk',   position: 'CB', ovr: 72, ratings: { speed: 83, awareness: 74, strength: 66, press: 66 } },
  { id: 'd_s1',  name: 'Omar Wells',  position: 'S',  ovr: 84, ratings: { speed: 85, awareness: 84, strength: 72, press: 72 } },
  { id: 'd_s2',  name: 'Finn Gray',   position: 'S',  ovr: 79, ratings: { speed: 83, awareness: 81, strength: 70, press: 68 } },
  { id: 'd_s3',  name: 'Hank Doyle',  position: 'S',  ovr: 74, ratings: { speed: 81, awareness: 79, strength: 71, press: 64 } },
  { id: 'd_lb1', name: 'Ben Hart',    position: 'LB', ovr: 83, ratings: { strength: 80, awareness: 76, speed: 76 } },
  { id: 'd_lb2', name: 'Drew Lane',   position: 'LB', ovr: 78, ratings: { strength: 77, awareness: 74, speed: 78 } },
  { id: 'd_lb3', name: 'Josh Carr',   position: 'LB', ovr: 76, ratings: { strength: 75, awareness: 78, speed: 80 } },
  { id: 'd_lb4', name: 'Cal Reeves',  position: 'LB', ovr: 74, ratings: { strength: 79, awareness: 75, speed: 75 } },
]
