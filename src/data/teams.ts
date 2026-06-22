import type { RosterPlayer } from '../types/player.ts'

export interface Team {
  id: string
  name: string
  roster: RosterPlayer[]
}

export const TEAMS: Team[] = [
  {
    id: 'vanguards',
    name: 'Vanguards',
    roster: [
      // QB
      { id: 'v-qb-1', name: 'M. Webb',  position: 'QB', ratings: { speed: 72, accel: 75, accuracy: 91 } },
      // WR
      { id: 'v-wr-1', name: 'D. Parks', position: 'WR', ratings: { speed: 95, accel: 92, routeRunning: 90, catching: 88 } },
      { id: 'v-wr-2', name: 'R. Elkins',position: 'WR', ratings: { speed: 88, accel: 86, routeRunning: 84, catching: 82 } },
      { id: 'v-wr-3', name: 'C. Nolan', position: 'WR', ratings: { speed: 83, accel: 80, routeRunning: 78, catching: 76 } },
      // TE
      { id: 'v-te-1', name: 'J. Moore', position: 'TE', ratings: { speed: 76, accel: 72, routeRunning: 74, catching: 80, blocking: 84 } },
      // RB
      { id: 'v-rb-1', name: 'T. Hayes', position: 'RB', ratings: { speed: 91, accel: 89, routeRunning: 80, catching: 74, blocking: 68, vision: 85 } },
      { id: 'v-rb-2', name: 'J. Cross', position: 'RB', ratings: { speed: 82, accel: 80, routeRunning: 74, catching: 70, blocking: 72, vision: 78 } },
      // OL
      { id: 'v-ol-1', name: 'B. Grant', position: 'OL', ratings: { blocking: 91, power: 88 } },
      { id: 'v-ol-2', name: 'L. Shaw',  position: 'OL', ratings: { blocking: 88, power: 85 } },
      { id: 'v-ol-3', name: 'K. Price', position: 'OL', ratings: { blocking: 90, power: 87 } },
      { id: 'v-ol-4', name: 'D. Rowe',  position: 'OL', ratings: { blocking: 85, power: 82 } },
      { id: 'v-ol-5', name: 'M. Flynn', position: 'OL', ratings: { blocking: 87, power: 84 } },
      // DL
      { id: 'v-dl-1', name: 'A. Stone', position: 'DL', ratings: { power: 88, speed: 68, accel: 72 } },
      { id: 'v-dl-2', name: 'R. Burns', position: 'DL', ratings: { power: 85, speed: 72, accel: 76 } },
      { id: 'v-dl-3', name: 'T. Cole',  position: 'DL', ratings: { power: 82, speed: 65, accel: 68 } },
      { id: 'v-dl-4', name: 'N. Wade',  position: 'DL', ratings: { power: 86, speed: 70, accel: 74 } },
      // LB
      { id: 'v-lb-1', name: 'S. Holt',  position: 'LB', ratings: { speed: 80, accel: 82, strength: 83, awareness: 84 } },
      { id: 'v-lb-2', name: 'E. Cruz',  position: 'LB', ratings: { speed: 78, accel: 79, strength: 80, awareness: 81 } },
      { id: 'v-lb-3', name: 'P. Ford',  position: 'LB', ratings: { speed: 76, accel: 76, strength: 77, awareness: 77 } },
      // CB
      { id: 'v-cb-1', name: 'I. James', position: 'CB', ratings: { speed: 92, accel: 90, strength: 70, awareness: 86 } },
      { id: 'v-cb-2', name: 'Q. Bell',  position: 'CB', ratings: { speed: 89, accel: 87, strength: 68, awareness: 83 } },
      { id: 'v-cb-3', name: 'F. Ross',  position: 'CB', ratings: { speed: 85, accel: 83, strength: 66, awareness: 78 } },
      // S
      { id: 'v-s-1',  name: 'O. King',  position: 'S',  ratings: { speed: 86, accel: 84, strength: 80, awareness: 87 } },
      { id: 'v-s-2',  name: 'H. Dean',  position: 'S',  ratings: { speed: 83, accel: 81, strength: 78, awareness: 84 } },
    ],
  },
  {
    id: 'reapers',
    name: 'Reapers',
    roster: [
      // QB
      { id: 'r-qb-1', name: 'Z. Carr',  position: 'QB', ratings: { speed: 78, accel: 80, accuracy: 85 } },
      // WR
      { id: 'r-wr-1', name: 'V. Miles', position: 'WR', ratings: { speed: 92, accel: 89, routeRunning: 86, catching: 85 } },
      { id: 'r-wr-2', name: 'G. Dunn',  position: 'WR', ratings: { speed: 86, accel: 84, routeRunning: 81, catching: 80 } },
      { id: 'r-wr-3', name: 'W. Tate',  position: 'WR', ratings: { speed: 80, accel: 78, routeRunning: 75, catching: 75 } },
      // TE
      { id: 'r-te-1', name: 'C. Vega',  position: 'TE', ratings: { speed: 74, accel: 70, routeRunning: 72, catching: 77, blocking: 82 } },
      // RB
      { id: 'r-rb-1', name: 'L. Nash',  position: 'RB', ratings: { speed: 88, accel: 86, routeRunning: 77, catching: 72, blocking: 70, vision: 80 } },
      { id: 'r-rb-2', name: 'B. Pope',  position: 'RB', ratings: { speed: 80, accel: 78, routeRunning: 72, catching: 68, blocking: 74, vision: 76 } },
      // OL
      { id: 'r-ol-1', name: 'U. Ball',  position: 'OL', ratings: { blocking: 86, power: 83 } },
      { id: 'r-ol-2', name: 'Y. Cook',  position: 'OL', ratings: { blocking: 84, power: 81 } },
      { id: 'r-ol-3', name: 'T. Hunt',  position: 'OL', ratings: { blocking: 89, power: 86 } },
      { id: 'r-ol-4', name: 'S. Long',  position: 'OL', ratings: { blocking: 83, power: 80 } },
      { id: 'r-ol-5', name: 'R. Fox',   position: 'OL', ratings: { blocking: 85, power: 82 } },
      // DL
      { id: 'r-dl-1', name: 'X. Payne', position: 'DL', ratings: { power: 93, speed: 74, accel: 78 } },
      { id: 'r-dl-2', name: 'W. Greer', position: 'DL', ratings: { power: 90, speed: 71, accel: 75 } },
      { id: 'r-dl-3', name: 'V. Knox',  position: 'DL', ratings: { power: 88, speed: 69, accel: 72 } },
      { id: 'r-dl-4', name: 'U. Lane',  position: 'DL', ratings: { power: 91, speed: 73, accel: 77 } },
      // LB
      { id: 'r-lb-1', name: 'T. Snow',  position: 'LB', ratings: { speed: 83, accel: 85, strength: 88, awareness: 88 } },
      { id: 'r-lb-2', name: 'S. Webb',  position: 'LB', ratings: { speed: 81, accel: 83, strength: 85, awareness: 85 } },
      { id: 'r-lb-3', name: 'R. Clay',  position: 'LB', ratings: { speed: 79, accel: 80, strength: 81, awareness: 81 } },
      // CB
      { id: 'r-cb-1', name: 'Q. Ray',   position: 'CB', ratings: { speed: 94, accel: 92, strength: 72, awareness: 90 } },
      { id: 'r-cb-2', name: 'P. Moss',  position: 'CB', ratings: { speed: 91, accel: 89, strength: 69, awareness: 87 } },
      { id: 'r-cb-3', name: 'O. Reed',  position: 'CB', ratings: { speed: 87, accel: 85, strength: 67, awareness: 82 } },
      // S
      { id: 'r-s-1',  name: 'N. West',  position: 'S',  ratings: { speed: 88, accel: 87, strength: 85, awareness: 91 } },
      { id: 'r-s-2',  name: 'M. Hart',  position: 'S',  ratings: { speed: 85, accel: 84, strength: 82, awareness: 88 } },
    ],
  },
]
