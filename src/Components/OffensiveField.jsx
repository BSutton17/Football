import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import { calculateAllOpenness } from '../Utils/calculator';
import { getRoutePath, getRouteWaypoints } from '../Utils/routeUtils';
import ReceiverRoutes from './Routes/receiverRoutes';
import TightEndRoutes from './Routes/tightEndRoutes';
import RunningBackRoutes from './Routes/runningBackRoutes';
import EndZoneGraphics from './EndZoneGraphics'
import { useOffenseSocketSync } from '../Hooks/useOffenseSocketSync';
import { resetPlayerMovementState } from '../Utils/playerState';
import { logPlaySnapshot } from '../Utils/playDebug';
function OffensiveField({ offsetX, offsetY, socket }) {
  const {
    players,
    setSackTimeRemaining,
    liveCountdown,
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
    routeProgress,
    setRouteProgress,
    setOpeness,
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
    isRunPlay,
    firstDownStartY, 
    setFirstDownStartY,
    activePlayId,
    setActivePlayId,
    thrownBallLine, 
    fieldRef,
    moreRoutes, 
    setMoreRoutes
  } = useAppContext();

  const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();
  const [showThrowAwayButton, setShowThrowAwayButton] = useState(false);
const [throwAwayPosition, setThrowAwayPosition] = useState({ top: 0, left: 0 });
  const hasPlacedStaticOffenseRef = useRef(false);
  const readyToCatchTimeoutsRef = useRef(new Map());
  const firstDownStartYRef = useRef(firstDownStartY);
  const lastHandledOutcomeKeyRef = useRef(null);
  const playResetTimeoutRef = useRef(null);
  const stopRouteTimeoutRef = useRef(null);

  // Constants
  const lineOfScrimmageY = fieldSize.height / 2;
  const oneYardInPixels = fieldSize.height / 40;

  // Utility
  const yardsToPixels = useCallback((yards) => {
    return yards * oneYardInPixels;
  }, [oneYardInPixels]);

const pixelsToYards = useCallback((pixels) => {
  return pixels / oneYardInPixels;
}, [oneYardInPixels]);

useEffect(() => {
  const timeoutMap = readyToCatchTimeoutsRef.current;

  if (routeStarted) {
    players.forEach(player => {
      if (
        player.isOffense &&
        player.moveTarget &&
        !readyToCatchIds.has(player.id) &&
        !timeoutMap.has(player.id)
      ) {
        const delay = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;

        const timeoutId = setTimeout(() => {
          setReadyToCatchIds(prev => {
            const newSet = new Set(prev).add(player.id);
            socket.emit("ready_to_catch", Array.from(newSet));
            return newSet;
          });
          timeoutMap.delete(player.id);
        }, delay);

        timeoutMap.set(player.id, timeoutId);
      }
    });
  } else {
    if (readyToCatchIds.size > 0) {
      setReadyToCatchIds(new Set());
    }

    timeoutMap.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutMap.clear();
  }

  return () => {
    timeoutMap.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutMap.clear();
  };
  }, [players, readyToCatchIds, routeStarted, setReadyToCatchIds, socket]);

    // fix first Down marker on render
  const hasInitializedFirstDown = useRef(false);

  useEffect(() => {
    if (!hasInitializedFirstDown.current && fieldSize.height > 0) {
      setFirstDownStartY(fieldSize.height / 4);
      hasInitializedFirstDown.current = true;
    }
  }, [fieldSize.height, setFirstDownStartY]);

// Create a ref to keep track of the previous outcome value.
// This helps prevent reacting to the same outcome multiple times.
const prevOutcomeRef = useRef(null);
useEffect(() => {
  if (!outcome) {
    prevOutcomeRef.current = null;
    return;
  }

  // If there is a new, non-empty outcome and it is different from the last one...
  if (outcome && outcome !== prevOutcomeRef.current) {
    // Update the ref so we don't re-trigger on this same outcome again
    prevOutcomeRef.current = outcome;

    // Check if the outcome is one that should cause a side switch
    if (["Touchdown!", "Intercepted", "Turnover on Downs", "Safety"].includes(outcome)) {
      
      // Wait 3 seconds before executing the switchSides logic
      setTimeout(() => {
        switchSides(outcome, yardLine, fieldSize.height);
      }, 3000);
    }
  }
}, [fieldSize.height, outcome, switchSides, yardLine]);

  // reset
  const handleOutcomeResult = useCallback((outcomeValue, firstDownStartY) => {
    if (outcomeValue === ""){
      return;
    } 

    const newTotal = currentYards + completedYards;

    let newYardLine = yardLine;
    let newDown = down;
    let newDistance = distance;
    let negativeYards = 0;
    let newFirstDownStartY = firstDownStartY ?? (fieldSize.height / 4); 
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
        negativeYards = Math.floor(Math.random() * (8 - 5)) + 5;
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
        newYardLine = 25;
        setYardLine(newYardLine);
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
    setShowThrowAwayButton(false)
    setRouteStarted(false);

    if(outcome !== "Intercepted") {
      setPlayers(preSnapPlayers); 
    }
    //if (!["Touchdown!", "Intercepted"].includes(outcome)) {
      logPlaySnapshot({
        socket,
        event: 'play_reset',
        payload: {
          playId: activePlayId,
          roomId,
          previousOutcome: outcome,
          completedYards,
          newYardLine,
          newDown,
          newDistance,
          newFirstDownStartY: pixelsToYards(newFirstDownStartY),
        },
      });
      socket.emit("play_reset", {
          newYardLine,
          newDown,
          newDistance,
          newFirstDownStartY: pixelsToYards(newFirstDownStartY),
          roomId
        });
      setActivePlayId(null);
     // }

    // Clear local outcome
    setOutcome("");
  }, [
    completedYards,
    currentYards,
    distance,
    down,
    fieldSize.height,
    outcome,
    preSnapPlayers,
    roomId,
    setDistance,
    setDown,
    setDraggingId,
    setFirstDownStartY,
    setLiveCountdown,
    setOpeness,
    setOutcome,
    setPaused,
    setPlayers,
    setRouteProgress,
    setRouteStarted,
    setSackTimeRemaining,
    setSelectedPlayerId,
    setSelectedZoneId,
    setShowThrowAwayButton,
    setActivePlayId,
    setYardLine,
    socket,
    activePlayId,
    pixelsToYards,
    yardLine,
    yardsToPixels,
  ]);
  
  //Offensive lineman and QB
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fieldSize?.width && fieldSize?.height && !hasPlacedStaticOffenseRef.current) {
        hasPlacedStaticOffenseRef.current = true;
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
  }, [fieldSize?.width, fieldSize?.height, setPlayers]);

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
              p
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
  }, [fieldSize, offsetX, offsetY, routeStarted, setDraggingId, setPlayers, setReadyToCatchIds, setSelectedPlayerId, setSelectedZoneId]);

  // route running
    useEffect(() => {
      let lastEmitTime = 0;
      let animationFrameId = null;

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
                const easedT = getAccelerationEasedProgress(t, p.acceleration, p.speed);

                const newX = p.startPosition.x + (p.moveTarget.x - p.startPosition.x) * easedT;
                const newY = p.startPosition.y + (p.moveTarget.y - p.startPosition.y) * easedT;

                if (t < 1) {
                  anyUpdated = true;
                  movingPlayers.push({
                    id: p.id,
                    position: { x: newX, y: newY },
                    routeProgress: p.waypoints ? (p.currentWaypointIndex + easedT) / p.waypoints.length : 0,
                  });
                  return {
                    ...p,
                    position: { x: newX, y: newY },
                    routeProgress: p.waypoints ? (p.currentWaypointIndex + easedT) / p.waypoints.length : 0,
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

        animationFrameId = requestAnimationFrame(animate);
      }

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }, [roomId, setPlayers, socket]);



  // scales value from 60 --> 99 to 0 --> 99
  function scale(x) {
    return ((x - 60) / 39) * 99;
  }

  function getAccelerationEasedProgress(rawT, acceleration, speed) {
    const clampedT = Math.max(0, Math.min(rawT, 1));
    const accelerationRating = Math.max(40, Math.min(acceleration ?? speed ?? 75, 99));
    const normalized = (accelerationRating - 40) / 59;
    const exponent = 1.22 - (normalized * 0.18);
    return Math.pow(clampedT, exponent);
  }
  

  const offensivePlayers = players.filter(p => p.isOffense);
  const defensivePlayers = players.filter(p => !p.isOffense);
  const qbPlayer = offensivePlayers.find((player) => player.role === 'qb');
  const labelOffsetY = Math.max(8, fieldSize.height * 0.014);
  const labelOffsetX = Math.max(6, fieldSize.width * 0.015);
  const opennessScores = useMemo(() => {
  return calculateAllOpenness(offensivePlayers, defensivePlayers, fieldSize);
}, [defensivePlayers, fieldSize, offensivePlayers]);


const stopAllPlayerMovement = useCallback(() => {

  setPlayers(prev =>
    prev.map((player) => resetPlayerMovementState(player))
  );
}, [setPlayers]);

  const runRouteExists = offensivePlayers.some((p) => p.route === "run");

  useOffenseSocketSync({
    socket,
    fieldRef,
    setPlayers,
    setRouteStarted,
    setOutcome,
    stopAllPlayerMovement,
  });

  //Oline and DLine logic

  useEffect(() => {
    firstDownStartYRef.current = firstDownStartY;
  }, [firstDownStartY]);

  // Keep the ref updated with the latest outcome
  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome, outcomeRef]);

