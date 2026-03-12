import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import { calculateAllOpenness } from '../Utils/calculator';
import { OPENNESS_BUBBLE_RADIUS_BASE } from '../Utils/calculator';
import { canStemRoute, getRoutePath, getRouteWaypoints } from '../Utils/routeUtils';
import ReceiverRoutes from './Routes/receiverRoutes';
import TightEndRoutes from './Routes/tightEndRoutes';
import RunningBackRoutes from './Routes/runningBackRoutes';
import EndZoneGraphics from './EndZoneGraphics'
import { useOffenseSocketSync } from '../Hooks/useOffenseSocketSync';
import { resetPlayerMovementState } from '../Utils/playerState';
import { logPlaySnapshot } from '../Utils/playDebug';
import { getUnifiedAccelerationRate, getUnifiedMaxSpeed } from '../Utils/movementModel';

const LOGICAL_FIELD_WIDTH = 800;
const LOGICAL_FIELD_HEIGHT = 600;
const SKILL_SPEED_SCALE = 0.78;
const LINEMAN_LOG_INTERVALS = [50, 200, 500, 2000];
const LEFT_HASH_X = LOGICAL_FIELD_WIDTH / 3;
const RIGHT_HASH_X = (LOGICAL_FIELD_WIDTH / 3) * 2;

const clampX = (value) => Math.max(0, Math.min(LOGICAL_FIELD_WIDTH, value));
const OFFENSE_LOCAL_MIN_Y = -(LOGICAL_FIELD_HEIGHT / 2);
const OFFENSE_LOCAL_MAX_Y = LOGICAL_FIELD_HEIGHT;
const getTokenRadiusLogical = (fieldSize = { width: 0, height: 0 }) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const tokenDiameterPx = Math.min(
    Math.max(viewportWidth * 0.025, viewportHeight * 0.03),
    viewportHeight * 0.08
  );
  const logicalPerPixelX = fieldSize?.width > 0 ? (LOGICAL_FIELD_WIDTH / fieldSize.width) : 1;
  const logicalPerPixelY = fieldSize?.height > 0 ? (LOGICAL_FIELD_HEIGHT / fieldSize.height) : 1;
  return (tokenDiameterPx / 2) * Math.min(logicalPerPixelX, logicalPerPixelY);
};

const getSpottedBallX = (downedX) => {
  if (typeof downedX !== 'number' || Number.isNaN(downedX)) {
    return LOGICAL_FIELD_WIDTH / 2;
  }
  if (downedX <= LEFT_HASH_X) return LEFT_HASH_X;
  if (downedX >= RIGHT_HASH_X) return RIGHT_HASH_X;
  return clampX(downedX);
};

const realignTrenchToSpot = (playersList, spotX) => {
  if (!Array.isArray(playersList)) return playersList;

  const center = playersList.find((p) => p.id === 'O-L3' && p.position);
  if (!center?.position) return playersList;

  const deltaX = spotX - center.position.x;
  if (Math.abs(deltaX) < 0.001) {
    return playersList;
  }

  const trenchIds = new Set(['QB', 'O-L1', 'O-L2', 'O-L3', 'O-L4', 'O-L5', 'D-L1', 'D-L2', 'D-L3', 'D-L4']);
  const shiftedRoles = new Set(['WR', 'TE', 'RB', 'CB', 'LB', 'S', 'qb', 'offensive-lineman', 'defensive-lineman']);

  return playersList.map((player) => {
    const shouldShift = trenchIds.has(player.id) || shiftedRoles.has(player.role);
    if (!shouldShift || !player.position) return player;

    const shiftedX = clampX(player.position.x + deltaX);
    const shiftedZoneCircle = player.zoneCircle && typeof player.zoneCircle.x === 'number'
      ? { ...player.zoneCircle, x: clampX(player.zoneCircle.x + deltaX) }
      : player.zoneCircle;

    return {
      ...player,
      position: {
        ...player.position,
        x: shiftedX,
      },
      zoneCircle: shiftedZoneCircle,
    };
  });
};

function OffensiveField({ offsetX, offsetY, socket }) {
  const {
    players = [],
    setSackTimeRemaining = () => {},
    liveCountdown,
    outcomeRef,
    setPlayers: setPlayersFromContext,
    selectedPlayerId,
    setSelectedPlayerId = () => {},
    setSelectedZoneId = () => {},
    setDraggingId = () => {},
    fieldSize = { width: 0, height: 0, area: 0 },
    setLiveCountdown = () => {},
    routeStarted,
    setRouteStarted = () => {},
    setPaused = () => {},
    outcome,
    setOutcome = () => {},
    completedYards,
    yardLine,
    routeProgress,
    setRouteProgress = () => {},
    setOpeness = () => {},
    setDown = () => {},
    setDistance = () => {},
    setYardLine = () => {},
    down,
    distance,
    preSnapPlayers,
    isOffense,
    readyToCatchIds,
    setReadyToCatchIds = () => {},
    switchSides,
    roomId,
    currentYards, 
    isRunPlay,
    firstDownStartY, 
    setFirstDownStartY = () => {},
    activePlayId,
    setActivePlayId = () => {},
    thrownBallLine, 
    fieldRef,
    moreRoutes, 
    setMoreRoutes = () => {}
  } = useAppContext();
  const setPlayers = useCallback((nextPlayersOrUpdater) => {
    if (typeof setPlayersFromContext === 'function') {
      setPlayersFromContext(nextPlayersOrUpdater);
    }
  }, [setPlayersFromContext]);

  const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();
  const [showThrowAwayButton, setShowThrowAwayButton] = useState(false);
  const [throwAwayPosition, setThrowAwayPosition] = useState({ top: 0, left: 0 });
  const [throwAwayArmed, setThrowAwayArmed] = useState(false);
  const [phase5EngagementByBlockerId, setPhase5EngagementByBlockerId] = useState({});
  const runLaserOverlayRef = useRef(null);
  const hasPlacedStaticOffenseRef = useRef(false);
  const readyToCatchTimeoutsRef = useRef(new Map());
  const firstDownStartYRef = useRef(firstDownStartY);
  const lastHandledOutcomeKeyRef = useRef(null);
  const playResetTimeoutRef = useRef(null);
  const stopRouteTimeoutRef = useRef(null);
  const throwAwayArmTimeoutRef = useRef(null);
  const throwAwayShowTimeoutRef = useRef(null);
  const localOutcomeRef = useRef("");
  const activeOutcomeRef = outcomeRef ?? localOutcomeRef;
  const playersRef = useRef(players);
  const routeMotionStateRef = useRef(new Map());
  const runVisionStateRef = useRef(new Map());
  const runDebugRef = useRef({
    loggedMilestonesByRunnerId: new Map(),
  });
  const rbPositionLogRef = useRef({
    lastLogByRunnerId: new Map(),
  });
  const opennessScoresRef = useRef({});
  const stemDragStateRef = useRef({
    playerId: null,
    startClientY: 0,
    startScale: 1,
  });

  const STEM_MIN = 0.25;
  const STEM_MAX = 1.5;

  // Constants in logical space
  const lineOfScrimmageY = LOGICAL_FIELD_HEIGHT / 2;
  const oneYardInPixels = LOGICAL_FIELD_HEIGHT / 40;
  const renderOneYardInPixels = (fieldSize?.height || LOGICAL_FIELD_HEIGHT) / 40;
  const logicalFieldSize = useMemo(() => ({
    width: LOGICAL_FIELD_WIDTH,
    height: LOGICAL_FIELD_HEIGHT,
    area: LOGICAL_FIELD_WIDTH * LOGICAL_FIELD_HEIGHT,
  }), []);
  const toScreenX = useCallback((logicalX) => (logicalX / LOGICAL_FIELD_WIDTH) * fieldSize.width, [fieldSize.width]);
  const toScreenY = useCallback((logicalY) => (logicalY / LOGICAL_FIELD_HEIGHT) * fieldSize.height, [fieldSize.height]);

  // Utility
  const yardsToPixels = useCallback((yards) => {
    return yards * oneYardInPixels;
  }, [oneYardInPixels]);

const pixelsToYards = useCallback((pixels) => {
  return pixels / oneYardInPixels;
}, [oneYardInPixels]);

const getEventClientY = (event) => {
  if ('touches' in event && event.touches.length > 0) {
    return event.touches[0].clientY;
  }
  return event.clientY;
};

const normalizeVector = (vector) => {
  const magnitude = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / magnitude, y: vector.y / magnitude };
};

