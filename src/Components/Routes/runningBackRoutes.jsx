// runningBackRoutes.jsx
import React from 'react';
import { useAppContext } from '../../Context/AppContext';

const runningBackRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize }) => {
  const { setSackTimeRemaining, setSelectedPlayerId, socket, roomId } = useAppContext()
  return (
    <div className="route-buttons">
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'in')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y - offsetY,
        }}
      >
        In
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'go')}
        style={{
          left: player.position.x,
          top: player.position.y - offsetY,
        }}
      >
        Seam
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'out')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y - offsetY,
        }}
      >
        Out
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'texas')}
        style={{
          left: player.position.x < fieldSize.width / 2 ? player.position.x + offsetX : player.position.x - offsetX,
          top: player.position.y,
        }}
      >
        Texas
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'wheel')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        wheel
      </button>
      <button
        className="route-btn"
        onClick={() => {
          setSelectedPlayerId(null);
          setSackTimeRemaining((prev) => {
            const newTime = prev + (player.blitzing * 5);
            socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
            return newTime;
          });
        }}
        style={{
          left: player.position.x,
          top: player.position.y + offsetY,
        }}
      >
        Block
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'swing')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        swing
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'rb flat')}
        style={{
          left: player.position.x > fieldSize.width / 2 ? player.position.x + offsetX : player.position.x - offsetX,
          top: player.position.y,
        }}
      >
       flat
      </button>
    </div>
  );
};

export default runningBackRoutes;
