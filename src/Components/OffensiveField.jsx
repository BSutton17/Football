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

function OffensiveField({ offsetX, offsetY, socket }) {
  const {
    players,
    setCompletedYards,
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
    setSackTimeRemaining,
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
    defenseName,
    setDown,
    setDistance,
    setYardLine,
    down,
    distance,
    isPlayerOne,
    setQbPenalty,
    isOffense,
    readyToCatchIds,
    setReadyToCatchIds,
    switchSides,
    roomId,
    currentYards, 
    setCurrentYards,
    firstDownStartY, 
    setFirstDownStartY
  } = useAppContext();

  const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();

  // Refs
  const animationFrameId = useRef(null);

  // Constants
  const lineOfScrimmageY = fieldSize.height / 2;
  const oneYardInPixels = fieldSize.height / 40;
  const endZoneHeight = 10 * oneYardInPixels;
  const yardsPast80 = Math.max(0, yardLine - 80);
  const visibleYards = Math.min(10, yardsPast80);
  const visibleEndZoneHeight = visibleYards * oneYardInPixels;

  const offsetFromTop = yardLine <= 90 ? 0 : (yardLine - 90) * oneYardInPixels;

  // listeners
useEffect(() => {
  // Handle a new character placed on the field, adding or updating player info
  const handleCharacterPlaced = (data) => {
    //console.log("OFFENSE");
    //console.log("Received character placement data:", data);

    setPlayers((prevPlayers) => {
      const playerId = data.id || data.playerId;
      //console.log("Player ID to replace:", playerId);

      const filtered = prevPlayers.filter((p) => p.id !== playerId);
      //console.log("Remaining players after filter:", filtered.map((p) => p.id));

      const updatedPlayers = [...filtered, data];
      //console.log("Updated players list:", updatedPlayers.map((p) => p.id));

      return updatedPlayers;
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

    //console.log("Zone assigned:", { playerId, zoneType, zoneCircle, assignedOffensiveId });
  };

  const handleCharacterPositionUpdated = ({ playerId, position }) => {
    setPlayers(prev =>
      prev.map(p => p.id === playerId ? { ...p, position } : p)
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

    setPlayers((prevPlayers) =>
      prevPlayers.map((player) => {
        if (player.id === playerId) {
          return {
            ...player,
            zone: zoneType,
            zoneCircle: zoneCircle,
          };
        }
        return player;
      })
    );
  };


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


  useEffect(() => {
    if (outcome === "Touchdown!" || outcome === "Intercepted" || outcome === "Switch Sides") {
      //socket.emit("switch_sides", { roomId, outcome, yardLine });
      switchSides(outcome, yardLine);
    }
  }, [outcome]);

  // reset
  const handleOutcomeResult = (outcomeValue) => {
    if (!isOffense || !outcomeValue === ""){
      console.log("here")
      return;
    } 

    const newTotal = currentYards + completedYards;

    let newYardLine = yardLine;
    let newDown = down;
    let newDistance = distance;
    let negativeYards = 0;
    let newTotalYards;
    let newFirstDownStartY = firstDownStartY

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
    setQbPenalty(0);
    setRouteStarted(false);

    setPlayers(prev =>
      prev.filter(p =>
        p.role === 'qb' ||
        p.role === 'offensive-lineman' ||
        p.role === 'defensive-lineman')
    );

    if (!["Touchdown!", "Intercepted"].includes(outcome)) {
      setInventory({
        offense: teamData[offenseName].offensivePlayers,
        defense: teamData[defenseName].defensivePlayers,
        OLine: teamData[offenseName].OLine,
        DLine: teamData[defenseName].DLine,
      });
    }
    
    console.log("[OFFENSE] Emitting play_outcome:", outcome);
    socket.emit("play_outcome", {
      outcome,
      completedYards,
      firstDownStartY: newFirstDownStartY,
      roomId
    });
    
    if (!["Touchdown!", "Intercepted"].includes(outcome)) {
      console.log("[OFFENSE] Emitting play_reset");
      socket.emit("play_reset", {
        newYardLine,
        newDown,
        newDistance,
        inventory,
      });
    }
    
    socket.emit("play_stopped", {
      yardLine: newYardLine,
      down: newDown,
      distance: newDistance,
      roomId,
    });

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
    //console.log("Player and route: " + id + ", " + routeName)
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
    outcomeRef.current = '';
  }, [outcome]);

  //QB sack timer
  useEffect(() => {
    if (routeStarted) {
      const OLineRating = inventory.OLine;
      const DLineRating = inventory.DLine;
      const variability = Math.random() * (500 - 200) + 200;

      const sackTime = (OLineRating * 60) - (DLineRating * 30) + variability;
      console.log(`[SACK TIMER] routeStarted, sackTime: ${sackTime}, current outcome: "${outcome}"`);

      //update timer and send it to the defense
      setSackTimeRemaining((prev) => {
        const newTime = prev + sackTime;
        return newTime;
      });

      sackTimerRef.current = setTimeout(() => {
        console.log(`[SACK TIMER FIRED] outcomeRef.current: "${outcomeRef.current}"`);
        if (outcomeRef.current === "") {
          console.log("[SACK TIMER] Outcome is empty. Setting outcome to 'Sacked'");
          setRouteStarted(false);
          socket.emit("route_started", { routeStarted: false, roomId });
          setOutcome("Sacked");
          socket.emit("play_outcome", {
            outcome: "Sacked",
            yardLine,
            firstDownStartY,
            roomId
          });
          
        } else {
          console.log(`[SACK TIMER] Outcome is NOT empty ("${outcomeRef.current}"). Not setting sack outcome.`);
        }
      }, sackTime);
    }

    return () => {
      if (sackTimerRef.current) {
        console.log("[SACK TIMER] Clearing sack timer");
        clearTimeout(sackTimerRef.current);
      }
    };
  }, [routeStarted, setOutcome, setRouteStarted, setPlayers]);

  useEffect(() => {
  if (outcome != "") {
    // Stop all offensive and defensive movement
    stopAllPlayerMovement()
    setTimeout(()=>{
      handleOutcomeResult(outcome);
    }, 3000)
    // Optional: stop any timers or route sync here too
    setRouteStarted(false);
    //socket.emit("route_started", { routeStarted: false, roomId });
  }
}, [outcome, routeStarted]);



  return (
    <>
    {yardLine > 80 && (
      <div
      className="end-zone"
      style={{
        position: 'absolute',
        top: `${offsetFromTop}px`,
        height: `${visibleEndZoneHeight}px`,
        width: '100%',
        backgroundColor: 'gray',
        zIndex: 0,
      }}
      />
    )}
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
