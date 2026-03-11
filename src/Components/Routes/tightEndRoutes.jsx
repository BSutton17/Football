// tightEndRoutes.jsx
import React from 'react';
import { useAppContext } from '../../Context/AppContext';

const TightEndRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize, moreRoutes }) => {
  const screenX = (player.position.x / 800) * fieldSize.width;
  const screenY = (player.position.y / 600) * fieldSize.height;
  const isLeftAligned = player.position.x < 400;

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
      {moreRoutes ? (
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
        onClick={() => handleRouteClick('curl inside')}
        style={{
          left: isLeftAligned ? screenX + offsetX : screenX - offsetX,
          top: screenY,
        }}
      >
        Inside
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('flat')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Flat
      </button>

      {/* Block button with toggle logic */}
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
          left: screenX,
          top: screenY + offsetY,
        }}
      >
        Block
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('shallow')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Shallow
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('curl outside')}
        style={{
          left: !isLeftAligned ? screenX + offsetX : screenX - offsetX,
          top: screenY,
        }}
      >
        Outside
      </button>
      </>
      
      ) : (
      <>
      <button
        className="route-btn"
        onClick={() => handleRouteClick('corner')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY - offsetY,
        }}
      >
        Corner
      </button>

      <button
        className="route-btn"
        id="smaller"
        onClick={() => handleRouteClick('Deep Cross')}
        style={{
          left: screenX,
          top: screenY - offsetY,
        }}
      >
        Deep Cross
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('post')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY - offsetY,
        }}
      >
        Post
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('return')}
        style={{
          left: isLeftAligned ? screenX + offsetX : screenX - offsetX,
          top: screenY,
        }}
      >
        Return
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('curl')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Curl
      </button>

      {/* Block button with toggle logic */}
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
          left: screenX,
          top: screenY + offsetY,
        }}
      >
        Block
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('drag')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Drag
      </button>

      <button
        className="route-btn"
        onClick={() => handleRouteClick('zig')}
        style={{
          left: !isLeftAligned ? screenX + offsetX : screenX - offsetX,
          top: screenY,
        }}
      >
        Zig
      </button>
      </>
      )}
    </div>
  );
};

export default TightEndRoutes;
