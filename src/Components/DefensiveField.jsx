// DefensiveField.jsx
import React from 'react';
import { useEffect, useRef } from 'react';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import {isMovingTowardDefender} from'../Utils/calculator'
import teamData from '../Teams.json'
function DefensiveField({ offsetX, offsetY, socket}) {
    const {
        players,
        selectedPlayerId,
        setSelectedPlayerId,
        setPlayers,
        fieldSize,
        setCurrentYards,
        currentYards,
        routeStarted,
        outcome,
        setSackTimeRemaining,
        isPlayerOne,
        isOffense,
        setOutcome,
        setYardLine,
        setReadyToCatchIds,
        setRouteStarted,
        firstDownStartY, 
        setFirstDownStartY,
        setInventory,
        setQbPenalty,
        setDraggingId,
        setSelectedZoneId,
        setPaused,
        setOpeness,
        setLiveCountdown,
        setDown,
        setDistance,
        setRouteProgress,
        setCompletedYards,
        roomId,
        switchSides
    } = useAppContext();

    const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();
    const aspectRatio = fieldSize.width / fieldSize.height;
    const height = fieldSize.height
    const width = fieldSize.width
    let cut = false
    

    // 🧠 Persist this across renders
    const cutTrackerRef = useRef(new Map());
      
   useEffect(() => {
  // Handle a new character placed on the field, adding or updating player info
  const handleCharacterPlaced = (data) => {
    setPlayers(prevPlayers => {
      const playerId = data.id || data.playerId; // support both keys
      const filtered = prevPlayers.filter(p => p.id !== playerId);
      const updatedPlayers = [...filtered, data];
      return updatedPlayers;
    });
  };

  const handleCharacterPositionUpdated = ({ playerId, position }) => {
      setPlayers(prev =>
        prev.map(p => p.id === playerId ? { ...p, position } : p)
      );
    };

  // Handle route started event - replace or update all players with new route data
  const handleRouteStarted = (data) => {
    setRouteStarted(data)
  };

  // Handle incremental player positions update for animation
  const handlePlayerPositionsUpdate = (data) => {
    if (!data.players || data.players.length === 0) {
      return;
    }
    
    setPlayers(prevPlayers => {
      // Map through existing players and update positions from data
      return prevPlayers.map(player => {
        const updated = data.players.find(p => p.id === player.id);
        if (updated) {
          return {
            ...player,
            position: { ...updated.position }, // create new object to trigger re-render
            routeProgress: updated.routeProgress,
          };
        }
        return player;
      });
    });
  };
  
  // Other event listeners
  const handleReadyToCatch = (ids) => {
    setReadyToCatchIds(new Set(ids)); // make sure setReadyToCatchIds exists in your component
  };

  const handleRouteAssigned = ({ playerId, routeName }) => {
    setPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, route: routeName } : p))
    );
    //console.log("Player and route assigned: ", playerId, routeName);
  };
  
  const handleSackTimerUpdate = (data) => {
    //console.log("Sack timer update received:", data);
    setSackTimeRemaining(data); 
    //console.log("time remaining: " + data)
  };
  
  const handlePlayOutcome = ({ outcome, completedYards, firstDownStartY }) => {
    console.log("[DEFENSE] play_outcome received:", {
      outcome,
      completedYards,
      firstDownStartY
    });

    setOutcome(outcome);
    setCompletedYards(completedYards)
    setFirstDownStartY(firstDownStartY)
  };

  const handlePlayReset = (data) => {
    console.log("[DEFENSE] play_reset received");
    setInventory(data.inventory);
    setRouteProgress({});
    setSelectedPlayerId(null);
    setSelectedZoneId(null);
    setDraggingId(null);
    setOpeness("");
    setPaused(false);
    setSackTimeRemaining(0);
    setLiveCountdown(null);
    setQbPenalty(0);
    setRouteStarted(false);

    setPlayers(prev =>
      prev.filter(p =>
        p.role === 'qb' ||
        p.role === 'offensive-lineman' ||
        p.role === 'defensive-lineman')
    );

    setDistance(data.newDistance);
    setDown(data.newDown);
    setYardLine(data.newYardLine);

    setOutcome(""); // Ready for next play
  };
  
  socket.on("play_stopped", ({ yardLine, down, distance }) => {
    setRouteStarted(false);
    setOutcome("");

    setYardLine(yardLine);
    setDown(down);
    setDistance(distance);
    setCurrentYards(0); // Reset for next drive
    setRouteProgress({});
    setSelectedPlayerId(null);
    setSelectedZoneId(null);
    setDraggingId(null);
    setOpeness("");
    setPaused(false);
    setSackTimeRemaining(0);
    setLiveCountdown(null);
    setQbPenalty(0);

    setPlayers(prev =>
      prev.filter(p =>
        p.role === 'qb' ||
        p.role === 'offensive-lineman' ||
        p.role === 'defensive-lineman')
    );

    setInventory({
      offense: teamData[offenseName].offensivePlayers,
      defense: teamData[defenseName].defensivePlayers,
      OLine: teamData[offenseName].OLine,
      DLine: teamData[defenseName].DLine,
    });

    console.log("[DEFENSE] Play stopped with update:", { yardLine, down, distance });
  });

  // Register listeners
  socket.on("character_position_updated", handleCharacterPositionUpdated);
  socket.on('character_placed', handleCharacterPlaced);
  socket.on('route_started', handleRouteStarted);
  socket.on('player_positions_update', handlePlayerPositionsUpdate); // Use singular - must match server emit
  socket.on('ready_to_catch', handleReadyToCatch);
  socket.on('route_assigned', handleRouteAssigned);
  socket.on('play_outcome', handlePlayOutcome);
  socket.on('play_reset', handlePlayReset);
  socket.on("sack_timer_update", handleSackTimerUpdate);
  socket.on("play_reset", handlePlayReset);

  return () => {
    socket.off("play_reset", handlePlayReset);
    socket.off("character_position_updated", handleCharacterPositionUpdated);
    socket.off('character_placed', handleCharacterPlaced);
    socket.off('route_started', handleRouteStarted);
    socket.off('player_positions_update', handlePlayerPositionsUpdate);
    socket.off('ready_to_catch', handleReadyToCatch);
    socket.off('route_assigned', handleRouteAssigned);
    socket.off('play_outcome', handlePlayOutcome);
    socket.off('play_reset', handlePlayReset);
    socket.off("play_stopped")
  };
}, [socket]);

    //route starts
  useEffect(() => {
    if (!routeStarted) return;

    //console.log("🏈 DefensiveField: Route started");
    
    const now = performance.now();

    setPlayers(prevPlayers =>
      prevPlayers.map(p => {
        if (!p.isOffense && p.zoneCircle) {
          //console.log(`🛡️ ZONE defender ${p.id} assigned to move to (${p.zoneCircle.x}, ${p.zoneCircle.y})`);
        }

        if (p.zone === 'man' && p.assignedOffensiveId) {
          const target = prevPlayers.find(op => op.id === p.assignedOffensiveId);
          if (target) {
            const dx = target.position.x - p.position.x;
            const dy = target.position.y - p.position.y;
            const distance = Math.hypot(dx, dy);
            //console.log(`👤 MAN defender ${p.id} tracking offensive ${target.id}. Distance: ${distance.toFixed(2)}`);
          } else {
            //console.warn(`⚠️ Defender ${p.id} assigned to missing offensive player ${p.assignedOffensiveId}`);
          }
        }

        return p;
      })
    );
  }, [routeStarted, setPlayers]);


    useEffect(() => {
      const timer = setTimeout(() => {
        if (fieldSize?.width && fieldSize?.height) {
          let width = fieldSize.width
          let height = fieldSize.height
          const staticPlayers = [
            {
            id: 'D-L1',
            position: { x: width / 2 - (width / 8), y: height / 2 - 25 },
            isOffense: false,
            role: 'defensive-lineman',
          },
          {
            id: 'D-L2',
            position: { x: width / 2 - (width / 22.5), y: height / 2 - 25 },
            isOffense: false,
            role: 'defensive-lineman',
          },
          {
            id: 'D-L3',
            position: { x: width / 2 + (width / 22.5), y: height / 2 - 25 },
            isOffense: false,
            role: 'defensive-lineman',
          },
          {
            id: 'D-L4',
            position: { x: width / 2 + (width / 8), y: height / 2 - 25 },
            isOffense: false,
            role: 'defensive-lineman',
          }
          ];
    
          setPlayers(prev => [...prev, ...staticPlayers]);
        }
      }, 10);
    
      return () => clearTimeout(timer);
    }, [fieldSize?.width, fieldSize?.height]);

    // route duration
    useEffect(() => {
      let lastEmitTime = 0;
    if (!routeStarted) return;

    let animationFrameId;
    const emitThrottle = new Map();

    const animate = (time) => {
        setPlayers(prevPlayers => {
        let updated = false;

        const newPlayers = prevPlayers.map(p => {
            if (p.zone === 'man' && p.assignedOffensiveId) {
            const target = prevPlayers.find(op => op.id === p.assignedOffensiveId);
            if (!target) return p;

            const fieldHeight = fieldSize.height;
            const scale = fieldHeight / 524;
            const losOffset = 250 * scale;

            // ⏸️ Defender is currently paused
            if (p.pauseUntil && time < p.pauseUntil) {
                return p;
            }

            // ✅ Resume from pause
            if (p.pauseUntil && time >= p.pauseUntil) {
                p = { ...p, pauseUntil: null };
            }

            // 🟣 Detect WR cut and pause this defender (once)
            const hasPaused = cutTrackerRef.current.get(p.id);
            if (target.currentWaypointIndex > 0 && !hasPaused && !p.hasCut) {
                  // Scale reactionTime from 60–99 to 500ms–0ms delay
                const maxDelay = 200; // max delay in ms
                const minRating = 60;
                const maxRating = 99;

                const delay = ((maxRating - p.reactionTime) / (maxRating - minRating)) * maxDelay;
                p.hasCut = true;
                cutTrackerRef.current.set(p.id, true);
                setTimeout(()=>{
                    cutTrackerRef.current.set(p.id, false);
                }, delay)
            }

            if(target.currentWaypointIndex == 2){
                const routeSpeed = 200 - (((target.routeRunning - 60) / 39) * 99 * 2)
                const delay = p.reactionTime - routeSpeed;
                p.hasCut = true;
                cutTrackerRef.current.set(p.id, true);
                setTimeout(()=>{
                    cutTrackerRef.current.set(p.id, false);
                }, delay)
            }

            // 🔁 Movement logic
            const dx = target.position.x - p.position.x;
            const dy = (target.position.y + losOffset) - p.position.y;
            const distance = Math.hypot(dx, dy);

            const lastTime = p.lastUpdateTime || time;
            const deltaTime = (time - lastTime) / 1000;
            if (distance > 0.1) {
               if((target.position.y + losOffset) < p.position.y || (target.currentWaypointIndex > 0 && !isMovingTowardDefender)){
                const step = hasPaused ? 0 : Math.min((p.speed * 1.25) * deltaTime, distance);
                updated = true;

                return {
                ...p,
                position: {
                    x: p.position.x + (dx / distance) * step,
                    y: p.position.y + (dy / distance) * step,
                },
                lastUpdateTime: time,
                };
            }

            return { ...p, lastUpdateTime: time };
                }
            }

           // Handle ZONE coverage movement:
       else if (p.zone !== 'man' && p.zoneCircle) {
          const targetX = p.zoneCircle.x;
          const targetY = p.zoneCircle.y;

          const dx = targetX - p.position.x;
          const dy = targetY - p.position.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 0.5) {
            if (p.lastUpdateTime) {
              updated = true;
              return { ...p, lastUpdateTime: null, position: { x: targetX, y: targetY } };
            }
            return p;
          }

          const lastTime = p.lastUpdateTime || time;
          const deltaTime = (time - lastTime) / 1000;
          const speed = p.speed || 100; // Adjust as needed
          const step = Math.min(speed * deltaTime, distance);

          const newPos = {
            x: p.position.x + (dx / distance) * step,
            y: p.position.y + (dy / distance) * step,
          };

          updated = true;

          // Emit updated zone player position with throttling:
          // const lastEmit = emitThrottle.get(p.id) || 0;
          // if (time - lastEmit > 50) {
          //   socket.emit("zone_defender_position_update", {
          //     playerId: p.id,
          //     position: newPos,
          //     room: roomId,
          //   });
          //   emitThrottle.set(p.id, time);
          // }

          return {
            ...p,
            position: newPos,
            lastUpdateTime: time,
          };
        }

        if (p.lastUpdateTime) {
          updated = true;
          return { ...p, lastUpdateTime: null };
        }

        return p;
      });

      return updated ? newPlayers : prevPlayers;
    });

    animationFrameId = requestAnimationFrame(animate);
  };

  animationFrameId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(animationFrameId);
}, [routeStarted, setPlayers, fieldSize.height, socket, roomId]);
  
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

  return (
    <div className="half top-half"
      onDragOver={(e)=>handleDragOver(e)}
      onDrop={(e) => handleDrop(e, fieldSize?.height)}
    >
      {players.filter(p => p.isOffense === false).map((player) => (
        <React.Fragment key={player.id}>
            <Player
            id={player.id}
            position={player.position}
            onMouseDown={!isOffense ? (e) => handleMouseDown(e, player.id) : null}
            onTouchStart={!isOffense ? (e) => handleTouchStart(e, player.id) : null}
            isOffense={false}
            routeStarted={routeStarted}
            role={player.role}
            />

            {/* Draw line to assigned offensive player in man coverage */}
            {!isOffense && player.zone === 'man' &&
            outcome === "" &&
            !routeStarted &&
            player.assignedOffensiveId &&
            (() => {
              const target = players.find(p => p.id === player.assignedOffensiveId);
              const fieldHeight = fieldSize.height;
              const scale = fieldHeight / 524;
              const losOffset = 262 * scale;

              if (!target || !target.position || !player.position) return null;

              const dy = target.position.y + losOffset;

              return (
                <svg className="man-svg">
                  <line
                    x1={player.position.x}
                    y1={player.position.y}
                    x2={target.position.x}
                    y2={dy}
                    stroke="gray"
                    strokeWidth="5"
                  />
                </svg>
              );
            })()}

            {/* In Zone coverage Draw line to zoneCircle and circle itself */}
            {!isOffense && player.zoneCircle && (
            <svg className='zone-svg'>
                <line
                x1={player.position.x}
                y1={player.position.y}
                x2={player.zoneCircle.x}
                y2={player.zoneCircle.y}
                stroke="blue"
                strokeWidth="2"
                />
                <ellipse
                cx={player.zoneCircle.x}
                cy={player.zoneCircle.y}
                rx={
                    player.zone === "hook" || player.zone === "cloud"
                    ? aspectRatio < 1
                        ? fieldSize.area / 5000
                        : fieldSize.area / 10000
                    : aspectRatio < 1
                    ? fieldSize.area / 3500
                    : fieldSize.area / 7500
                }
                ry={
                    player.zone === "hook" || player.zone === "cloud"
                    ? aspectRatio < 1
                        ? fieldSize.area / 5000
                        : fieldSize.area / 10000
                    : aspectRatio < 1
                    ? fieldSize.area / 7000
                    : fieldSize.area / 25000
                }
                fill={
                    player.zone === "deep"
                    ? "rgba(0, 0, 255, 0.3)"
                    : player.zone === "flat"
                    ? "rgba(173, 216, 230, 0.3)" // light blue
                    : player.zone === "hook"
                    ? "rgba(255, 255, 0, 0.3)" // yellow
                    : player.zone === "cloud"
                    ? "rgba(99, 2, 99, 0.6)" // purple
                    : "rgba(0, 0, 255, 0.3)" // fallback
                }
                stroke="blue"
                strokeWidth={2}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => handleMouseDown(e, player.zoneCircle.id)}
                onTouchStart={(e) => handleTouchStart(e, player.zoneCircle.id)}
                />
            </svg>
            )}

            {!isOffense && selectedPlayerId === player.id && !routeStarted && (
            <div className="zone-buttons">
                <button
                className="zone-btn"
                onClick={() => assignZone(player.id, "zone")}
                style={{ left: player.position.x, top: player.position.y - offsetY }}
                >Zone</button>

                <button
                className="zone-btn"
                onClick={() => {
                  setSelectedPlayerId(null);
                  setSackTimeRemaining((prev) => {
                    const newTime = prev - (player.blitzing * 5);
                    socket.emit("sack_timer_update", { sackTimeRemaining: newTime, roomId });
                    return newTime;
                  });
                }}
                style={{ left: player.position.x + offsetX, top: player.position.y }}
                >Blitz</button>

                <button
                className="zone-btn"
                onClick={() => assignZone(player.id, "man")}
                style={{ left: player.position.x - offsetX, top: player.position.y }}
                >Man</button>
            </div>
            )}
        </React.Fragment>
        ))}

    </div>
  );
}

export default DefensiveField;
