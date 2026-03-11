export function logPlaySnapshot({ socket, event, payload }) {
  return { socket, event, payload };
}

export function logPlayerMovementReport({ socket, payload }) {
  return { socket, payload };
}
