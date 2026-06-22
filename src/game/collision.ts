import type { PositionUpdate } from '../types/game.ts'
import { PLAYER } from '../constants/simulation.ts'

export function distBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// True when two player bodies are touching or overlapping
export function bodiesOverlap(a: PositionUpdate, b: PositionUpdate): boolean {
  return distBetween(a, b) < PLAYER.CONTACT_RADIUS
}

// Returns every pair of players whose bodies are in contact
export function findOverlaps(
  positions: PositionUpdate[],
): [PositionUpdate, PositionUpdate][] {
  const pairs: [PositionUpdate, PositionUpdate][] = []
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (bodiesOverlap(positions[i], positions[j])) {
        pairs.push([positions[i], positions[j]])
      }
    }
  }
  return pairs
}

// Nearest player to a point (yard coordinates), optionally excluding one id
export function nearestPlayer(
  point: { x: number; y: number },
  positions: PositionUpdate[],
  excludeId?: string,
): PositionUpdate | null {
  let nearest: PositionUpdate | null = null
  let minDist = Infinity
  for (const p of positions) {
    if (p.id === excludeId) continue
    const d = distBetween(point, p)
    if (d < minDist) { minDist = d; nearest = p }
  }
  return nearest
}

// Nearest opponent to a given player
export function nearestOpponent(
  player: PositionUpdate,
  positions: PositionUpdate[],
): PositionUpdate | null {
  let nearest: PositionUpdate | null = null
  let minDist = Infinity
  for (const p of positions) {
    if (p.team === player.team) continue
    const d = distBetween(player, p)
    if (d < minDist) { minDist = d; nearest = p }
  }
  return nearest
}
