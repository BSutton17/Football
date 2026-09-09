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

// [man commit] The one thing a man defender is selling out to take away. Null/absent means he plays
// honest leverage off his alignment, as before.
//   'in'    inside — takes away slants, digs, posts
//   'out'   outside — takes away outs, corners, comebacks
//   'over'  over the top — takes away everything deep
//   'under' underneath — takes away the short and intermediate stuff
export type ManCommit = 'in' | 'out' | 'over' | 'under'

export type ZoneType = 'flat' | 'deep' | 'curl' | 'hook'
