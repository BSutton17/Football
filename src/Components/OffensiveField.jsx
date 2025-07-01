import React, { useEffect, useRef, useState, useMemo } from 'react';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import { calculateAllOpenness } from '../Utils/calculator';
import { getRoutePath, getRouteWaypoints } from '../Utils/routeUtils';
import teamData  from '../Teams.json'
import ReceiverRoutes from './Routes/receiverRoutes';
import TightEndRoutes from './Routes/tightEndRoutes';
import RunningBackRoutes from './Routes/runningBackRoutes';
import EndZoneGraphics from './EndZoneGraphics'

function OffensiveField({ offsetX, offsetY, socket }) {
  const {
    players,
    setSackTimeRemaining,
    liveCountdown,
    sackTimeRemaining,
    outcomeRef,
    setPlayers,
    selectedPlayerId,
    setSelectedPlayerId,
    setSelectedZoneId,
    setDraggingId,
    fieldSize,
    setLiveCountdown,
    routeStarted,
    setRouteStarted,
    setPaused,
    sackTimerRef,
    outcome,
    setOutcome,
    inventory,
    completedYards,
    yardLine,
    setRouteProgress,
    setOpeness,
    setInventory,
    offenseName, 
    preSnapRef,
    setDown,
    setDistance,
    setYardLine,
    down,
    distance,
    preSnapPlayers,
    isOffense,
    readyToCatchIds,
    setReadyToCatchIds,
    switchSides,
    roomId,
    currentYards, 
    setPreSnapPlayers,
    firstDownStartY, 
    setFirstDownStartY,
    thrownBallLine, 
    fieldRef
  } = useAppContext();

  const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();

  // Refs
  const animationFrameId = useRef(null);

  // Constants
  const lineOfScrimmageY = fieldSize.height / 2;
  const oneYardInPixels = fieldSize.height / 40;

  // listeners
  useEffect(() => {
    // Handle a new character placed on the field, adding or updating player info
    const handleCharacterPlaced = (data) => {
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };

      // Convert from normalized to pixel positions
      const pixelX = data.position.x * rect.width;
      const pixelY = data.position.y * rect.height;

      console.log("Normalized Position:", data.position);
      console.log("Converted to Pixels:", pixelX, pixelY);

      const newPlayer = {
        ...data,
        position: { x: pixelX, y: pixelY },
      };

      setPlayers(prevPlayers => {
        const playerId = data.id || data.playerId;
        const filtered = prevPlayers.filter(p => p.id !== playerId);
        return [...filtered, newPlayer];
      });
    };

    socket.on("play_stopped", () => {
      stopAllPlayerMovement();
      setRouteStarted(false);
      setOutcome(""); 
    });

    // Handle zone assignment from server
    const handleZoneAssigned = ({ playerId, zoneType, zoneCircle, assignedOffensiveId }) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === playerId) {
            if (zoneType === "man") {
              return {
                ...p,
                zone: "man",
                assignedOffensiveId,
                zoneCircle: null,
                hasCut: false,
              };
            } else {
              return {
                ...p,
                zone: zoneType,
                zoneCircle,
                assignedOffensiveId: null,
                hasCut: false,
              };
            }
          }
          return p;
        })
      );
    };

    const handleCharacterPositionUpdated = ({ playerId, normalizedX, normalizedY, isOffense }) => {
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };

      const pixelX = normalizedX * rect.width;
      const pixelY = isOffense ? (normalizedY * rect.height) - (rect.height/2 - 15) : (normalizedY * rect.height) - 15;

      setPlayers(prev =>
        prev.map(p =>
          p.id === playerId
            ? { ...p, position: { x: pixelX, y: pixelY } }
            : p
        )
      );
    };

    const handleZoneDefenderUpdate = (data) => {
      if (!data || !data.playerId || !data.position) return;

      setPlayers(prevPlayers =>
        prevPlayers.map(player => {
          if (player.id === data.playerId && player.zone !== 'man') {
            return {
              ...player,
              position: { ...data.position },
            };
          }
          return player;
        })
      );
    };

    const handleZoneAreUpdate = (data) => {
      const { playerId, zoneType, zoneCircle } = data;
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };

      const pixelX = zoneCircle.x * rect.width;
      const pixelY = zoneCircle.y * rect.height;
      console.log("Zone: " + pixelX + ", " + pixelY)

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          if (player.id === playerId) {
            return {
              ...player,
              zone: zoneType,
              zoneCircle: {
                ...zoneCircle,
                x: pixelX,
                y: pixelY,
              },
            };
          }
          return player;
        })
      );
    };

  const handleRemovePlayer = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

    // Register listeners
    socket.on("player_removed", handleRemovePlayer);
    socket.on("zone_area_assigned", handleZoneAreUpdate)
    socket.on("zone_defender_position_update", handleZoneDefenderUpdate);
    socket.on("character_position_updated", handleCharacterPositionUpdated);
    socket.on("character_placed", handleCharacterPlaced);
    socket.on("zone_assigned", handleZoneAssigned);

    return () => {
      socket.off("zone_defender_position_update", handleZoneDefenderUpdate);
      socket.off("character_position_updated", handleCharacterPositionUpdated);
      socket.off("character_placed", handleCharacterPlaced);
      socket.off("zone_assigned", handleZoneAssigned);
    };
  }, [socket]);

  // Misc
  let onField = false;

  // Utility
  function yardsToPixels(yards) {
    return yards * oneYardInPixels;
  }

