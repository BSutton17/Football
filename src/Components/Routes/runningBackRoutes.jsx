// runningBackRoutes.jsx
import React from 'react';
import { useAppContext } from '../../Context/AppContext';

const RunningBackRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize }) => {
  const {
    setSackTimeRemaining,
    setSelectedPlayerId,
    isOffense,
    setPlayers,
    socket,
    roomId
  } = useAppContext();

  const handleRouteClick = (route) => {
    assignRoute(player.id, route);

    setPlayers((prevPlayers) =>
      prevPlayers.map((p) => {
        if (p.id === player.id) {
          if (p.isBlocking) {
            setSackTimeRemaining((prev) => {
              const newTime = prev - (p.blocking * 5);
              socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
              return newTime;
            });
          }

          if (route === "run") {
            return { ...p, route: "run", runAngle: 0, isBlocking: false };
          }

          return { ...p, route, isBlocking: false };
        }
        return p;
      })
    );
  };

  const rotateRunAngle = (playerId, delta) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId && p.route === "run") {
          let newAngle = (p.runAngle ?? 60) + delta;
          newAngle = Math.max(-60, Math.min(60, newAngle)); 
          return { ...p, runAngle: newAngle };
        }
        return p;
      })
    );
  };

  return (
    <>
      {player.route !== "run" && (
        <>
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
              assignRoute(player.id, null);
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
          <button
            className={isOffense ? 'run' : "hide"}
            onClick={() => handleRouteClick('run')}
          >
            Run!
          </button>
        </>
        
      )}

      {player.route === "run" && (
        <div
          style={{
            position: "absolute",
            left: `${player.position.x - 30}px`,
            top: `${player.position.y - 50}px`,
            display: "flex",
            gap: "10px",
            zIndex: 5,
          }}
        >
          <button
            onClick={() => rotateRunAngle(player.id, -15)}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.633)",
              border: "1px solid black",
              borderRadius: "5px",
              padding: "2px 6px",
              cursor: "pointer"
            }}
          >
            ⟲
          </button>
          <button
            onClick={() => rotateRunAngle(player.id, 15)}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.633)",
              border: "1px solid black",
              borderRadius: "5px",
              padding: "2px 6px",
              cursor: "pointer"
            }}
          >
            ⟳
          </button>
        </div>
      )}
    </>
  );
};

export default RunningBackRoutes;
