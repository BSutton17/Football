// tightEndRoutes.jsx
import React from 'react';
import { useAppContext } from '../../Context/AppContext';

const tightEndRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize }) => {
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
        onClick={() => assignRoute(player.id, 'curl inside')}
        style={{
          left: player.position.x < fieldSize.width / 2 ? player.position.x + offsetX : player.position.x - offsetX,
          top: player.position.y,
        }}
      >
        inside
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'flat')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Flat
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
        onClick={() => assignRoute(player.id, 'shallow')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Shallow
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'curl outside')}
        style={{
          left: player.position.x > fieldSize.width / 2 ? player.position.x + offsetX : player.position.x - offsetX,
          top: player.position.y,
        }}
      >
       outside
      </button>
    </div>
  );
};

export default tightEndRoutes;
