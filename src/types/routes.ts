// Routes for WR, TE, and RB
export type RouteType =
  // Short
  | 'flat' | 'drag' | 'quick_out' | 'slant' | 'zig'
  // Medium
  | 'curl' | 'out' | 'cross' | 'comeback' | 'dig' | 'return'
  // Deep
  | 'go' | 'post' | 'corner' | 'seam' | 'wheel' | 'deep_cross'
  // TE-specific
  | 'angle' | 'delay'
  // RB-specific
  | 'swing' | 'check_down' | 'flare' | 'texas'
  // Assignment
  | 'block' | 'screen'

export type CoverageType = 'man' | 'zone' | 'blitz' | 'spy'

export type ZoneType = 'flat' | 'deep' | 'curl' | 'hook'
