import type { PlayerPosition, PlayerRatings } from '../types/player.ts'

// Which ratings apply to each position
export const POSITION_ATTRIBUTES: Record<PlayerPosition, ReadonlyArray<keyof PlayerRatings>> = {
  QB:  ['speed', 'accel', 'accuracy'],
  WR:  ['speed', 'accel', 'routeRunning', 'catching'],
  TE:  ['speed', 'accel', 'routeRunning', 'catching', 'blocking'],
  RB:  ['speed', 'accel', 'routeRunning', 'catching', 'blocking', 'vision'],
  OL:  ['blocking', 'power'],
  DL:  ['power', 'speed', 'accel'],
  LB:  ['speed', 'accel', 'strength', 'awareness'],
  CB:  ['speed', 'accel', 'strength', 'awareness'],
  S:   ['speed', 'accel', 'strength', 'awareness'],
}

// Speed rating (1–99) → yards per second
// 99 → 9.9 yds/s   (elite receiver/CB)
// 70 → 7.0 yds/s   (average athlete)
// 55 → 5.5 yds/s   (DL)
export function ratingToMaxSpeed(speedRating: number): number {
  return speedRating / 10
}

// Accel rating (1–99) + max speed → acceleration in yards/sec²
// Higher accel = reaches top speed faster
// 99 accel → ~0.15s to max speed
// 50 accel → ~0.48s to max speed
// 1  accel → ~0.80s to max speed
export function ratingToAccel(accelRating: number, maxSpeed: number): number {
  const timeToMax = 0.8 - (accelRating / 99) * 0.65
  return maxSpeed / timeToMax
}
