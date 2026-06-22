import type { ZoneType } from '../types/routes.ts'

export interface ZoneConfig {
  label: string
  shortLabel: string
  color: string
  strokeColor: string
  halfWidthYards: number
  halfDepthYards: number
  rotation: number
}

const S = 2 / 3

export const ZONE_CONFIGS: Record<ZoneType, ZoneConfig> = {
  flat: { label: 'Flat', shortLabel: 'FL', color: '#90EE90', strokeColor: '#3a8a3a', halfWidthYards: 10 * S, halfDepthYards: 3.125 * S, rotation: 0 },
  deep: { label: 'Deep', shortLabel: 'DP', color: '#1E88E5', strokeColor: '#0d47a1', halfWidthYards: 13 * S, halfDepthYards: 9  * S, rotation: 0 },
  curl: { label: 'Curl', shortLabel: 'CU', color: '#FFD700', strokeColor: '#b39500', halfWidthYards: 7 * S, halfDepthYards: 7   * S, rotation: 0 },
  hook: { label: 'Hook', shortLabel: 'HK', color: '#7C3AED', strokeColor: '#4c1d95', halfWidthYards: 8 * S, halfDepthYards: 8   * S, rotation: 0 },
}

export const ZONE_TYPE_ORDER: ZoneType[] = ['flat', 'deep', 'curl', 'hook']
