// runningBackRoutes.jsx
import React from 'react';
import { useAppContext } from '../../Context/AppContext';

const runningBackRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize }) => {
  const { setSackTimeRemaining, setSelectedPlayerId, setPlayers, socket, roomId } = useAppContext();

  const handleRouteClick = (route) => {
    assignRoute(player.id, route);
    
    setPlayers((prevPlayers) =>
      prevPlayers.map((p) => {
        if (p.id === player.id) {
          if (p.isBlocking) {
            // If player was blocking, decrease sack timer
            setSackTimeRemaining((prev) => {
              const newTime = prev - (p.blocking * 5);
              socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
              return newTime;
            });
          }
          // Remove blocking status
          return { ...p, isBlocking: false };
        }
        return p;
      })
    );
  };

  return (
    <div className="route-buttons">
      <button
        className="route-btn"
        onClick={() => handleRouteClick('in')}
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
        onClick={() => handleRouteClick('go')}
        style={{
          left: player.position.x,
          top: player.position.y - offsetY,
        }}
      >
        Seam
      </button>
      <button
        className="route-btn"
        onClick={() => handleRouteClick('out')}
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
        onClick={() => handleRouteClick('texas')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x + offsetX
              : player.position.x - offsetX,
          top: player.position.y,
        }}
      >
        Texas
      </button>
      <button
        className="route-btn"
        onClick={() => handleRouteClick('wheel')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Wheel
      </button>
      <button
        className="route-btn"
        onClick={() => {
          setSelectedPlayerId(null);
          assignRoute(player.id, null)
          setPlayers((prevPlayers) =>
            prevPlayers.map((p) => {
              if (p.id === player.id) {
                const updatedBlocking = !p.isBlocking;
                const timeChange = player.blocking * 5;

                setSackTimeRemaining((prev) => {
                  const newTime = updatedBlocking ? prev + timeChange : prev - timeChange;
                  socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
                  return newTime;
                });

                return {
                  ...p,
                  isBlocking: updatedBlocking,
                };
              }
              return p;
            })
          );
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
        onClick={() => handleRouteClick('swing')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Swing
      </button>
      <button
        className="route-btn"
        onClick={() => handleRouteClick('rb flat')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x + offsetX
              : player.position.x - offsetX,
          top: player.position.y,
        }}
      >
        Flat
      </button>
    </div>
  );
};

export default runningBackRoutes;
