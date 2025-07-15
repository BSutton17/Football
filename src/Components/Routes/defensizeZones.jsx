// defensiveZones.jsx
import React from "react";
import { useAppContext } from "../../Context/AppContext";

const DefensiveZones = ({ player, offsetX = 0, offsetY = 0, fieldSize }) => {
  const {
    socket,
    roomId,
    players,
    setPlayers,
    setSackTimeRemaining,
    setSelectedPlayerId
  } = useAppContext();

    
  // translate offesnive y to defense for comparison
  function convertOffensiveYtoDefensiveY(offensiveY) {
    return offensiveY * 1.02597 + 281.58;
  } 

  // Helper function to find closest offensive player ID by Euclidean distance
    const findClosestOffensivePlayerId = (defenderPosition, players) => {
    let closestId = null;
    let closestDistSq = Infinity;

    players.forEach(p => {

        if (p.isOffense && p.role !== 'offensive-lineman' && p.role !== 'qb') {
        const dx = p.position.x - defenderPosition.x;
          
        if (Math.abs(dx) < closestDistSq) {
            closestDistSq = Math.abs(dx);
            closestId = p.id;
        }
        }
    });

    return closestId;
    };

    const assignZone = (id, coverage) => {
      if (coverage === "zone") {
        const defaultY = fieldSize.height / 4;

        setPlayers((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  zone: 'flat',
                  zoneCircle: {
                    id: `DZ-${Date.now()}-${Math.random()}`,
                    x: p.position.x,
                    y: defaultY,
                  },
                }
              : p
          )
        );

        socket.emit("assign_zone", {
          playerId: id,
          zoneType: "flat",
          zoneCircle: {
            id: `DZ-${Date.now()}-${Math.random()}`,
            x: players.find(p => p.id === id)?.position?.x || 0,
            y: defaultY,
          },
          room: roomId,
        });

        setSelectedPlayerId(null);
      } else if (coverage === "man") {
        setPlayers((prev) =>
          prev.map((p) => {
            if (p.id === id) {
              const offensivePlayerId = findClosestOffensivePlayerId(p.position, prev);
              return {
                ...p,
                zone: "man",
                assignedOffensiveId: offensivePlayerId,
                zoneCircle: null,
                hasCut: false,
              };
            }
            return p;
          })
        );

        socket.emit("assign_zone", {
          playerId: id,
          zoneType: "man",
          assignedOffensiveId: findClosestOffensivePlayerId(players.find(p => p.id === id)?.position, players),
          room: roomId,
        });

        setSelectedPlayerId(null);
      }
    };

    const revertBlitzIfNeeded = (playerId) => {
    setPlayers((prevPlayers) => {
        let blitzTimeToRevert = 0;
        const updatedPlayers = prevPlayers.map((p) => {
        if (p.id === playerId && p.isBlitzing) {
            blitzTimeToRevert = p.blitzing * 5; // Calculate how much time to revert
            return { ...p, isBlitzing: false };
        }
        return p;
        });

        if (blitzTimeToRevert > 0) {
        setSackTimeRemaining((prev) => {
            const newTime = prev + blitzTimeToRevert;
            socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
            return newTime;
        });
        }

        return updatedPlayers;
    });
    };


  return (
    <div className="zone-buttons">
      <button
        className="zone-btn"
        onClick={() => {
          revertBlitzIfNeeded(player.id);
          assignZone(player.id, "zone");
          setSelectedPlayerId(null);
        }}
        style={{ left: player.position.x, top: player.position.y - offsetY }}
      >
        Zone
      </button>

      <button
        className="zone-btn"
        onClick={() => {
          setSelectedPlayerId(null);

          setPlayers((prevPlayers) => {
            return prevPlayers.map((p) => {
              if (p.id === player.id) {
                const updatedBlitzing = !p.isBlitzing;
                const timeChange = player.blitzing * 5;

                setSackTimeRemaining((prev) => {
                  const newTime = updatedBlitzing ? prev - timeChange : prev + timeChange;
                  socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
                  return newTime;
                });

                const updatedPlayer = {
                  ...p,
                  isBlitzing: updatedBlitzing,
                };

                // If starting blitz, clear zone and man assignments
                if (updatedBlitzing) {
                  updatedPlayer.zone = null;
                  updatedPlayer.zoneCircle = null;
                  updatedPlayer.assignedOffensiveId = null;
                }

                return updatedPlayer;
              }
              return p;
            });
          });
        }}
        style={{ left: player.position.x + offsetX, top: player.position.y }}
      >
        {player.isBlitzing ? "Stop Blitz" : "Blitz"}
      </button>

      <button
        className="zone-btn"
        onClick={() => {
          revertBlitzIfNeeded(player.id);
          assignZone(player.id, "man");
          setSelectedPlayerId(null);
        }}
        style={{ left: player.position.x - offsetX, top: player.position.y }}
      >
        Man
      </button>
    </div>
  );
};

export default DefensiveZones;
