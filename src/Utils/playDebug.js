export function logPlaySnapshot({ socket, event, payload }) {
  return { socket, event, payload };
}

export function logPlayerMovementReport({ socket, payload }) {
  const timestamp = new Date().toISOString();
  const message = '[PLAYER MOVEMENT DEBUG]';

  console.log(message, payload);

  if (socket) {
    socket.emit('client_log', {
      timestamp,
      message,
      context: payload,
    });
  }
}
