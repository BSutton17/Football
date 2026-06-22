// Vertical-only smooth camera for gameplay.
//
// Movement rules:
//   • Between plays (pre_snap / countdown / dead): target = LOS, no movement.
//   • Transition into pre_snap from dead: snap instantly so there's no drift
//     from the previous play's end position.
//   • Run play (live): target switches to ball carrier Y immediately.
//   • Pass play (live): target stays at LOS until the catch, then follows.
//
// The run/pass triggering is wired in by game-event handlers (future tickets).
// This file owns only the lerp state and the math.

export interface CameraState {
  currentY: number   // current rendered Y — offense-relative yards
  targetY:  number   // where the camera is heading
}

// Lerp speed — higher = snappier.  6 means ~90 % of the way in ~0.4 s.
const FOLLOW_SPEED = 6

export function createCamera(losYardLine: number): CameraState {
  return { currentY: losYardLine, targetY: losYardLine }
}

// Hard-jump with no lerp.  Use when starting a new play so the camera
// doesn't drift from the previous play's end position.
export function snapCamera(cam: CameraState, y: number): void {
  cam.currentY = y
  cam.targetY  = y
}

// Tell the camera where to move.  stepCamera() carries it there smoothly.
export function setCameraTarget(cam: CameraState, y: number): void {
  cam.targetY = y
}

// Advance the camera one frame.  dt = elapsed seconds since the last frame.
export function stepCamera(cam: CameraState, dt: number): void {
  const factor  = Math.min(1, dt * FOLLOW_SPEED)
  cam.currentY += (cam.targetY - cam.currentY) * factor
}