const angleToDirection = (angleDeg) => {
  const angleRad = angleDeg * (Math.PI / 180);
  return normalizeVector({ x: Math.sin(angleRad), y: -Math.cos(angleRad) });
};

const directionToAngle = (direction) => {
  return Math.atan2(direction.x, -direction.y) * (180 / Math.PI);
};

const handleStemDragMove = useCallback((event) => {
  const { playerId, startClientY, startScale } = stemDragStateRef.current;
  if (!playerId) return;

  if ('touches' in event) {
    event.preventDefault();
  }

  const clientY = getEventClientY(event);
  const deltaY = clientY - startClientY;
  const baseDepth = Math.max(fieldSize.height / 4, 1);
  const nextScale = Math.max(STEM_MIN, Math.min(STEM_MAX, startScale - (deltaY / baseDepth)));

  setPlayers((prevPlayers) =>
    prevPlayers.map((player) => {
      if (player.id !== playerId) return player;
      if (!canStemRoute(player.route)) return player;
      return {
        ...player,
        routeStemScale: Number(nextScale.toFixed(3)),
      };
    })
  );
}, [fieldSize.height, setPlayers]);

const stopStemDrag = useCallback(() => {
  stemDragStateRef.current = { playerId: null, startClientY: 0, startScale: 1 };
  window.removeEventListener('mousemove', handleStemDragMove);
  window.removeEventListener('mouseup', stopStemDrag);
  window.removeEventListener('touchmove', handleStemDragMove);
  window.removeEventListener('touchend', stopStemDrag);
}, [handleStemDragMove]);

const startStemDrag = useCallback((event, player) => {
  if (!player?.route || !canStemRoute(player.route) || routeStarted || !isOffense) return;

  const clientY = getEventClientY(event);
  if (typeof clientY !== 'number') return;
  if ('touches' in event) {
    event.preventDefault();
  }

  stemDragStateRef.current = {
    playerId: player.id,
    startClientY: clientY,
    startScale: Math.max(STEM_MIN, Math.min(STEM_MAX, player.routeStemScale ?? 1)),
  };

  window.addEventListener('mousemove', handleStemDragMove);
  window.addEventListener('mouseup', stopStemDrag);
  window.addEventListener('touchmove', handleStemDragMove, { passive: false });
  window.addEventListener('touchend', stopStemDrag);
}, [handleStemDragMove, isOffense, routeStarted, stopStemDrag]);

useEffect(() => () => stopStemDrag(), [stopStemDrag]);