function pixelsToYards(pixels) {
  return pixels / oneYardInPixels;
}

useEffect(() => {
  if (routeStarted) {
    players.forEach(player => {
      if (
        player.isOffense &&
        player.moveTarget &&
        !readyToCatchIds.has(player.id)
      ) {
        const delay = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;

        setTimeout(() => {
          setReadyToCatchIds(prev => {
            const newSet = new Set(prev).add(player.id);
            socket.emit("ready_to_catch", Array.from(newSet));
            return newSet;
          });
        }, delay);
      }
    });
  } else {
    setReadyToCatchIds(new Set());
  }
  }, [routeStarted, players]);

    // fix first Down marker on render
  const hasInitializedFirstDown = useRef(false);

  useEffect(() => {
    if (!hasInitializedFirstDown.current && fieldSize.height > 0) {
      console.log("[INIT ONCE] Setting firstDownStartY:", fieldSize.height / 4);
      setFirstDownStartY(fieldSize.height / 4);
      hasInitializedFirstDown.current = true;
    }
  }, [fieldSize.height]);

  const prevOutcomeRef = useRef(null);

  useEffect(() => {
    if (outcome && outcome !== prevOutcomeRef.current) {
      prevOutcomeRef.current = outcome;

    if (outcome === "Intercepted") {
      setTimeout(() => {
        switchSides(outcome, yardLine, fieldSize.height);
        preSnapRef.current = players.filter(p =>
        p.role === 'qb' ||
        p.role === 'offensive-lineman' ||
        p.role === 'defensive-lineman'
      );

      }, 3000);
    }
    else if (["Touchdown!", "Turnover on Downs", "Safety"].includes(outcome)) {
        setTimeout(() => {
          switchSides(outcome, yardLine, fieldSize.height);
        }, 3000);
        preSnapRef.current = players.filter(p =>
        p.role === 'qb' ||
        p.role === 'offensive-lineman' ||
        p.role === 'defensive-lineman'
      );
      }
    }
  }, [outcome, yardLine]);

  // reset
  const handleOutcomeResult = (outcomeValue, firstDownStartY) => {
    if (!isOffense || !outcomeValue === ""){
      return;
    } 

    console.log("firstDownStartY at start: " + firstDownStartY)

    const newTotal = currentYards + completedYards;

    let newYardLine = yardLine;
    let newDown = down;
    let newDistance = distance;
    let negativeYards = 0;
    let newTotalYards;
    let newFirstDownStartY = firstDownStartY ?? (fieldSize.height / 4); 
    console.log(firstDownStartY)

      if (outcome.includes("yard") && newTotal >= distance) {
        newYardLine = yardLine + completedYards;
        setYardLine(newYardLine);
        newFirstDownStartY = fieldSize.height/4
        setFirstDownStartY(newFirstDownStartY);
        newDistance = 10;
        setDistance(newDistance);
        newDown = 1
        setDown(newDown);
      } else if (outcome.includes("yard")) {
        newYardLine = yardLine + completedYards;
        setYardLine(newYardLine);
        newFirstDownStartY = firstDownStartY + yardsToPixels(completedYards)
        setFirstDownStartY(newFirstDownStartY);
        newDistance = distance - completedYards
        setDistance(newDistance);
        newDown = down + 1
        setDown(newDown);
      }
      else if (outcome === "Sacked") {
        negativeYards = Math.floor(Math.random() * (10 - 5)) + 5;
        newYardLine = yardLine - negativeYards;
        setYardLine(newYardLine);
        newFirstDownStartY = firstDownStartY - yardsToPixels(negativeYards)
        setFirstDownStartY(newFirstDownStartY);
        newDistance = distance + negativeYards
        setDistance(newDistance);
        newDown = down + 1
        setDown(newDown);
      }
      else if(outcome === "Intercepted" || outcome == "Turnover on Downs") {
        newYardLine = 100 - yardLine;
        setYardLine(newYardLine);
        newFirstDownStartY = fieldSize.height/4
        setFirstDownStartY(newFirstDownStartY);
        newDistance = 10
        setDistance(newDistance);
        newDown = 1
        setDown(newDown);
      }
      else if(outcome === "Touchdown!") {
        setYardLine(25);
        newFirstDownStartY = fieldSize.height/4
        setFirstDownStartY(newFirstDownStartY);
        newDistance = 10
        setDistance(newDistance);
        newDown = 1
        setDown(newDown);
      }
      else{
        setYardLine(newYardLine);
        setFirstDownStartY(newFirstDownStartY);
        setDistance(newDistance);
        newDown = down + 1
        setDown(newDown);
      }
    
    // Reset state
    //setCurrentYards(newTotalYards || 0);
    setRouteProgress({});
    setSelectedPlayerId(null);
    setSelectedZoneId(null);
    setDraggingId(null);
    setOpeness("");
    setPaused(false);
    setSackTimeRemaining(0);
    setLiveCountdown(null);
    setRouteStarted(false);
    if(outcome !== "Intercepted") {
      setPlayers(preSnapPlayers); 
    }
    //if (!["Touchdown!", "Intercepted"].includes(outcome)) {
      console.log("[OFFENSE] Emitting play_reset");
      socket.emit("play_reset", {
          newYardLine,
          newDown,
          newDistance,
          newFirstDownStartY: pixelsToYards(newFirstDownStartY),
          roomId
        });
     // }

    // Clear local outcome
    setOutcome("");
  };
  
  //Offensive lineman and QB
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fieldSize?.width && fieldSize?.height && !onField) {
        onField = true;
        let width = fieldSize.width
        let height = fieldSize.height
        const staticPlayers = [
        {
          id: 'QB',
          position: { x: width / 2, y: height / 6 },
          isOffense: true,
          role: 'qb',
        },
        {
          id: 'O-L1',
          position: { x: width / 2 - (width / 7), y: 25 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L2',
          position: { x: width / 2 - (width / 14), y: 20 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L3',
          position: { x: width / 2, y: 15 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L4',
          position: { x: width / 2 + (width / 14), y: 20 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L5',
          position: { x: width / 2 + (width / 7), y: 25 },
          isOffense: true,
          role: 'offensive-lineman',
        }
        ];

        setPlayers(prev => [...prev, ...staticPlayers]);
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [fieldSize?.width, fieldSize?.height]);

  // Assign route to player
  const assignRoute = (id, routeName) => {
    setPlayers(prev =>
      prev.map(p => (p.id === id ? { ...p, route: routeName } : p))
    );
    setSelectedPlayerId(null);
    socket.emit("assign_route", { playerId: id, routeName, room: roomId });
  };

  // When route starts, set move targets and movement info for players with routes
  useEffect(() => {
    if (routeStarted) {
      setSelectedPlayerId(null);
      setSelectedZoneId(null);
      setDraggingId(null);
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) => {
          if (p.isOffense && p.route) {
            const waypoints = getRouteWaypoints(
              fieldSize,
              p.position,
              p.route,
              offsetX,
              offsetY
            )
            let durations = [];

            for (let i = 0; i < waypoints.length; i++) {
              const from = i === 0 ? p.position : waypoints[i - 1];
              const to = waypoints[i];
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              durations.push(distance / (p.speed * 1.25) * 1000); // in ms
            }

            return {
            ...p,
            waypoints,
            waypointDurations: durations,
            currentWaypointIndex: 0,
            moveTarget: waypoints[0],
            moveDuration: durations[0],
            moveStartTime: performance.now(),
            startPosition: { ...p.position },
            routeProgress: 0,
          };

          }
          return p;
        })
      );
    } else {
      // Reset readyToCatchIds when route is not started
      setReadyToCatchIds(new Set());
    }
  }, [routeStarted, setPlayers, fieldSize, offsetX, offsetY]);

  useEffect(() => {
  console.log(`[WATCH] firstDownStartY changed → ${firstDownStartY}`);
}, [firstDownStartY]);


  const lastEmitTimeRef = useRef(0);
  // route running
    useEffect(() => {
      let lastEmitTime = 0;

      function animate(time) {
        setPlayers(prevPlayers => {
          let anyUpdated = false;
          const movingPlayers = [];

          const newPlayers = prevPlayers.map(p => {
            if (p.moveTarget && p.moveDuration && p.moveStartTime) {
              if (p.pauseStartTime) {
                const pauseElapsed = time - p.pauseStartTime;
                if (pauseElapsed >= p.pauseDuration) {
                  const nextIndex = (p.currentWaypointIndex ?? 0) + 1;

                  if (p.waypoints && nextIndex < p.waypoints.length) {
                    anyUpdated = true;
                    movingPlayers.push({
                      id: p.id,
                      position: p.moveTarget,
                      routeProgress: nextIndex / p.waypoints.length,
                    });
                    return {
                      ...p,
                      position: { ...p.moveTarget },
                      currentWaypointIndex: nextIndex,
                      moveTarget: p.waypoints[nextIndex],
                      moveDuration: p.waypointDurations[nextIndex],
                      moveStartTime: time,
                      startPosition: { ...p.moveTarget },
                      pauseStartTime: null,
                      pauseDuration: 0,
                      routeProgress: nextIndex / p.waypoints.length,
                    };
                  } else {
                    return {
                      ...p,
                      position: { ...p.moveTarget },
                      moveTarget: null,
                      moveDuration: null,
                      moveStartTime: null,
                      startPosition: null,
                      currentWaypointIndex: null,
                      waypoints: null,
                      waypointDurations: null,
                      routeProgress: 1,
                      velocity: null,
                      pauseStartTime: null,
                      pauseDuration: 0,
                    };
                  }
                } else {
                  anyUpdated = true;
                  movingPlayers.push({
                    id: p.id,
                    position: p.position,
                    routeProgress: p.routeProgress,
                  });
                  return { ...p };
                }
              } else {
                const elapsed = time - p.moveStartTime;
                const t = Math.min(elapsed / p.moveDuration, 1);

                const newX = p.startPosition.x + (p.moveTarget.x - p.startPosition.x) * t;
                const newY = p.startPosition.y + (p.moveTarget.y - p.startPosition.y) * t;

                if (t < 1) {
                  anyUpdated = true;
                  movingPlayers.push({
                    id: p.id,
                    position: { x: newX, y: newY },
                    routeProgress: p.waypoints ? (p.currentWaypointIndex + t) / p.waypoints.length : 0,
                  });
                  return {
                    ...p,
                    position: { x: newX, y: newY },
                    routeProgress: p.waypoints ? (p.currentWaypointIndex + t) / p.waypoints.length : 0,
                  };
                } else {
                  anyUpdated = true;
                  movingPlayers.push({
                    id: p.id,
                    position: p.moveTarget,
                    routeProgress: (p.currentWaypointIndex + 1) / p.waypoints.length,
                  });
                  return {
                    ...p,
                    position: { ...p.moveTarget },
                    pauseStartTime: time,
                    pauseDuration: 200 - (scale(p.routeRunning) * 2),
                  };
                }
              }
            }
            return p;
          });

          // Emit once per animation frame (or throttle if needed)
          if (anyUpdated && movingPlayers.length > 0 && time - lastEmitTime > 50) {
            lastEmitTime = time;
            socket.emit("player_positions_update", {
              players: movingPlayers,
              room: roomId,
            });
          }

          return anyUpdated ? newPlayers : prevPlayers;
        });

        requestAnimationFrame(animate);
      }

      requestAnimationFrame(animate);

      return () => {
        // cleanup if needed, e.g., cancelAnimationFrame
      };
    }, [socket, roomId, setPlayers]);



  // scales value from 60 --> 99 to 0 --> 99
  function scale(x) {
    return ((x - 60) / 39) * 99;
  }
  

  // Effect to handle readyToCatch timing
  useEffect(() => {
    if (routeStarted) {
      players.forEach(player => {
        if (
          player.isOffense &&
          player.moveTarget &&
          !readyToCatchIds.has(player.id)
        ) {
          const delay =
            Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;

          setTimeout(() => {
            setReadyToCatchIds(prev => new Set(prev).add(player.id));
          }, delay);
        }
      });
    } else {
      setReadyToCatchIds(new Set());
    }
  }, [routeStarted, players]);

  const offensivePlayers = players.filter(p => p.isOffense);
  const defensivePlayers = players.filter(p => !p.isOffense);
  const opennessScores = useMemo(() => {
  return calculateAllOpenness(offensivePlayers, defensivePlayers, fieldSize);
}, [players, fieldSize]);


const stopAllPlayerMovement = () => {

  setPlayers(prev =>
    prev.map(player => ({
      ...player,
      speed: 0,
      moveTarget: null,
      moveDuration: null,
      moveStartTime: null,
      startPosition: null,
      currentWaypointIndex: null,
      waypoints: null,
      waypointDurations: null,
      pauseStartTime: null,
      pauseDuration: 0,
      routeProgress: 1,
    }))
  );
};

  //Oline and DLine logic

  // Keep the ref updated with the latest outcome
  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome]);

