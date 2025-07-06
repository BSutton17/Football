// DefensiveField.jsx
import React, { useState } from 'react';
import { useEffect, useRef } from 'react';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import {isMovingTowardDefender} from'../Utils/calculator'
import DefensiveZone from './Routes/defensizeZones'
import teamData from '../Teams.json'
function DefensiveField({ offsetX, offsetY, socket}) {
    const {
        players,
        selectedPlayerId,
        setSelectedPlayerId,
        setPreSnapPlayers,
        setPlayers,
        fieldSize,
        setCurrentYards,
        preSnapPlayers,
        routeStarted,
        outcome,
        setSackTimeRemaining,
        isPlayerOne,
        isOffense,
        setOutcome,
        setYardLine,
        setReadyToCatchIds,
        setRouteStarted,
        fieldRef, 
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
        preSnapRef,
        setThrownBallLine,
        gameClockRef,
        gameIntervalRef,
        gameClock, 
        setGameClock,
        quarter, 
        setQuarter
    } = useAppContext();

    const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();
    const [defensiveMessage, setDefensiveMessage] = useState("")
    const aspectRatio = fieldSize.width / fieldSize.height;
    const height = fieldSize.height
    const width = fieldSize.width
    const oneYardInPixels = fieldSize.height / 40;
    let cut = false
    

    // 🧠 Persist this across renders
    const cutTrackerRef = useRef(new Map());
      
   useEffect(() => {
  // Handle a new character placed on the field, adding or updating player info
  const handleCharacterPlaced = (data) => {
    const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };

    // Convert from normalized to pixel positions
    const pixelX = data.position.x * rect.width;
    const pixelY = data.position.y * rect.height;

    const newPlayer = {
      ...data,
      position: { x: pixelX, y: pixelY }, // Now correctly rendered
    };

    setPlayers(prevPlayers => {
      const playerId = data.id || data.playerId;
      const filtered = prevPlayers.filter(p => p.id !== playerId);
      return [...filtered, newPlayer];
    });
  };

  // Handle route started event - replace or update all players with new route data
  const handleRouteStarted = (data) => {
    setRouteStarted(data)
    if (!gameIntervalRef.current) {
          gameIntervalRef.current = setInterval(() => {
            gameClockRef.current -= 1000;
            setGameClock(gameClockRef.current);
    
            if (gameClockRef.current <= 0) {
              clearInterval(gameIntervalRef.current);
              gameIntervalRef.current = null;
    
              setQuarter((prev) => {
                if (prev < 4) {
                  setGameClock(300000);
                  gameClockRef.current = 300000;
                  return prev + 1;
                } else {
                  setOutcome("Game Over");
                  return prev;
                }
              });
            }
          }, 1000);
        }
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
  };
  
  const handleSackTimerUpdate = (data) => {
    setSackTimeRemaining(data); 
  };
  
  const handlePlayOutcome = ({ outcome, completedYards }) => {
    console.log("[DEFENSE] play_outcome received:", {
      outcome,
      completedYards
    });

    setOutcome(outcome);
    setCompletedYards(completedYards)
  };

socket.on("play_reset", (data) => {
  const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
  console.log("[DEFENSE] play_reset received");
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
  setPlayers(preSnapRef.current); 
  setOutcome(""); 
  setCurrentYards(0);
  setDistance(data.newDistance);
  setDown(data.newDown);
  setYardLine(data.newYardLine);
  setFirstDownStartY(yardsToPixels(data.newFirstDownStartY, rect.height / 40));

  if(data.outcome === "Touchdown!" || data.outcome === "Safety!" || data.outcome === "Turnover on Downs" || data.outcome === "Intercepted"){
    setTimeout(() => {
    preSnapRef.current = players.filter(p =>
      p.role === 'qb' ||
      p.role === 'offensive-lineman' ||
      p.role === 'defensive-lineman'
      )
    }, 50);
  }

  console.log("[DEFENSE] Play reset with update:", {
    yardLine: data.newYardLine,
    down: data.newDown,
    distance: data.newDistance,
    firstDownStartY: data.newFirstDownStartY
  });
});

  socket.on("ball_thrown", (normalizedX, normalizedY) =>{
    const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
    console.log("receiver in defense: " + normalizedX, normalizedY)
    setThrownBallLine({ x: normalizedX * rect.width, y: normalizedY * rect.height })
  })

  socket.on("pre_snap_players", (data) => {
      console.log("Made it to pre snap")
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
      const updatedPlayers = data.players.map(p => ({
    ...p,
    position: {
      x: p.position.x * rect.width,
      y: p.position.y * rect.height
    }
  }));

  setPreSnapPlayers(updatedPlayers);
  preSnapRef.current = updatedPlayers;

  })

  const handleOffenseSet = () => {
    console.log("defensiveMessage: " + defensiveMessage)
    setDefensiveMessage("10 seconds remaining");
    setTimeout(() => setDefensiveMessage(""), 10000);
  };

  const handleRemovePlayer = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

    // Register listeners
  socket.on("player_removed", handleRemovePlayer);
  socket.on("offense_set", handleOffenseSet);  
  socket.on('character_placed', handleCharacterPlaced);
  socket.on('route_started', handleRouteStarted);
  socket.on('player_positions_update', handlePlayerPositionsUpdate); // Use singular - must match server emit
  socket.on('ready_to_catch', handleReadyToCatch);
  socket.on('route_assigned', handleRouteAssigned);
  socket.on('play_outcome', handlePlayOutcome);
  socket.on("sack_timer_update", handleSackTimerUpdate);

  return () => {
    socket.off("offense_set", handleOffenseSet)
    socket.off('character_placed', handleCharacterPlaced);
    socket.off('route_started', handleRouteStarted);
    socket.off('player_positions_update', handlePlayerPositionsUpdate);
    socket.off('ready_to_catch', handleReadyToCatch);
    socket.off('route_assigned', handleRouteAssigned);
    socket.off('play_outcome', handlePlayOutcome);
    socket.off('play_reset')
    socket.off("ball_thrown")
  };
}, [socket]);

  function yardsToPixels(yards, mul) {
    return yards * mul;
  }

    //route starts