useEffect(() => {
  const timeoutMap = readyToCatchTimeoutsRef.current;
  const safeReadyToCatchIds = readyToCatchIds instanceof Set ? readyToCatchIds : new Set();

  if (routeStarted) {
    players.forEach(player => {
      if (
        player.isOffense &&
        player.moveTarget &&
        !safeReadyToCatchIds.has(player.id) &&
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
    if (safeReadyToCatchIds.size > 0) {
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
      setFirstDownStartY(LOGICAL_FIELD_HEIGHT / 4);
      hasInitializedFirstDown.current = true;
    }
  }, [fieldSize.height, setFirstDownStartY]);

// Create a ref to keep track of the previous outcome value.
// This helps prevent reacting to the same outcome multiple times.
const prevOutcomeRef = useRef(null);
const switchSidesTimeoutRef = useRef(null);
useEffect(() => {
  if (!outcome) {
    prevOutcomeRef.current = null;
    if (switchSidesTimeoutRef.current) {
      clearTimeout(switchSidesTimeoutRef.current);
      switchSidesTimeoutRef.current = null;
    }
    return;
  }

  // If there is a new, non-empty outcome and it is different from the last one...
  if (outcome && outcome !== prevOutcomeRef.current) {
    // Update the ref so we don't re-trigger on this same outcome again
    prevOutcomeRef.current = outcome;

    // Check if the outcome is one that should cause a side switch
    if (["Touchdown!", "Intercepted", "Turnover on Downs", "Safety"].includes(outcome)) {
      if (switchSidesTimeoutRef.current) {
        clearTimeout(switchSidesTimeoutRef.current);
      }
      switchSidesTimeoutRef.current = setTimeout(() => {
        switchSides(outcome, yardLine, LOGICAL_FIELD_HEIGHT);
        switchSidesTimeoutRef.current = null;
      }, 3000);
    }
  }
}, [outcome, switchSides, yardLine]);

useEffect(() => () => {
  if (switchSidesTimeoutRef.current) {
    clearTimeout(switchSidesTimeoutRef.current);
    switchSidesTimeoutRef.current = null;
  }
}, []);

  // reset
  const handleOutcomeResult = useCallback((outcomeValue, firstDownStartY) => {
    if (outcomeValue === ""){
      return;
    } 

    const newTotal = currentYards + completedYards;
    const isYardageOutcome = outcomeValue.includes('yard') || outcomeValue === 'Sacked';
    const convertedOnPlay = outcomeValue.includes('yard') && newTotal >= distance;
    const isImmediatePossessionSwitch = ["Touchdown!", "Intercepted", "Turnover on Downs", "Safety"].includes(outcomeValue);
    const failedFourthDown = down >= 4 && !convertedOnPlay && !isImmediatePossessionSwitch;

    if (failedFourthDown) {
      setOutcome("Turnover on Downs");
      return;
    }

    let newYardLine = yardLine;
    let newDown = down;
    let newDistance = distance;
    let negativeYards = 0;
    let newFirstDownStartY = firstDownStartY ?? (LOGICAL_FIELD_HEIGHT / 4);
      if (outcomeValue.includes("yard") && newTotal >= distance) {
        newYardLine = yardLine + completedYards;
        setYardLine(newYardLine);
        newFirstDownStartY = LOGICAL_FIELD_HEIGHT / 4;
        setFirstDownStartY(newFirstDownStartY);
        newDistance = 10;
        setDistance(newDistance);
        newDown = 1
        setDown(newDown);
      } else if (outcomeValue.includes("yard")) {
        newYardLine = yardLine + completedYards;
        setYardLine(newYardLine);
        newFirstDownStartY = firstDownStartY + yardsToPixels(completedYards)
        setFirstDownStartY(newFirstDownStartY);
        newDistance = distance - completedYards
        setDistance(newDistance);
        newDown = down + 1
        setDown(newDown);
      }
      else if (outcomeValue === "Sacked") {
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
      else if(outcomeValue === "Intercepted" || outcomeValue == "Turnover on Downs") {
        newYardLine = 100 - yardLine;
        setYardLine(newYardLine);
        newFirstDownStartY = LOGICAL_FIELD_HEIGHT / 4;
        setFirstDownStartY(newFirstDownStartY);
        newDistance = 10
        setDistance(newDistance);
        newDown = 1
        setDown(newDown);
      }
      else if(outcomeValue === "Touchdown!") {
        newYardLine = 25;
        setYardLine(newYardLine);
        newFirstDownStartY = LOGICAL_FIELD_HEIGHT / 4;
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

    
    const activeRunCarrier = players.find(
      (p) => p.isOffense && p.route === 'run' && p.role !== 'qb' && p.role !== 'offensive-lineman' && p.position
    );
    const qb = players.find((p) => p.role === 'qb' && p.position);
    let downedBallX = null;

    if (isYardageOutcome) {
      if (outcomeValue === 'Sacked') {
        downedBallX = qb?.position?.x ?? null;
      } else if (outcomeValue.includes('run')) {
        downedBallX = activeRunCarrier?.position?.x ?? null;
      } else {
        downedBallX = thrownBallLine?.x ?? null;
      }
    }

    const currentCenterX = preSnapPlayers.find((p) => p.id === 'O-L3')?.position?.x ?? (LOGICAL_FIELD_WIDTH / 2);
    const spottedBallX = isYardageOutcome
      ? getSpottedBallX(typeof downedBallX === 'number' ? downedBallX : currentCenterX)
      : currentCenterX;
    const alignedPreSnapPlayers = realignTrenchToSpot(preSnapPlayers, spottedBallX);

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

    if (!isImmediatePossessionSwitch) {
      setPlayers(alignedPreSnapPlayers);
    }
    //if (!["Touchdown!", "Intercepted"].includes(outcome)) {
      logPlaySnapshot({
        socket,
        event: 'play_reset',
        payload: {
          playId: activePlayId,
          roomId,
          previousOutcome: outcomeValue,
          completedYards,
          newYardLine,
          newDown,
          newDistance,
          newFirstDownStartY: pixelsToYards(newFirstDownStartY),
        },
      });
      socket.emit("play_reset", {
          outcome: outcomeValue,
          newYardLine,
          newDown,
          newDistance,
          newFirstDownStartY: pixelsToYards(newFirstDownStartY),
          ballSpotX: spottedBallX,
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
    preSnapPlayers,
    players,
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
    thrownBallLine,
    yardLine,
    yardsToPixels,
  ]);
  
  //Offensive lineman and QB
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasPlacedStaticOffenseRef.current) {
        hasPlacedStaticOffenseRef.current = true;
        let width = LOGICAL_FIELD_WIDTH;
        let height = LOGICAL_FIELD_HEIGHT;
        const staticPlayers = [
        {
          id: 'QB',
          position: { x: width / 2, y: height / 6 },
          isOffense: true,
          role: 'qb',
        },
        {
          id: 'O-L1',
          position: { x: width / 2 - (width / 7), y: height * 0.0417 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L2',
          position: { x: width / 2 - (width / 14), y: height * 0.0333 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L3',
          position: { x: width / 2, y: height * 0.025 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L4',
          position: { x: width / 2 + (width / 14), y: height * 0.0333 },
          isOffense: true,
          role: 'offensive-lineman',
        },
        {
          id: 'O-L5',
          position: { x: width / 2 + (width / 7), y: height * 0.0417 },
          isOffense: true,
          role: 'offensive-lineman',
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
  }, [setPlayers]);

  // Assign route to player
  const assignRoute = (id, routeName) => {
    setPlayers(prev =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          route: routeName,
          routeStemScale: routeName && canStemRoute(routeName) ? (p.routeStemScale ?? 1) : 1,
        };
      })
    );
    setSelectedPlayerId(null);
    socket.emit("assign_route", { playerId: id, routeName, room: roomId });
  };

  // When route starts, set move targets and movement info for players with routes
  useEffect(() => {
    if (!isOffense) {
      return;
    }

    if (routeStarted) {
      routeMotionStateRef.current = new Map();
      runVisionStateRef.current = new Map();
      runLaserOverlayRef.current = null;
      runDebugRef.current = {
        loggedMilestonesByRunnerId: new Map(),
      };
      rbPositionLogRef.current = {
        lastLogByRunnerId: new Map(),
      };
      setSelectedPlayerId(null);
      setSelectedZoneId(null);
      setDraggingId(null);
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) => {
          if (p.isOffense && p.route) {
            if (p.isOffense && p.route === 'run' && p.role !== 'qb' && p.role !== 'offensive-lineman') {
              return {
                ...p,
                waypoints: null,
                currentWaypointIndex: null,
                moveTarget: null,
                moveDuration: null,
                moveStartTime: null,
                startPosition: { ...p.position },
                currentSpeed: 0,
                lastUpdateTime: null,
                routeProgress: 0,
              };
            }

            const waypoints = getRouteWaypoints(
              logicalFieldSize,
              p.position,
              p.route,
              p
            )

            return {
            ...p,
            waypoints,
            currentWaypointIndex: 0,
            moveTarget: waypoints[0],
            moveDuration: null,
            moveStartTime: null,
            startPosition: { ...p.position },
            currentSpeed: 0,
            lastUpdateTime: null,
            routeProgress: 0,
          };

          }
          return p;
        })
      );
    } else {
      // Reset readyToCatchIds when route is not started
      routeMotionStateRef.current = new Map();
      runVisionStateRef.current = new Map();
      runLaserOverlayRef.current = null;
      runDebugRef.current = {
        loggedMilestonesByRunnerId: new Map(),
      };
      rbPositionLogRef.current = {
        lastLogByRunnerId: new Map(),
      };
      setReadyToCatchIds(new Set());
    }
  }, [isOffense, logicalFieldSize, routeStarted, setDraggingId, setPlayers, setReadyToCatchIds, setSelectedPlayerId, setSelectedZoneId]);

  // route running
    useEffect(() => {
      if (!isOffense) {
        return;
      }

      let lastEmitTime = 0;
      let animationFrameId = null;

      function animate(time) {
        const racActivatedRunnerIds = [];
        setPlayers(prevPlayers => {
          let anyUpdated = false;
          const movingPlayers = [];
          const tokenRadius = getTokenRadiusLogical(fieldSize);

          const chooseRunHeading = (runner, currentHeading, visionState, timeNow) => {
            const headingAngle = directionToAngle(currentHeading);
            const candidateOffsets = [0, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25, 30, -30, 35, -35, 40, -40];
            const oneYardInLogicalUnits = LOGICAL_FIELD_HEIGHT / 40;
            const yardsPastLineOfScrimmage = Math.max(0, (-runner.position.y) / oneYardInLogicalUnits);
            const enableEndzonePriority = yardsPastLineOfScrimmage >= 7;
            const blockersAndDefenders = prevPlayers
              .filter((candidate) => candidate.id !== runner.id && candidate.position)
              .map((candidate) => ({
                ...candidate,
                collisionPosition: {
                  x: candidate.position.x,
                  y: candidate.isOffense
                    ? candidate.position.y
                    : (candidate.position.y - (LOGICAL_FIELD_HEIGHT / 2)),
                },
              }));
            const playerRadius = tokenRadius;
            const rayStep = 4;
            const maxRayDistance = Math.max(LOGICAL_FIELD_WIDTH, LOGICAL_FIELD_HEIGHT);
            const candidateReadings = [];
            const fallbackForwardHeading = normalizeVector({
              x: currentHeading.x,
              y: -Math.max(Math.abs(currentHeading.y), 0.25),
            });
            const previousOffset = visionState?.lastDecision?.bestOffset ?? 0;
            const committedOffset = visionState?.committedOffset;
            const commitmentActive = typeof visionState?.commitUntil === 'number' && timeNow < visionState.commitUntil;

            let bestDistance = -1;
            let bestScore = -Infinity;
            let bestDirection = fallbackForwardHeading;
            let bestOffset = 0;
            let bestIndex = -1;

            candidateOffsets.forEach((offset, index) => {
              const direction = angleToDirection(headingAngle + offset);
              const rayName = `ray_${offset >= 0 ? `p${offset}` : `m${Math.abs(offset)}`}`;
              if (direction.y > -0.02) {
                candidateReadings.push({
                  name: rayName,
                  offset,
                  distance: 0,
                  weightedDistance: 0,
                  blockedBy: 'backward',
                  stopReason: 'backward-filter',
                  direction,
                  endPoint: { x: runner.position.x, y: runner.position.y },
                });
                return;
              }
              let distanceTravelled = 0;
              let lastClearDistance = 0;
              let stopReason = 'max-distance';
              let stopPlayerId = null;
              let boundaryTag = null;

              while (distanceTravelled <= maxRayDistance) {
                const probeX = runner.position.x + direction.x * distanceTravelled;
                const probeY = runner.position.y + direction.y * distanceTravelled;

                const outLeft = probeX <= 0;
                const outRight = probeX >= LOGICAL_FIELD_WIDTH;
                const outTop = probeY <= OFFENSE_LOCAL_MIN_Y;
                const outBottom = probeY >= OFFENSE_LOCAL_MAX_Y;

                if (outLeft || outRight || outTop || outBottom) {
                  stopReason = 'sideline';
                  if (outTop && (outLeft || outRight)) {
                    boundaryTag = 'top-corner';
                  } else if (outTop) {
                    boundaryTag = 'top-edge';
                  } else if (outLeft || outRight) {
                    boundaryTag = 'sideline-edge';
                  } else {
                    boundaryTag = 'bottom-edge';
                  }
                  distanceTravelled = lastClearDistance;
                  break;
                }

                const collidedPlayer = blockersAndDefenders.find((candidate) => {
                  const dx = candidate.collisionPosition.x - probeX;
                  const dy = candidate.collisionPosition.y - probeY;
                  return Math.hypot(dx, dy) <= playerRadius;
                });

                if (collidedPlayer) {
                  stopReason = collidedPlayer.isOffense ? 'offense-player' : 'defense-player';
                  stopPlayerId = collidedPlayer.id;
                  distanceTravelled = lastClearDistance;
                  break;
                }

                lastClearDistance = distanceTravelled;
                distanceTravelled += rayStep;
              }

              if (stopReason === 'max-distance') {
                distanceTravelled = lastClearDistance;
              }

              const sidelineDistance = (() => {
                if (Math.abs(direction.x) < 1e-6) {
                  return Infinity;
                }
                if (direction.x > 0) {
                  return (LOGICAL_FIELD_WIDTH - runner.position.x) / direction.x;
                }
                return (0 - runner.position.x) / direction.x;
              })();

              const weightedDistance = (enableEndzonePriority && boundaryTag === 'top-edge')
                ? Math.min(distanceTravelled * 2, sidelineDistance)
                : distanceTravelled;
              const upfieldProgress = Math.max(0, -direction.y * distanceTravelled);
              const continuityBonus = Math.max(0, 44 - (Math.abs(offset - previousOffset) * 2.4));
              const turnPenalty = Math.abs(offset) * 1.5;
              const stopPenalty = boundaryTag === 'top-corner'
                ? 160
                : boundaryTag === 'sideline-edge'
                  ? 120
                  : boundaryTag === 'bottom-edge'
                    ? 220
                    : stopReason === 'offense-player'
                      ? 70
                      : stopReason === 'defense-player'
                        ? 45
                        : 0;
              const topEdgeBonus = (enableEndzonePriority && boundaryTag === 'top-edge') ? 220 : 0;
              const selectionScore = (upfieldProgress * 1.35) + (weightedDistance * 0.45) + continuityBonus + topEdgeBonus - turnPenalty - stopPenalty;

              candidateReadings.push({
                name: rayName,
                offset,
                distance: distanceTravelled,
                weightedDistance,
                selectionScore,
                direction,
                stopReason,
                boundaryTag,
                stopPlayerId,
                endPoint: {
                  x: runner.position.x + (direction.x * distanceTravelled),
                  y: runner.position.y + (direction.y * distanceTravelled),
                },
              });

              if (selectionScore > bestScore) {
                bestDistance = weightedDistance;
                bestScore = selectionScore;
                bestDirection = direction;
                bestOffset = offset;
                bestIndex = index;
              }
            });

            if (commitmentActive && typeof committedOffset === 'number') {
              const committedReading = candidateReadings.find((reading) => (
                reading.offset === committedOffset
                && reading.stopReason !== 'backward-filter'
                && reading.distance > (tokenRadius * 1.1)
              ));
              if (committedReading) {
                bestDistance = committedReading.weightedDistance ?? committedReading.distance;
                bestScore = committedReading.selectionScore ?? bestScore;
                bestDirection = committedReading.direction;
                bestOffset = committedReading.offset;
                bestIndex = candidateReadings.findIndex((reading) => reading.offset === committedOffset);
              }
            }

            if (bestDistance < 0) {
              bestDistance = 0;
              bestOffset = 0;
            }

            return {
              direction: bestDirection,
              bestDistance,
              bestOffset,
              bestIndex,
              candidateReadings,
            };
          };

          const newPlayers = prevPlayers.map(p => {
            if (
              routeStarted
              && p.isOffense
              && p.hasCaughtBall
              && typeof p.racTransitionEndsAt === 'number'
              && p.position
            ) {
              const transitionDirection = (() => {
                const raw = p.racDirection;
                if (!raw || typeof raw.x !== 'number' || typeof raw.y !== 'number') {
                  return { x: 0, y: -1 };
                }
                const length = Math.hypot(raw.x, raw.y) || 1;
                return { x: raw.x / length, y: raw.y / length };
              })();

              if (time >= p.racTransitionEndsAt) {
                if (p.route !== 'run') {
                  racActivatedRunnerIds.push(p.id);
                }
                const carrySpeed = Math.max(
                  0,
                  p.catchCarrySpeed ?? p.currentSpeed ?? 0
                );
                anyUpdated = true;
                return {
                  ...p,
                  route: 'run',
                  runAngle: directionToAngle(transitionDirection),
                  waypoints: null,
                  currentWaypointIndex: null,
                  moveTarget: null,
                  moveDuration: null,
                  moveStartTime: null,
                  startPosition: { ...p.position },
                  routeProgress: 0,
                  currentSpeed: carrySpeed,
                  lastUpdateTime: null,
                  racTransitionEndsAt: null,
                  racTransitionStartedAt: null,
                  catchCarrySpeed: null,
                };
              }

              const maxSpeed = getUnifiedMaxSpeed(p) * SKILL_SPEED_SCALE;
              const carrySpeed = Math.max(
                0,
                p.catchCarrySpeed ?? p.currentSpeed ?? 0
              );
              const lastTime = p.lastUpdateTime || time;
              const deltaTime = Math.max((time - lastTime) / 1000, 0.016);
              const launchFloor = p.lastUpdateTime ? 0 : Math.max(maxSpeed * 0.55, carrySpeed);
              const currentSpeed = Math.min(maxSpeed, Math.max(launchFloor, carrySpeed));
              const step = currentSpeed * deltaTime;

              const nextX = clampX(p.position.x + (transitionDirection.x * step));
              const nextY = Math.max(
                OFFENSE_LOCAL_MIN_Y,
                Math.min(OFFENSE_LOCAL_MAX_Y, p.position.y + (transitionDirection.y * step))
              );

              anyUpdated = true;
              movingPlayers.push({
                id: p.id,
                position: { x: nextX, y: nextY },
                routeProgress: p.routeProgress ?? 0,
              });

              return {
                ...p,
                position: { x: nextX, y: nextY },
                currentSpeed,
                lastUpdateTime: time,
              };
            }

            if (routeStarted && p.isOffense && p.route === 'run' && p.role !== 'qb' && p.role !== 'offensive-lineman' && p.position) {
              const maxSpeed = getUnifiedMaxSpeed(p) * SKILL_SPEED_SCALE;
              const startingRunSpeed = Math.max(maxSpeed * 0.5, p.currentSpeed ?? 0);
              const visionState = runVisionStateRef.current.get(p.id) || {
                heading: angleToDirection(p.runAngle ?? 0),
                nextProbeAt: time + 600,
                nextLogAt: time,
                currentSpeed: startingRunSpeed,
                lastUpdateTime: null,
                startedAt: time,
                lastDecision: {
                  bestOffset: 0,
                  bestDistance: 0,
                },
              };

              const lastTime = visionState.lastUpdateTime || time;
              const deltaTime = Math.max((time - lastTime) / 1000, 0.016);
              let heading = visionState.heading;

              if (time >= visionState.nextProbeAt) {
                const headingDecision = chooseRunHeading(p, heading, visionState, time);
                heading = headingDecision.direction;
                visionState.lastDecision = {
                  bestOffset: headingDecision.bestOffset,
                  bestDistance: headingDecision.bestDistance,
                };
                visionState.committedOffset = headingDecision.bestOffset;
                if (!(typeof visionState.commitUntil === 'number' && time < visionState.commitUntil)) {
                  visionState.commitUntil = time + 400;
                }
                if (time >= (visionState.nextLogAt ?? time)) {
                  visionState.nextLogAt = time + 500;
                }
                runLaserOverlayRef.current = {
                  runnerId: p.id,
                  origin: { x: p.position.x, y: p.position.y },
                  rays: headingDecision.candidateReadings,
                  bestIndex: headingDecision.bestIndex,
                };
                visionState.nextProbeAt = time + 250;
              }

              const accelerationRate = getUnifiedAccelerationRate(p) * 1.5;
              const hasTrackingHistory = Boolean(visionState.lastUpdateTime);
              const launchFloor = hasTrackingHistory ? 0 : startingRunSpeed;
              const acceleratedSpeed = (visionState.currentSpeed ?? 0) + (accelerationRate * deltaTime);
              const currentSpeed = Math.min(maxSpeed, Math.max(launchFloor, acceleratedSpeed));
              const step = currentSpeed * deltaTime;

              const nextX = clampX(p.position.x + heading.x * step);
              const nextY = Math.max(OFFENSE_LOCAL_MIN_Y, Math.min(OFFENSE_LOCAL_MAX_Y, p.position.y + heading.y * step));

              runVisionStateRef.current.set(p.id, {
                heading,
                nextProbeAt: visionState.nextProbeAt,
                nextLogAt: visionState.nextLogAt,
                currentSpeed,
                lastUpdateTime: time,
                startedAt: visionState.startedAt,
                lastDecision: visionState.lastDecision,
                committedOffset: visionState.committedOffset,
                commitUntil: visionState.commitUntil,
              });

              if (p.role === 'RB') {
                const lastRbLogAt = rbPositionLogRef.current.lastLogByRunnerId.get(p.id) ?? -Infinity;
                if ((time - lastRbLogAt) >= 500) {
                  console.log(
                    `[RB RUN][500MS] t=${Math.max(0, Math.round(time - visionState.startedAt))}ms id=${p.id} x=${p.position.x.toFixed(1)} y=${p.position.y.toFixed(1)} angle=${directionToAngle(heading).toFixed(1)}`
                  );
                  rbPositionLogRef.current.lastLogByRunnerId.set(p.id, time);
                }
              }

              anyUpdated = true;
              movingPlayers.push({
                id: p.id,
                position: { x: nextX, y: nextY },
                routeProgress: p.routeProgress ?? 0,
              });

              return {
                ...p,
                position: { x: nextX, y: nextY },
                currentSpeed,
                lastUpdateTime: time,
              };
            }

            if (p.waypoints && typeof p.currentWaypointIndex === 'number' && p.currentWaypointIndex < p.waypoints.length) {
              const target = p.waypoints[p.currentWaypointIndex];
              if (!target || !p.position) {
                return p;
              }

              const motionState = routeMotionStateRef.current.get(p.id) || { currentSpeed: 0, lastUpdateTime: null };
              const lastTime = motionState.lastUpdateTime || time;
              const deltaTime = Math.max((time - lastTime) / 1000, 0.016);
              const dx = target.x - p.position.x;
              const dy = target.y - p.position.y;
              const distance = Math.hypot(dx, dy);

              if (distance <= 0.2) {
                const nextIndex = p.currentWaypointIndex + 1;
                const reachedPosition = { x: target.x, y: target.y };
                if (nextIndex >= p.waypoints.length) {
                  routeMotionStateRef.current.delete(p.id);
                  anyUpdated = true;
                  movingPlayers.push({
                    id: p.id,
                    position: reachedPosition,
                    routeProgress: 1,
                  });
                  return {
                    ...p,
                    position: reachedPosition,
                    moveTarget: null,
                    moveDuration: null,
                    moveStartTime: null,
                    startPosition: null,
                    currentWaypointIndex: null,
                    waypoints: null,
                    routeProgress: 1,
                    currentSpeed: 0,
                    lastUpdateTime: time,
                  };
                }

                anyUpdated = true;
                routeMotionStateRef.current.set(p.id, {
                  currentSpeed: motionState.currentSpeed ?? 0,
                  lastUpdateTime: time,
                });
                movingPlayers.push({
                  id: p.id,
                  position: reachedPosition,
                  routeProgress: nextIndex / p.waypoints.length,
                });
                return {
                  ...p,
                  position: reachedPosition,
                  currentWaypointIndex: nextIndex,
                  moveTarget: p.waypoints[nextIndex],
                  routeProgress: nextIndex / p.waypoints.length,
                  lastUpdateTime: time,
                };
              }

              const maxSpeed = getUnifiedMaxSpeed(p) * SKILL_SPEED_SCALE;
              const accelerationRate = getUnifiedAccelerationRate(p);
              const hasTrackingHistory = Boolean(motionState.lastUpdateTime);
              const launchFloor = hasTrackingHistory ? 0 : (maxSpeed * 0.55);
              const acceleratedSpeed = (motionState.currentSpeed ?? 0) + (accelerationRate * deltaTime);
              const currentSpeed = Math.min(maxSpeed, Math.max(launchFloor, acceleratedSpeed));
              const step = Math.min(currentSpeed * deltaTime, distance);
              const nx = p.position.x + ((dx / distance) * step);
              const ny = p.position.y + ((dy / distance) * step);

              routeMotionStateRef.current.set(p.id, {
                currentSpeed,
                lastUpdateTime: time,
              });

              const segmentProgress = distance > 0 ? Math.min(step / distance, 1) : 0;
              const progress = p.waypoints.length > 0
                ? (p.currentWaypointIndex + segmentProgress) / p.waypoints.length
                : 0;

              anyUpdated = true;
              movingPlayers.push({
                id: p.id,
                position: { x: nx, y: ny },
                routeProgress: progress,
              });
              return {
                ...p,
                position: { x: nx, y: ny },
                routeProgress: progress,
                currentSpeed,
                lastUpdateTime: time,
              };
            }
            return p;
          });

          const adjustedPlayers = [...newPlayers];
          if (routeStarted) {
            const allPlayerIndexes = adjustedPlayers
              .map((candidate, index) => ({ candidate, index }))
              .filter(({ candidate }) => candidate?.position)
              .map(({ index }) => index);
            const minSeparation = tokenRadius * 2;

            for (let pass = 0; pass < 2; pass += 1) {
              for (let i = 0; i < allPlayerIndexes.length; i += 1) {
                for (let j = i + 1; j < allPlayerIndexes.length; j += 1) {
                  const indexA = allPlayerIndexes[i];
                  const indexB = allPlayerIndexes[j];
                  const playerA = adjustedPlayers[indexA];
                  const playerB = adjustedPlayers[indexB];
                  if (!playerA?.position || !playerB?.position) continue;

                  const playerAIsQb = playerA.role === 'qb';
                  const playerBIsQb = playerB.role === 'qb';
                  if (playerAIsQb || playerBIsQb) {
                    const otherPlayer = playerAIsQb ? playerB : playerA;
                    if (otherPlayer?.isOffense) {
                      continue;
                    }
                  }

                  const dx = playerA.position.x - playerB.position.x;
                  const dy = playerA.position.y - playerB.position.y;
                  const distance = Math.hypot(dx, dy);
                  if (distance >= minSeparation) continue;

                  const safeDistance = distance > 0.0001 ? distance : 0.0001;
                  const overlap = (minSeparation - safeDistance) / 2;
                  const unitX = dx / safeDistance;
                  const unitY = dy / safeDistance;

                  const nextAX = clampX(playerA.position.x + (unitX * overlap));
                  const nextAY = Math.max(OFFENSE_LOCAL_MIN_Y, Math.min(OFFENSE_LOCAL_MAX_Y, playerA.position.y + (unitY * overlap)));
                  const nextBX = clampX(playerB.position.x - (unitX * overlap));
                  const nextBY = Math.max(OFFENSE_LOCAL_MIN_Y, Math.min(OFFENSE_LOCAL_MAX_Y, playerB.position.y - (unitY * overlap)));

                  if (!playerAIsQb && !playerBIsQb) {
                    adjustedPlayers[indexA] = { ...playerA, position: { x: nextAX, y: nextAY } };
                    adjustedPlayers[indexB] = { ...playerB, position: { x: nextBX, y: nextBY } };
                  } else if (playerAIsQb && !playerBIsQb) {
                    adjustedPlayers[indexB] = { ...playerB, position: { x: nextBX, y: nextBY } };
                  } else if (playerBIsQb && !playerAIsQb) {
                    adjustedPlayers[indexA] = { ...playerA, position: { x: nextAX, y: nextAY } };
                  }
                  anyUpdated = true;
                }
              }
            }
          }

          const emitPlayers = [];
          if (anyUpdated) {
            adjustedPlayers.forEach((player, index) => {
              const previous = prevPlayers[index];
              if (!previous?.position || !player?.position) return;
              if (previous.position.x !== player.position.x || previous.position.y !== player.position.y) {
                emitPlayers.push({
                  id: player.id,
                  position: player.position,
                  routeProgress: player.routeProgress,
                });
              }
            });
          }

          if (anyUpdated && emitPlayers.length > 0 && time - lastEmitTime > 50) {
            lastEmitTime = time;
            socket.emit("player_positions_update", {
              players: emitPlayers,
              room: roomId,
            });
          }

          if (racActivatedRunnerIds.length > 0) {
            racActivatedRunnerIds.forEach((runnerId) => {
              socket.emit("assign_route", { playerId: runnerId, routeName: 'run', room: roomId });
            });
          }

          return anyUpdated ? adjustedPlayers : prevPlayers;
        });

        animationFrameId = requestAnimationFrame(animate);
      }

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }, [fieldSize.height, fieldSize.width, isOffense, roomId, routeStarted, setPlayers, socket]);



  const offensivePlayers = players.filter(p => p.isOffense);
  const defensivePlayers = players.filter(p => !p.isOffense);
  const qbPlayer = offensivePlayers.find((player) => player.role === 'qb');
  const labelOffsetY = Math.max(8, fieldSize.height * 0.014);
  const labelOffsetX = Math.max(6, fieldSize.width * 0.015);
  const opennessScores = useMemo(() => {
  return calculateAllOpenness(offensivePlayers, defensivePlayers, logicalFieldSize);
}, [defensivePlayers, logicalFieldSize, offensivePlayers]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    opennessScoresRef.current = opennessScores;
  }, [opennessScores]);


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

  // OL/DL movement is handled by DefensiveField trench simulation.

  useEffect(() => {
    firstDownStartYRef.current = firstDownStartY;
  }, [firstDownStartY]);

  // Keep the ref updated with the latest outcome
  useEffect(() => {
    activeOutcomeRef.current = outcome;
  }, [activeOutcomeRef, outcome]);

useEffect(() => {
  // Sack timer removed: sacks are now overlap-only from DefensiveField hitbox checks.
  setLiveCountdown(null);
  setSackTimeRemaining(0);
  setPhase5EngagementByBlockerId({});
}, [routeStarted, outcome, setLiveCountdown, setSackTimeRemaining]);

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

    if (!activePlayId) {
      return;
    }

    const outcomeKey = outcome;
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
    if (throwAwayArmTimeoutRef.current) {
      clearTimeout(throwAwayArmTimeoutRef.current);
      throwAwayArmTimeoutRef.current = null;
    }

    if (!routeStarted || activeOutcomeRef.current !== "") {
      setThrowAwayArmed(false);
      return;
    }

    setThrowAwayArmed(false);
    throwAwayArmTimeoutRef.current = setTimeout(() => {
      if (activeOutcomeRef.current === "") {
        setThrowAwayArmed(true);
      }
    }, 2500);

    return () => {
      if (throwAwayArmTimeoutRef.current) {
        clearTimeout(throwAwayArmTimeoutRef.current);
        throwAwayArmTimeoutRef.current = null;
      }
    };
  }, [activeOutcomeRef, routeStarted]);

  useEffect(() => {
    if (throwAwayShowTimeoutRef.current) {
      clearTimeout(throwAwayShowTimeoutRef.current);
      throwAwayShowTimeoutRef.current = null;
    }

    if (!routeStarted || !throwAwayArmed || activeOutcomeRef.current !== "" || isRunPlay) {
      setShowThrowAwayButton(false);
      return;
    }

    if (showThrowAwayButton) {
      return;
    }

    const randTop = Math.random() * 80 + 10;
    const randLeft = Math.random() * 80 + 10;
    const delay = Math.random() * (500 - 50) + 50;
    setThrowAwayPosition({ top: `${randTop}%`, left: `${randLeft}%` });

    throwAwayShowTimeoutRef.current = setTimeout(() => {
      if (activeOutcomeRef.current === "" && routeStarted) {
        setShowThrowAwayButton(true);
      }
    }, delay);

    return () => {
      if (throwAwayShowTimeoutRef.current) {
        clearTimeout(throwAwayShowTimeoutRef.current);
        throwAwayShowTimeoutRef.current = null;
      }
    };
  }, [activeOutcomeRef, isRunPlay, routeStarted, showThrowAwayButton, throwAwayArmed]);

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
      <EndZoneGraphics oneYardInPixels={renderOneYardInPixels} yardLine={yardLine} />

      <div
        className={distance < 20 && yardLine < 90 ? "first-down" : "hide"}
        style={{ top: `${toScreenY(firstDownStartY)}px`, position: 'absolute' }}
      ></div>

      <div
        className="line-of-scrimage"
        style={{ top: `${toScreenY(lineOfScrimmageY)}px`, position: 'absolute' }}
      ></div>

      <div
        className="half bottom-half"
        onDragOver={(e) => handleDragOver(e)}
        onDrop={(e) => handleDrop(e, fieldSize?.height)}
      >
        {/*
        {routeStarted && isRunPlay && runLaserOverlayRef.current?.origin && Array.isArray(runLaserOverlayRef.current?.rays) && (
          <svg className="route-svg">
            {runLaserOverlayRef.current.rays.map((ray, index) => {
              const isBest = index === runLaserOverlayRef.current.bestIndex;
              const endPoint = ray?.endPoint ?? runLaserOverlayRef.current.origin;
              return (
                <line
                  key={`run-laser-${index}`}
                  x1={toScreenX(runLaserOverlayRef.current.origin.x)}
                  y1={toScreenY(runLaserOverlayRef.current.origin.y)}
                  x2={toScreenX(endPoint.x)}
                  y2={toScreenY(endPoint.y)}
                  stroke={isBest ? '#ff0000' : 'rgba(255, 0, 0, 0.45)'}
                  strokeWidth={isBest ? 2.6 : 1.2}
                  strokeDasharray={ray?.blockedBy === 'backward' ? '3,5' : 'none'}
                />
              );
            })}
          </svg>
        )}
        */}

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
              {isOffense && (player.role === "WR" || player.role === "TE" || player.role === "RB") && player.position && player.role !== "WR" && (
                <svg className="route-svg">
                  <circle
                    cx={toScreenX(player.position.x)}
                    cy={toScreenY(player.position.y)}
                    r={(OPENNESS_BUBBLE_RADIUS_BASE / LOGICAL_FIELD_WIDTH) * fieldSize.width}
                    fill="none"
                    stroke="rgba(180, 180, 180, 0.85)"
                    strokeWidth="1.5"
                    strokeDasharray="4,6"
                  />
                </svg>
              )}

              {(() => {
                const isOline = player.role === 'offensive-lineman';
                const phase5State = isOline ? (phase5EngagementByBlockerId[player.id] ?? 'neutral') : null;
                const extraClassName = isOline && routeStarted ? `phase5-ol phase5-${phase5State}` : '';
                return (
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
                extraClassName={extraClassName}
              />
                );
              })()}

              {!routeStarted && isOffense && (player.role == "WR" || player.role == "TE" || player.role == "RB") && (
                <div
                  style={{
                    position: 'absolute',
                    left: toScreenX(player.position.x) - labelOffsetX,
                    top: toScreenY(player.position.y) + labelOffsetY,
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

              {thrownBallLine && (() => {
                if (!thrownBallLine) return;
                const thrownTargetY =
                  thrownBallLine.targetHalf === 'top'
                    ? thrownBallLine.y - (LOGICAL_FIELD_HEIGHT / 2)
                    : thrownBallLine.y;
                return (
                  <svg className="thrown-line-svg">
                    <line
                      x1={toScreenX(qbPlayer?.position?.x ?? (LOGICAL_FIELD_WIDTH / 2))}
                      y1={toScreenY(qbPlayer?.position?.y ?? (LOGICAL_FIELD_HEIGHT / 6))}
                      x2={toScreenX(thrownBallLine.x)}
                      y2={toScreenY(thrownTargetY)}
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
                        return `M${toScreenX(player.position.x)},${toScreenY(player.position.y)} L${toScreenX(endX)},${toScreenY(endY)}`;
                      })()}
                      stroke="red"
                      strokeWidth="5"
                      fill="none"
                      markerEnd="url(#arrow-red)"
                    />
                  ) : (
                  <>
                    {canStemRoute(player.route) && (
                      <path
                        d={getRoutePath(
                          fieldSize,
                          toScreenX(player.position.x),
                          toScreenY(player.position.y),
                          player.route,
                          offsetX,
                          offsetY,
                          100,
                          player.routeStemScale ?? 1
                        )}
                        stroke="transparent"
                        strokeWidth="24"
                        fill="none"
                        pointerEvents="stroke"
                        onMouseDown={(event) => startStemDrag(event, player)}
                        onTouchStart={(event) => startStemDrag(event, player)}
                        style={{ cursor: 'ns-resize' }}
                      />
                    )}
                    <path
                      d={getRoutePath(
                        fieldSize,
                        toScreenX(player.position.x),
                        toScreenY(player.position.y),
                        player.route,
                        offsetX,
                        offsetY,
                        100,
                        player.routeStemScale ?? 1
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
                      onMouseDown={(event) => startStemDrag(event, player)}
                      onTouchStart={(event) => startStemDrag(event, player)}
                      style={{ cursor: canStemRoute(player.route) ? 'ns-resize' : 'default' }}
                    />
                  </>
                  )}
                </svg>
              )}

              {player.isBlocking && !routeStarted && outcome === "" && (
                <svg className="route-svg">
                  <path
                    d={getRoutePath(fieldSize, toScreenX(player.position.x), toScreenY(player.position.y), 'block', offsetX, offsetY)}
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