useEffect(() => {
  if (!routeStarted) return;

  const OLineRating = inventory.OLine;
  const DLineRating = inventory.DLine;
  const variability = Math.random() * (500 - 200) + 200;

  const sackTime = (OLineRating * 60) - (DLineRating * 30) + variability;

  const totalTime = sackTimeRemaining + sackTime;
  setSackTimeRemaining(totalTime);
  setLiveCountdown(totalTime); // Triggers next effect
}, [routeStarted]);

useEffect(() => {
  if (!routeStarted || outcomeRef.current !== "" || !liveCountdown) return;

  if (sackTimerRef.current) clearTimeout(sackTimerRef.current);

  sackTimerRef.current = setTimeout(() => {
    console.log("Outcome as far as timer is concered: " + outcome.current)
    if (outcomeRef.current === "") {
      console.log("Sacked in offensiveField")
      setRouteStarted(false);
      socket.emit("route_started", { routeStarted: false, roomId });
      setOutcome("Sacked");
      socket.emit("play_outcome", {
        outcome: "Sacked",
        yardLine,
        roomId
      });
    } else {
      console.log(`[SACK TIMER] Outcome is NOT empty ("${outcomeRef.current}"). Not setting sack outcome.`);
    }
  }, liveCountdown);

  return () => clearTimeout(sackTimerRef.current);
}, [liveCountdown]);

  useEffect(() => {
    if (outcome != "") {
      // Stop all offensive and defensive movement
      stopAllPlayerMovement()
      setTimeout(()=>{
        if(firstDownStartY > 0)
        handleOutcomeResult(outcome, firstDownStartY);
      }, 3000)
      
      setTimeout(()=>{
          setRouteStarted(false);
      }, 100)

      //socket.emit("route_started", { routeStarted: false, roomId });
    }
  }, [outcome, routeStarted]);

  return (
    <>
      <EndZoneGraphics oneYardInPixels={oneYardInPixels} yardLine={yardLine}/>
    <div
      className={distance < 20 && yardLine < 90 ? "first-down" : "hide"}
      style={{ top: `${firstDownStartY}px`, position: 'absolute' }}
    ></div>

    <div
      className="line-of-scrimage"
      style={{ top: `${lineOfScrimmageY}px`, position: 'absolute' }}
    ></div>
    <div className="half bottom-half"     
      onDragOver={(e)=>handleDragOver(e)}
      onDrop={(e) => handleDrop(e,fieldSize?.height)}
    >
      {offensivePlayers.map(player => {
        const openness = opennessScores[player.id];
        let color = 'yellow';
        if (openness <= 3) color = 'lime';
        else if (openness >= 8) color = 'red';
        const readyToCatch = readyToCatchIds.has(player.id);
        return (
          <React.Fragment key={player.id}>
            <Player
              id={player.id}
              position={player.position}
              onMouseDown={isOffense ? (e) => handleMouseDown(e, player.id) : null}
              onTouchStart={isOffense ? (e) => handleTouchStart(e, player.id) : null}
              isOffense={true}
              bgColor={readyToCatch ? color : 'offense'}
              openess={color}
              routeStarted={routeStarted}
              route={player.route}
              role={player.role}
            />

            {outcome !== "" && (() => {
              
              if(!thrownBallLine) return;
              return (
                <svg
                  className="thrown-line-svg"
                >
                  <line
                    x1={fieldSize.width / 2}
                    y1={fieldSize.height / 6}
                    x2={thrownBallLine.x}
                    y2={thrownBallLine.y}
                    stroke="white"
                    strokeWidth="5"
                    strokeDasharray="6, 9"
                  />
                </svg>
              );
            })()}


            {/* Show route only if ball not snapped yet */}
            {isOffense && player.route && outcome == "" && !routeStarted && (
              <svg className="route-svg">
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
                    <path d="M0,0 L4,2 L0,4 Z" fill="yellow" />
                  </marker>
                </defs>

                {/* Route outline */}
                <path
                  d={getRoutePath(
                    fieldSize,
                    player.position.x,
                    player.position.y,
                    player.route,
                    offsetX,
                    offsetY
                  )}
                  stroke="yellow"
                  strokeWidth="5"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
              </svg>
            )}
            {player.isBlocking && (
              <svg className="route-svg">
                <path
                  d={getRoutePath(fieldSize, player.position.x, player.position.y, 'block', offsetX, offsetY)}
                  stroke="gray"
                  strokeWidth="4"
                  fill="none"
                />
              </svg>
            )}

            {/* Route assignment buttons */}
            {isOffense && selectedPlayerId === player.id && !routeStarted && player.role == "WR" && (
              <>
              <ReceiverRoutes
                player={player}
                assignRoute={assignRoute}
                offsetX={offsetX}
                offsetY={offsetY}
                fieldSize={fieldSize}
              />
              </>
            )}

            {isOffense && selectedPlayerId === player.id   && !routeStarted && player.role == "TE" && (
              <>
              <TightEndRoutes
                player={player}
                assignRoute={assignRoute}
                offsetX={offsetX}
                offsetY={offsetY}
                fieldSize={fieldSize}
              />
              </>
            )}

            {isOffense && selectedPlayerId === player.id  && !routeStarted && player.role == "RB" && (
              <>
              <RunningBackRoutes
                player={player}
                assignRoute={assignRoute}
                offsetX={offsetX}
                offsetY={offsetY}
                fieldSize={fieldSize}
              />
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
    </>
  );
}

export default OffensiveField;