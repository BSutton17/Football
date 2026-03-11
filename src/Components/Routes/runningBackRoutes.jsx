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
    roomId,
    isSetClicked
  } = useAppContext();
  const controlOffsetX = Math.max(20, fieldSize.width * 0.07);
  const controlOffsetY = Math.max(32, fieldSize.height * 0.07);
  const controlGap = Math.max(8, fieldSize.width * 0.02);
  const screenX = (player.position.x / 800) * fieldSize.width;
  const screenY = (player.position.y / 600) * fieldSize.height;
  const isLeftAligned = player.position.x < 400;

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
                !isLeftAligned
                  ? screenX - offsetX
                  : screenX + offsetX,
              top: screenY - offsetY,
            }}
          >
            In
          </button>

          <button
            className="route-btn"
            onClick={() => handleRouteClick('go')}
            style={{
              left: screenX,
              top: screenY - offsetY,
            }}
          >
            Seam
          </button>

          <button
            className="route-btn"
            onClick={() => handleRouteClick('out')}
            style={{
              left:
                isLeftAligned
                  ? screenX - offsetX
                  : screenX + offsetX,
              top: screenY - offsetY,
            }}
          >
            Out
          </button>

          <button
            className="route-btn"
            onClick={() => handleRouteClick('texas')}
            style={{
              left:
                isLeftAligned
                  ? screenX + offsetX
                  : screenX - offsetX,
              top: screenY,
            }}
          >
            Texas
          </button>

          <button
            className="route-btn"
            onClick={() => handleRouteClick('wheel')}
            style={{
              left:
                isLeftAligned
                  ? screenX - offsetX
                  : screenX + offsetX,
              top: screenY + offsetY,
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
              left: screenX,
              top: screenY + offsetY,
            }}
          >
            Block
          </button>

          <button
            className="route-btn"
            onClick={() => handleRouteClick('swing')}
            style={{
              left:
                !isLeftAligned
                  ? screenX - offsetX
                  : screenX + offsetX,
              top: screenY + offsetY,
            }}
          >
            Swing
          </button>

          <button
            className="route-btn"
            onClick={() => handleRouteClick('rb flat')}
            style={{
              left:
                !isLeftAligned
                  ? screenX + offsetX
                  : screenX - offsetX,
              top: screenY,
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

      {player.route === "run" && !isSetClicked && (
        <div
          style={{
            position: "absolute",
            left: `${screenX - controlOffsetX}px`,
            top: `${screenY - controlOffsetY}px`,
            display: "flex",
            gap: `${controlGap}px`,
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
