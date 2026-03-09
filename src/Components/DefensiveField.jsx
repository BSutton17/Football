// DefensiveField.jsx
import React, { useState } from 'react';
import { useEffect, useRef } from 'react';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import DefensiveZone from './Routes/defensizeZones'
import { useDefenseSocketSync } from '../Hooks/useDefenseSocketSync';
function DefensiveField({ offsetX, offsetY, socket}) {
    const {
        players,
        selectedPlayerId,
        setSelectedPlayerId,
        setPreSnapPlayers,
        setPlayers,
        fieldSize,
        setCurrentYards,
        routeStarted,
        outcome,
        setSackTimeRemaining,
        isOffense,
        setOutcome,
        setYardLine,
        setReadyToCatchIds,
        setRouteStarted,
        fieldRef, 
        setFirstDownStartY,
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
        setGameClock,
        setQuarter
    } = useAppContext();

    const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();
    const [defensiveMessage, setDefensiveMessage] = useState("")
    const aspectRatio = fieldSize.width / fieldSize.height;
    const labelOffsetY = Math.max(8, fieldSize.height * 0.014);
    const labelOffsetX = Math.max(6, fieldSize.width * 0.015);
    const blitzArrowYOffset = Math.max(30, fieldSize.height * 0.07);
    

    // 🧠 Persist this across renders
    const cutTrackerRef = useRef(new Map());
    const hasPlacedStaticDefenseRef = useRef(false);
      
  useDefenseSocketSync({
    socket,
    fieldRef,
    outcome,
    defensiveMessage,
    setDefensiveMessage,
    setPlayers,
    setRouteStarted,
    setGameClock,
    gameClockRef,
    gameIntervalRef,
    setQuarter,
    setOutcome,
    setReadyToCatchIds,
    setSackTimeRemaining,
    setCompletedYards,
    setRouteProgress,
    setSelectedPlayerId,
    setSelectedZoneId,
    setDraggingId,
    setOpeness,
    setPaused,
    setLiveCountdown,
    setQbPenalty,
    preSnapRef,
    setCurrentYards,
    setDistance,
    setDown,
    setYardLine,
    setFirstDownStartY,
    setThrownBallLine,
    setPreSnapPlayers,
  });

    //route starts
useEffect(() => {
  if (!routeStarted) return;

  const moveSpeed = 2; // pixels per update (tweak as needed)
  const findClosestOffensivePlayerId = (defenderPosition, roster) => {
    let closestId = null;
    let closestDistance = Infinity;

    roster.forEach((candidate) => {
      if (!candidate.isOffense || candidate.role === 'offensive-lineman' || candidate.role === 'qb') {
        return;
      }

      const dx = candidate.position.x - defenderPosition.x;
      const dy = candidate.position.y - defenderPosition.y;
      const distance = Math.hypot(dx, dy);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = candidate.id;
      }
    });

    return closestId;
  };

  setPlayers(prevPlayers =>
    prevPlayers.map(p => {
      if (p.zone === 'man' && !p.assignedOffensiveId) {
        const nearestTargetId = findClosestOffensivePlayerId(p.position, prevPlayers);
        if (nearestTargetId) {
          return {
            ...p,
            assignedOffensiveId: nearestTargetId,
            hasCut: false,
          };
        }
      }

      if (p.zone === 'man' && p.assignedOffensiveId) {
        const target = prevPlayers.find(op => op.id === p.assignedOffensiveId);
        if (target) {
        const nextWaypoint = target.route?.[target.currentWaypointIndex];
        const waypointX = nextWaypoint ? nextWaypoint.x * fieldSize.width : target.position.x;
        const waypointY = nextWaypoint ? nextWaypoint.y * fieldSize.height : target.position.y;

        const dx = waypointX - p.position.x;
        const dy = waypointY - p.position.y;

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
}, [fieldSize.height, fieldSize.width, routeStarted, setPlayers]);

    useEffect(() => {
      const timer = setTimeout(() => {
        if (fieldSize?.width && fieldSize?.height && !hasPlacedStaticDefenseRef.current) {
          hasPlacedStaticDefenseRef.current = true;
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
    
          setPlayers((prev) => {
            const existingIds = new Set(prev.map((player) => player.id));
            const uniqueStaticPlayers = staticPlayers.filter((player) => !existingIds.has(player.id));
            return [...prev, ...uniqueStaticPlayers];
          });
        }
      }, 10);
    
      return () => clearTimeout(timer);
    }, [fieldSize?.height, fieldSize?.width, setPlayers]);

    // route duration
    useEffect(() => {
    if (!routeStarted) return;

    let animationFrameId;
    let lastEmitTime = 0;

    const getAccelerationRate = (player) => {
      const accelerationRating = Math.max(40, Math.min(player.acceleration ?? player.speed ?? 75, 99));
      return 8 + ((accelerationRating - 40) / 59) * 44;
    };

    const normalizeVector = (vector) => {
      const length = Math.hypot(vector.x, vector.y) || 1;
      return { x: vector.x / length, y: vector.y / length };
    };

    const applyTurnInertia = ({ player, desiredDirection, maxSpeed, deltaTime, paused }) => {
      const accelerationRate = getAccelerationRate(player);
      const previousHeading = player.heading || desiredDirection;
      const prevNorm = normalizeVector(previousHeading);
      const desiredNorm = normalizeVector(desiredDirection);
      const turnDot = (prevNorm.x * desiredNorm.x) + (prevNorm.y * desiredNorm.y);
      const clampedDot = Math.max(-1, Math.min(1, turnDot));
      const turnSharpness = (1 - clampedDot) / 2;
      const hasTrackingHistory = Boolean(player.heading) && Boolean(player.lastUpdateTime);
      const effectiveTurnSharpness = hasTrackingHistory ? turnSharpness : 0;

      const blendedHeading = hasTrackingHistory
        ? normalizeVector({
          x: (prevNorm.x * 0.72) + (desiredNorm.x * 0.28),
          y: (prevNorm.y * 0.72) + (desiredNorm.y * 0.28),
        })
        : desiredNorm;

      const turnSpeedCap = maxSpeed * (1 - (0.07 * effectiveTurnSharpness));
      const effectiveCap = Math.max(maxSpeed * 0.93, turnSpeedCap);
      const launchFloor = (!hasTrackingHistory && player.zone === 'man') ? (maxSpeed * 0.9) : 0;
      const baseSpeed = Math.min(effectiveCap, Math.max(launchFloor, (player.currentSpeed ?? 0) + (accelerationRate * deltaTime)));
      const currentSpeed = paused ? (baseSpeed * 0.88) : baseSpeed;

      return {
        accelerationRate,
        currentSpeed,
        heading: blendedHeading,
      };
    };

    const animate = (time) => {
        setPlayers(prevPlayers => {
        let updated = false;
      const movingPlayers = [];

        const newPlayers = prevPlayers.map((basePlayer) => {
          let player = basePlayer;

          if (player.zone === 'man' && player.assignedOffensiveId) {
            const target = prevPlayers.find((offensivePlayer) => offensivePlayer.id === player.assignedOffensiveId);
            if (!target) return player;

            if (player.pauseUntil && time < player.pauseUntil) {
              return player;
            }

            if (player.pauseUntil && time >= player.pauseUntil) {
              player = { ...player, pauseUntil: null };
            }

            let hasPaused = Boolean(cutTrackerRef.current.get(player.id));
            const currentWaypointIndex = target.currentWaypointIndex ?? 0;
            const lastReactedWaypointIndex = player.lastReactedWaypointIndex ?? -1;

            if (currentWaypointIndex > 0 && currentWaypointIndex !== lastReactedWaypointIndex) {
              const maxDelay = 120;
              const minRating = 60;
              const maxRating = 99;
              const reactionDelay = ((maxRating - player.reactionTime) / (maxRating - minRating)) * maxDelay;
              const routeSpeed = 200 - (((target.routeRunning - 60) / 39) * 99 * 2);
              const cutDelay = currentWaypointIndex >= 2
                ? Math.max(0, (player.reactionTime - routeSpeed) * 0.35)
                : reactionDelay;

              player = {
                ...player,
                hasCut: true,
                lastReactedWaypointIndex: currentWaypointIndex,
              };
              cutTrackerRef.current.set(player.id, true);
              hasPaused = true;
              setTimeout(() => {
                cutTrackerRef.current.set(player.id, false);
              }, cutDelay);
            }

            const dx = target.position.x - player.position.x;
            const dy = target.position.y - player.position.y;
            const distance = Math.hypot(dx, dy);
            const lastTime = player.lastUpdateTime || time;
            const deltaTime = (time - lastTime) / 1000;
            const levelBuffer = Math.max(6, fieldSize.height * 0.008);
            const receiverHasCut = currentWaypointIndex > 0;
            const receiverIsLevelOrPast = target.position.y <= (player.position.y + levelBuffer);
            const shouldPursue = receiverHasCut || receiverIsLevelOrPast;

            if (!shouldPursue) {
              const decelRate = getAccelerationRate(player);
              return {
                ...player,
                currentSpeed: Math.max((player.currentSpeed ?? 0) - (decelRate * deltaTime), 0),
                lastUpdateTime: time,
              };
            }

            if (distance > 0.1) {
              const topSpeed = player.speed * 1.3;
              const desiredDirection = { x: dx / distance, y: dy / distance };
              const { currentSpeed, heading } = applyTurnInertia({
                player,
                desiredDirection,
                maxSpeed: topSpeed,
                deltaTime,
                paused: hasPaused,
              });
              const step = Math.min(currentSpeed * deltaTime, distance);

              updated = true;
              return {
                ...player,
                position: {
                  x: player.position.x + heading.x * step,
                  y: player.position.y + heading.y * step,
                },
                currentSpeed,
                heading,
                lastUpdateTime: time,
              };
            }

            const decelRate = getAccelerationRate(player);
            return {
              ...player,
              currentSpeed: Math.max((player.currentSpeed ?? 0) - (decelRate * deltaTime), 0),
              lastUpdateTime: time,
            };
          }

          if (player.zone !== 'man' && player.zoneCircle) {
            const targetX = player.zoneCircle.x;
            const targetY = player.zoneCircle.y;
            const dx = targetX - player.position.x;
            const dy = targetY - player.position.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 0.5) {
              if (player.lastUpdateTime) {
                updated = true;
                return { ...player, lastUpdateTime: null, position: { x: targetX, y: targetY } };
              }
              return player;
            }

            const lastTime = player.lastUpdateTime || time;
            const deltaTime = (time - lastTime) / 1000;
            const desiredDirection = { x: dx / distance, y: dy / distance };
            const { currentSpeed, heading } = applyTurnInertia({
              player,
              desiredDirection,
              maxSpeed: player.speed,
              deltaTime,
              paused: false,
            });
            const step = Math.min(currentSpeed * deltaTime, distance);

            updated = true;
            return {
              ...player,
              position: {
                x: player.position.x + heading.x * step,
                y: player.position.y + heading.y * step,
              },
              currentSpeed,
              heading,
              lastUpdateTime: time,
            };
          }

          if (player.isBlitzing) {
            const targetX = player.position.x > fieldSize.width / 2 ? fieldSize.width / 1.5 : fieldSize.width / 3.5;
            const targetY = fieldSize.height / 2;
            const dx = targetX - player.position.x;
            const dy = targetY - player.position.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 0.5) {
              if (player.lastUpdateTime) {
                updated = true;
                return { ...player, lastUpdateTime: null, position: { x: targetX, y: targetY } };
              }
              return player;
            }

            const lastTime = player.lastUpdateTime || time;
            const deltaTime = (time - lastTime) / 1000;
            const desiredDirection = { x: dx / distance, y: dy / distance };
            const { currentSpeed, heading } = applyTurnInertia({
              player,
              desiredDirection,
              maxSpeed: player.speed,
              deltaTime,
              paused: false,
            });
            const step = Math.min(currentSpeed * deltaTime, distance);

            updated = true;
            return {
              ...player,
              position: {
                x: player.position.x + heading.x * step,
                y: player.position.y + heading.y * step,
              },
              currentSpeed,
              heading,
              lastUpdateTime: time,
            };
          }

          if (player.lastUpdateTime) {
            updated = true;
            return { ...player, currentSpeed: 0, heading: null, lastUpdateTime: null };
          }

          return player;
        });

      if (updated) {
        newPlayers.forEach((player, index) => {
          const previousPlayer = prevPlayers[index];
          if (
            previousPlayer &&
            (previousPlayer.position.x !== player.position.x ||
              previousPlayer.position.y !== player.position.y)
          ) {
            movingPlayers.push({
              id: player.id,
              position: player.position,
              routeProgress: player.routeProgress,
            });
          }
        });
      }

      if (updated && movingPlayers.length > 0 && time - lastEmitTime > 50) {
        lastEmitTime = time;
        socket.emit('player_positions_update', {
          players: movingPlayers,
          room: roomId,
        });
      }

      return updated ? newPlayers : prevPlayers;
    });

    animationFrameId = requestAnimationFrame(animate);
  };

  animationFrameId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(animationFrameId);
}, [fieldSize.height, fieldSize.width, roomId, routeStarted, setPlayers, socket]);

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
              )
            }

            {/* Draw line to assigned offensive player in man coverage */}
            {!isOffense && player.zone === 'man' &&
            outcome === "" &&
            !routeStarted &&
            player.assignedOffensiveId &&
            (() => {
              const target = players.find(p => p.id === player.assignedOffensiveId);

              if (!target || !target.position || !player.position) return null;

              return (
                <svg className="man-svg">
                  <line
                    x1={player.position.x}
                    y1={player.position.y}
                    x2={target.position.x}
                    y2={target.position.y}
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
                  d={`M ${player.position.x} ${player.position.y} L ${player.position.x > fieldSize.width / 2 ? fieldSize.width / 1.5 : fieldSize.width / 3.5} ${player.position.y + blitzArrowYOffset}`}
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