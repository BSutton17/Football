// World coordinate system (offense-relative, as received from server):
//   X: 0 = left sideline → 53.33 = right sideline          (yards)
//   Y: 0 = own goal line → 100 = opponent goal line         (yards)
//   Y: -10 = back of own end zone, 110 = back of opponent end zone
// Canvas converts yards → CSS pixels per device: yardPx = canvasWidth / FIELD.WIDTH
// so the full field width always fills the screen horizontally.

// Field dimensions in yards
export const FIELD = {
  WIDTH: 53.33,          // sideline to sideline
  LENGTH: 120,           // full field including both end zones
  END_ZONE_DEPTH: 10,
  PLAY_LENGTH: 100,      // between the two goal lines
} as const

// Camera positioning.
// TARGET_VISIBLE_YARDS is the exact number of yards shown vertically on every
// device: yardPx = screenHeight / TARGET_VISIBLE_YARDS.  On wide/landscape
// screens the full field fits horizontally with dark bars on the sides.  On
// portrait phones the field extends beyond the left/right screen edges — a
// future horizontal-follow system will pan to keep the action in frame.
// LOS_FRAC biases the camera forward: LOS sits 25 % from the bottom so players
// see more of the field ahead than behind.
export const VIEWPORT = {
  TARGET_VISIBLE_YARDS: 37,   // yards visible top-to-bottom
  LOS_FRAC:             0.33, // LOS sits ~1/3 from the bottom of the canvas
} as const

// Player dimensions — must stay in sync with Server/src/constants.js PLAYER.
export const PLAYER = {
  RADIUS:         0.75,  // yards — visual radius and collision hitbox
  CONTACT_RADIUS: 1.5,   // yards center-to-center — bodies are touching (RADIUS * 2)
  MAX_SPEED:      8.0,   // yards per second (~16 mph)
} as const

// Standard football rules
export const RULES = {
  DOWNS: 4,
  FIRST_DOWN_YARDS: 10,
  QUARTERS: 4,
  QUARTER_SECONDS: 300,   // 5 minutes
  TD_POINTS: 7,
  SAFETY_POINTS: 2,
  KICKOFF_YARD_LINE: 25,
} as const

// Server simulation timing
export const SIM = {
  TICK_RATE: 20,          // ticks per second
  TICK_MS: 50,            // 1000 / TICK_RATE
} as const