useEffect(() => {
  if (!routeStarted) return;

  const moveSpeed = 2; // pixels per update (tweak as needed)

  setPlayers(prevPlayers =>
    prevPlayers.map(p => {
      if (p.zone === 'man' && p.assignedOffensiveId) {
        const target = prevPlayers.find(op => op.id === p.assignedOffensiveId);
        if (target) {
          const dx = target.position.x - p.position.x;
          const dy = target.position.y - p.position.y;
          const distance = Math.hypot(dx, dy);

          if (distance > 1) {
            const ratio = moveSpeed / distance;
            return {
              ...p,
              position: {
                x: p.position.x + dx * ratio,
                y: p.position.y + dy * ratio,
              }
            };
          }
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
            position: { x: width / 2 - (width / 8), y: height / 2 - 12 },
            isOffense: false,
            role: 'defensive-lineman',
          },
          {
            id: 'D-L2',
            position: { x: width / 2 - (width / 22.5), y: height / 2 - 12 },
            isOffense: false,
            role: 'defensive-lineman',
          },
          {
            id: 'D-L3',
            position: { x: width / 2 + (width / 22.5), y: height / 2 - 12 },
            isOffense: false,
            role: 'defensive-lineman',
          },
          {
            id: 'D-L4',
            position: { x: width / 2 + (width / 8), y: height / 2 - 12 },
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
          const step = Math.min(p.speed * deltaTime, distance);

          const newPos = {
            x: p.position.x + (dx / distance) * step,
            y: p.position.y + (dy / distance) * step,
          };

          updated = true;

          return {
            ...p,
            position: newPos,
            lastUpdateTime: time,
          };
        }
        else if (p.isBlitzing) {
          const targetX = p.position.x > fieldSize.width / 2 ? fieldSize.width / 1.5 : fieldSize.width / 3.5;
          const targetY = fieldSize.height/2;

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
          const step = Math.min(p.speed * deltaTime, distance);

          const newPos = {
            x: p.position.x + (dx / distance) * step,
            y: p.position.y + (dy / distance) * step,
          };

          updated = true;

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

  return (
    <div className="half top-half"
      onDragOver={(e)=>handleDragOver(e)}
      onDrop={(e) => handleDrop(e, fieldSize?.height)}
    >
      <div className="defense-alert">{defensiveMessage}</div>
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
            fieldSize={fieldSize}
            />

            {/* Position label BELOW the circle */}
            {!routeStarted && !isOffense && (player.role == "LB" || player.role == "S" || player.role == "CB") && (
                <div
                  style={{
                    position: 'absolute',
                    left: `calc(${player.position.x}px - 1vw`,
                    top: player.position.y + 10,
                    color: 'white',
                    fontSize: '75%',
                    fontWeight: 'bold',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {player.role?.toUpperCase()}
                </div>
              )
            }

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

            {!isOffense && player.isBlitzing && outcome === "" && !routeStarted && (
              <svg className="man-svg">
                <defs>
                  <marker
                    id="arrow"
                    markerWidth="4"
                    markerHeight="4"
                    refX="2"
                    refY="2"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L4,2 L0,4 Z"fill="red" />
                  </marker>
                </defs>

                <path
                  d={`M ${player.position.x} ${player.position.y} L ${player.position.x > fieldSize.width / 2 ? fieldSize.width / 1.5 : fieldSize.width / 3.5} ${player.position.y + 50}`}
                  stroke="red"
                  strokeWidth="5"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              </svg>
            )}


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
              <DefensiveZone player={player} offsetX={offsetX} offsetY={offsetY} fieldSize={fieldSize}/>
            )}

        </React.Fragment>
        ))}

    </div>
  );
}

export default DefensiveField;