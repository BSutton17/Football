export function resetPlayerMovementState(player) {
  return {
    ...player,
    currentSpeed: 0,
    moveTarget: null,
    moveDuration: null,
    moveStartTime: null,
    startPosition: null,
    currentWaypointIndex: null,
    waypoints: null,
    waypointDurations: null,
    pauseStartTime: null,
    pauseDuration: 0,
    routeProgress: 1,
    heading: null,
  };
}