useEffect(() => {
  if (!routeStarted) return;

  const OLineRating = inventory.OLine;
  const DLineRating = inventory.DLine;
  const variability = Math.random() * (500 - 200) + 200;

  const sackTime = (OLineRating * 60) - (DLineRating * 30) + variability;

  setSackTimeRemaining((prev) => {
    const totalTime = prev + sackTime;
    setLiveCountdown(totalTime);
    return totalTime;
  });
}, [inventory.DLine, inventory.OLine, routeStarted, setLiveCountdown, setSackTimeRemaining]);

useEffect(() => {
  if (!routeStarted || outcomeRef.current !== "" || !liveCountdown) return;

  if (sackTimerRef.current) clearTimeout(sackTimerRef.current);

  sackTimerRef.current = setTimeout(() => {
    if (outcomeRef.current === "" && !runRouteExists) {
      setRouteStarted(false);
      socket.emit("route_started", { routeStarted: false, roomId });
      setOutcome("Sacked");
      socket.emit("play_outcome", {
        outcome: "Sacked",
        yardLine,
        roomId
      });
    }
  }, liveCountdown);

  return () => clearTimeout(sackTimerRef.current);
}, [liveCountdown, outcome, outcomeRef, roomId, routeStarted, runRouteExists, sackTimerRef, setOutcome, setRouteStarted, socket, yardLine]);

  useEffect(() => {
    if (!outcome) {
      lastHandledOutcomeKeyRef.current = null;
      if (playResetTimeoutRef.current) {
        clearTimeout(playResetTimeoutRef.current);
        playResetTimeoutRef.current = null;
      }
      if (stopRouteTimeoutRef.current) {
        clearTimeout(stopRouteTimeoutRef.current);
        stopRouteTimeoutRef.current = null;
      }
      return;
    }

    const outcomeKey = `${activePlayId || 'no-play'}:${outcome}`;
    if (lastHandledOutcomeKeyRef.current === outcomeKey) {
      return;
    }
    lastHandledOutcomeKeyRef.current = outcomeKey;

    stopAllPlayerMovement();

    if (stopRouteTimeoutRef.current) clearTimeout(stopRouteTimeoutRef.current);
    stopRouteTimeoutRef.current = setTimeout(() => {
      setRouteStarted(false);
    }, 100);

    if (playResetTimeoutRef.current) clearTimeout(playResetTimeoutRef.current);
    playResetTimeoutRef.current = setTimeout(() => {
      const snapshotFirstDownStartY = firstDownStartYRef.current;
      if (snapshotFirstDownStartY > 0 && isOffense) {
        handleOutcomeResult(outcome, snapshotFirstDownStartY);
      }
    }, 3000);
  }, [activePlayId, handleOutcomeResult, isOffense, outcome, setRouteStarted, stopAllPlayerMovement]);

  useEffect(() => {
  if (!routeStarted || outcomeRef.current !== "" || showThrowAwayButton) return;

  // Show throw away if <= 1 second left
  if (liveCountdown <= 1000 && liveCountdown > 0) {
    const randTop = Math.random() * 80 + 10; 
    const randLeft = Math.random() * 80 + 10;  
    const delay = Math.random() * (500 - 50) + 50;
    setThrowAwayPosition({ top: `${randTop}%`, left: `${randLeft}%` });
    setTimeout(()=>{
      setShowThrowAwayButton(true);
    }, delay)
  } else {
    setShowThrowAwayButton(false);
  }

}, [liveCountdown, outcomeRef, routeStarted, showThrowAwayButton]);

  const handleThrowAway = () => {
  setShowThrowAwayButton(false);
  setOutcome("Thrown Away");
  socket.emit("play_outcome", {
    outcome: "Thrown Away",
    yardLine,
    roomId,
  });
};

  return (
    <>
      <EndZoneGraphics oneYardInPixels={oneYardInPixels} yardLine={yardLine} />

      <div
        className={distance < 20 && yardLine < 90 ? "first-down" : "hide"}
        style={{ top: `${firstDownStartY}px`, position: 'absolute' }}
      ></div>

      <div
        className="line-of-scrimage"
        style={{ top: `${lineOfScrimmageY}px`, position: 'absolute' }}
      ></div>

      <div
        className="half bottom-half"
        onDragOver={(e) => handleDragOver(e)}
        onDrop={(e) => handleDrop(e, fieldSize?.height)}
      >
        {showThrowAwayButton && !isRunPlay && (
        <button
          style={{
            position: 'absolute',
            top: throwAwayPosition.top,
            left: throwAwayPosition.left,
            zIndex: 1000,
            backgroundColor: 'orange',
            color: 'black',
            padding: '10px',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: '2px solid white',
          }}
          onClick={handleThrowAway}
        >
          THROW AWAY!
        </button>
      )}

        {offensivePlayers.map(player => {
          const openness = opennessScores[player.id];
          let color = 'yellow';
          if (openness <= 3) color = 'lime';
          else if (openness >= 8) color = 'red';
          const isSkillPlayer = player.role === "WR" || player.role === "TE" || player.role === "RB";
          const progress = routeProgress[player.id] ?? 0;
          const hasAssignedRoute = Boolean(player.route) && player.route !== 'run';
          const colorThreshold = player.route === 'go' ? 50 : 35;
          const shouldShowOpennessColor =
            isSkillPlayer &&
            routeStarted &&
            hasAssignedRoute &&
            progress >= colorThreshold;

          return (
            <React.Fragment key={player.id}>
              <Player
                id={player.id}
                position={player.position}
                onMouseDown={isOffense ? (e) => handleMouseDown(e, player.id) : null}
                onTouchStart={isOffense ? (e) => handleTouchStart(e, player.id) : null}
                isOffense={true}
                bgColor={shouldShowOpennessColor ? color : 'offense'}
                openess={color}
                routeStarted={routeStarted}
                route={player.route}
                role={player.role}
              />

              {!routeStarted && isOffense && (player.role == "WR" || player.role == "TE" || player.role == "RB") && (
                <div
                  style={{
                    position: 'absolute',
                    left: player.position.x - labelOffsetX,
                    top: player.position.y + labelOffsetY,
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
              )}

              {outcome !== "" && (() => {
                if (!thrownBallLine) return;
                const thrownTargetY =
                  thrownBallLine.targetHalf === 'top'
                    ? thrownBallLine.y - (fieldSize.height / 2)
                    : thrownBallLine.y;
                return (
                  <svg className="thrown-line-svg">
                    <line
                      x1={qbPlayer?.position?.x ?? fieldSize.width / 2}
                      y1={qbPlayer?.position?.y ?? fieldSize.height / 6}
                      x2={thrownBallLine.x}
                      y2={thrownTargetY}
                      stroke="white"
                      strokeWidth="5"
                      strokeDasharray="6, 9"
                    />
                  </svg>
                );
              })()}

              {isOffense && player.route && outcome == "" && !routeStarted && (
                <svg className="route-svg">
                  <defs>
                    {/* Default yellow arrow */}
                    <marker
                      id="arrow-yellow"
                      markerWidth="4"
                      markerHeight="4"
                      refX="2"
                      refY="2"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L4,2 L0,4 Z" fill={
                      runRouteExists
                        ? player.route === "run"
                          ? "red"
                          : "gray"
                        : "yellow"
                    } />
                    </marker>

                    {/* Red arrow for run route */}
                    <marker
                      id="arrow-red"
                      markerWidth="4"
                      markerHeight="4"
                      refX="2"
                      refY="2"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L4,2 L0,4 Z" fill="red" />
                    </marker>
                  </defs>
                  {player.route === "run" ? (
                    <path
                      d={(() => {
                        const length = oneYardInPixels * 4;
                        const angleDeg = player.runAngle ?? 60;
                        const angleRad = angleDeg * (Math.PI / 180);
                        const endX = player.position.x + Math.sin(angleRad) * length;
                        const endY = player.position.y - Math.cos(angleRad) * length;
                        return `M${player.position.x},${player.position.y} L${endX},${endY}`;
                      })()}
                      stroke="red"
                      strokeWidth="5"
                      fill="none"
                      markerEnd="url(#arrow-red)"
                    />
                  ) : (
                  <path
                    d={getRoutePath(
                      fieldSize,
                      player.position.x,
                      player.position.y,
                      player.route,
                      offsetX,
                      offsetY
                    )}
                    stroke={
                      runRouteExists
                        ? player.route === "run"
                          ? "red"
                          : "gray"
                        : "yellow"
                    }
                    strokeWidth="5"
                    fill="none"
                    markerEnd={
                      runRouteExists
                        ? player.route === "run"
                          ? "url(#arrow-red)"
                          : "url(#arrow-yellow)"
                        : "url(#arrow-yellow)"
                    }
                  />
                  )}
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

              {isOffense && selectedPlayerId === player.id && !routeStarted && player.role == "WR" && (
                <>
                <ReceiverRoutes
                  player={player}
                  assignRoute={assignRoute}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  fieldSize={fieldSize}
                  moreRoutes={moreRoutes}
                />
               <button className='more-routes' onClick={() => setMoreRoutes(!moreRoutes)}>More Routes</button>
                </>
                
              )}

              {isOffense && selectedPlayerId === player.id && !routeStarted && player.role == "TE" && (
                <>
                <TightEndRoutes
                  player={player}
                  assignRoute={assignRoute}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  fieldSize={fieldSize}
                  moreRoutes={moreRoutes}
                />
                <button className='more-routes' onClick={() => setMoreRoutes(!moreRoutes)}>More Routes</button>
                </>
              )}

              {isOffense && selectedPlayerId === player.id && !routeStarted && player.role == "RB" && (
                <RunningBackRoutes
                  player={player}
                  assignRoute={assignRoute}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  fieldSize={fieldSize}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );

}

export default OffensiveField;