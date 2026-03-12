// DefensiveField.jsx
import React, { useState } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LOGICAL_FIELD_WIDTH, LOGICAL_FIELD_HEIGHT } from './Field';
import Player from './Player';
import '../App.css';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import DefensiveZone from './Routes/defensizeZones'
import { useDefenseSocketSync } from '../Hooks/useDefenseSocketSync';
import { getUnifiedAccelerationRate, getUnifiedMaxSpeed } from '../Utils/movementModel';

const SKILL_SPEED_SCALE = 0.78;

function DefensiveField({ offsetX, offsetY, socket}) {
    const {
        players,
      inventory,
        selectedPlayerId,
        setSelectedPlayerId = () => {},
        setPreSnapPlayers = () => {},
        setPlayers: setPlayersFromContext,
        fieldSize = { width: 0, height: 0, area: 0 },
        setCurrentYards = () => {},
        routeStarted,
        outcome,
        isRunPlay,
        setSackTimeRemaining = () => {},
        isOffense,
        setOutcome = () => {},
        setYardLine = () => {},
        yardLine,
        setReadyToCatchIds = () => {},
        setRouteStarted = () => {},
        fieldRef, 
        setFirstDownStartY = () => {},
        setQbPenalty = () => {},
        setDraggingId = () => {},
        setSelectedZoneId = () => {},
        setPaused = () => {},
        setOpeness = () => {},
        setLiveCountdown = () => {},
        setDown = () => {},
        setDistance = () => {},
        setRouteProgress = () => {},
        setCompletedYards = () => {},
        roomId,
        preSnapRef,
        setThrownBallLine = () => {},
        gameClockRef,
        gameIntervalRef,
        setGameClock = () => {},
        setQuarter = () => {}
    } = useAppContext();
    const setPlayers = useCallback((nextPlayersOrUpdater) => {
      if (typeof setPlayersFromContext === 'function') {
        setPlayersFromContext(nextPlayersOrUpdater);
      }
    }, [setPlayersFromContext]);

    const { handleMouseDown, handleTouchStart, handleDragOver, handleDrop } = useHandlerContext();
    const offensiveLineProfiles = useMemo(
      () => (Array.isArray(inventory?.offensiveLine) ? inventory.offensiveLine : []),
      [inventory?.offensiveLine]
    );
    const defensiveLineProfiles = useMemo(
      () => (Array.isArray(inventory?.defensiveLine) ? inventory.defensiveLine : []),
      [inventory?.defensiveLine]
    );
    const safePlayers = useMemo(() => (Array.isArray(players) ? players : []), [players]);
    const oLineRating = typeof inventory?.OLine === 'number' ? inventory.OLine : 78;
    const dLineRating = typeof inventory?.DLine === 'number' ? inventory.DLine : 80;
    const [defensiveMessage, setDefensiveMessage] = useState("")
    const aspectRatio = LOGICAL_FIELD_WIDTH / LOGICAL_FIELD_HEIGHT;
    const labelOffsetY = Math.max(8, LOGICAL_FIELD_HEIGHT * 0.014);
    const labelOffsetX = Math.max(6, LOGICAL_FIELD_WIDTH * 0.015);
    const toScreenX = useCallback((logicalX) => (logicalX / LOGICAL_FIELD_WIDTH) * fieldSize.width, [fieldSize.width]);
    const toScreenY = useCallback((logicalY) => (logicalY / LOGICAL_FIELD_HEIGHT) * fieldSize.height, [fieldSize.height]);
    const toDefenseSpaceY = useCallback((targetPlayer) => {
      const halfHeight = LOGICAL_FIELD_HEIGHT / 2;
      return targetPlayer.isOffense
        ? targetPlayer.position.y + halfHeight
        : targetPlayer.position.y;
    }, []);
    

    // Track each defender's pursuit mode across animation frames.
    const pursuitStateRef = useRef(new Map());
    const receiverMotionRef = useRef(new Map());
    const hasPlacedStaticDefenseRef = useRef(false);
    const sackDebugRef = useRef({ sackedLogged: false });
    const runPlayStateRef = useRef({ runnerId: null, startSharedX: null, startSharedY: null, startTimeMs: null, tackledLogged: false });
    const pendingRunOutcomeRef = useRef(null);
    const safetyPursuitDebugRef = useRef({
      lastLogByPlayerId: new Map(),
      delayEligibleByPlayerId: new Map(),
    });
    const runPursuitPredictionRef = useRef({
      lastByRunnerId: new Map(),
    });
    const protectionAssignmentsRef = useRef(new Map());
    const trenchAnchorsRef = useRef(new Map());
      
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
  const toDefenseSpaceYForAssignment = (candidate) => (
    candidate.isOffense
      ? candidate.position.y + (LOGICAL_FIELD_HEIGHT / 2)
      : candidate.position.y
  );
  const findClosestOffensivePlayerId = (defenderPosition, roster) => {
    let closestId = null;
    let closestDistance = Infinity;

    roster.forEach((candidate) => {
      if (!candidate.isOffense || candidate.role === 'offensive-lineman' || candidate.role === 'qb') {
        return;
      }

      const dx = candidate.position.x - defenderPosition.x;
      const dy = toDefenseSpaceYForAssignment(candidate) - defenderPosition.y;
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

      return p;
    })
  );
}, [routeStarted, setPlayers]);

    useEffect(() => {
      const timer = setTimeout(() => {
        if (!hasPlacedStaticDefenseRef.current) {
          hasPlacedStaticDefenseRef.current = true;
          let width = LOGICAL_FIELD_WIDTH;
          let height = LOGICAL_FIELD_HEIGHT;
          const dLineProfileById = new Map(defensiveLineProfiles.map((entry) => [entry.id, entry]));
          const staticPlayers = [
            {
              id: 'D-L1',
              position: { x: width * 0.5 - (width * 0.125), y: height * 0.5 - (height * 0.02) },
              isOffense: false,
              role: 'defensive-lineman',
              speed: dLineProfileById.get('D-L1')?.speed ?? 72,
              acceleration: dLineProfileById.get('D-L1')?.acceleration ?? 68,
            },
            {
              id: 'D-L2',
              position: { x: width * 0.5 - (width * 0.044), y: height * 0.5 - (height * 0.02) },
              isOffense: false,
              role: 'defensive-lineman',
              speed: dLineProfileById.get('D-L2')?.speed ?? 71,
              acceleration: dLineProfileById.get('D-L2')?.acceleration ?? 67,
            },
            {
              id: 'D-L3',
              position: { x: width * 0.5 + (width * 0.044), y: height * 0.5 - (height * 0.02) },
              isOffense: false,
              role: 'defensive-lineman',
              speed: dLineProfileById.get('D-L3')?.speed ?? 74,
              acceleration: dLineProfileById.get('D-L3')?.acceleration ?? 70,
            },
            {
              id: 'D-L4',
              position: { x: width * 0.5 + (width * 0.125), y: height * 0.5 - (height * 0.02) },
              isOffense: false,
              role: 'defensive-lineman',
              speed: dLineProfileById.get('D-L4')?.speed ?? 70,
              acceleration: dLineProfileById.get('D-L4')?.acceleration ?? 66,
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
    }, [defensiveLineProfiles, fieldSize?.height, fieldSize?.width, setPlayers]);

    // route duration
    useEffect(() => {
    if (!routeStarted) {
      return;
    }

    let animationFrameId;
    let lastEmitTime = 0;
    const playStartTimeMs = performance.now();
    const passSetWindowMs = 650;
    const engageDistanceThreshold = LOGICAL_FIELD_WIDTH * 0.045; // was 46
    const dLineSpeedScale = LOGICAL_FIELD_WIDTH * 0.0025; // was 1.9
    const blockerProfileById = new Map();
    const rusherProfileById = new Map();

    const getAccelerationRate = (player) => getUnifiedAccelerationRate(player);

    const normalizeVector = (vector) => {
      const length = Math.hypot(vector.x, vector.y) || 1;
      return { x: vector.x / length, y: vector.y / length };
    };

    const getSharedY = (player) => (player.isOffense ? player.position.y + (LOGICAL_FIELD_HEIGHT / 2) : player.position.y);
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // Add per-play randomization for blockers/rushers
    const getOlProfile = (player) => {
      const cached = blockerProfileById.get(player.id);
      if (cached) return cached;

      const lineProfile = offensiveLineProfiles.find((entry) => entry.id === player.id);
      // Randomize blocking and strength ±5 each play
      const randomDeltaBlock = (Math.random() * 10) - 5; // -5 to +5
      const randomDeltaStrength = (Math.random() * 10) - 5;
      const baseBlocking = player.role === 'WR'
        ? 50
        : (lineProfile?.blocking ?? player.blocking ?? oLineRating);
      const baseStrength = player.role === 'WR'
        ? 50
        : (lineProfile?.strength ?? player.strength ?? 80);
      const profile = {
        blocking: baseBlocking + randomDeltaBlock,
        strength: baseStrength + randomDeltaStrength,
        technique: lineProfile?.technique ?? player.technique ?? 78,
      };
      blockerProfileById.set(player.id, profile);
      return profile;
    };

    const getRusherProfile = (player) => {
      const cached = rusherProfileById.get(player.id);
      if (cached) return cached;

      const lineProfile = defensiveLineProfiles.find((entry) => entry.id === player.id);
      // Randomize power and strength ±5 each play
      const randomDeltaPower = (Math.random() * 10) - 5;
      const randomDeltaStrength = (Math.random() * 10) - 5;
      const rolePowerDefault = (player.role === 'CB' || player.role === 'S')
        ? 50
        : (player.role === 'LB' ? 70 : 78);
      const profile = {
        power: (lineProfile?.power ?? player.blitzing ?? rolePowerDefault) + randomDeltaPower,
        strength: (lineProfile?.strength ?? dLineRating) + randomDeltaStrength,
        technique: lineProfile?.technique ?? player.reactionTime ?? 77,
        speed: lineProfile?.speed ?? player.speed ?? 72,
        acceleration: lineProfile?.acceleration ?? player.acceleration ?? 68,
      };
      rusherProfileById.set(player.id, profile);
      return profile;
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
      if (pendingRunOutcomeRef.current && routeStarted && outcome === "") {
        const pending = pendingRunOutcomeRef.current;
        pendingRunOutcomeRef.current = null;
        if (!sackDebugRef.current.sackedLogged) {
          sackDebugRef.current.sackedLogged = true;
        }
        setSackTimeRemaining(0);
        setRouteStarted(false);
        setCompletedYards(pending.completedYards);
        setOutcome(pending.outcome);
        socket.emit('route_started', { routeStarted: false, roomId });
        socket.emit('play_outcome', { outcome: pending.outcome, completedYards: pending.completedYards, roomId });
      }

      let outcomeTriggered = false;
      let triggeredOutcome = '';
      let triggeredCompletedYards = 0;

      setPlayers(prevPlayers => {
        let updated = false;
        const movingPlayers = [];
        const recentCutByReceiverId = new Map();


        prevPlayers.forEach((candidate) => {
          if (!candidate.isOffense || candidate.role === 'offensive-lineman' || candidate.role === 'qb' || !candidate.position) {
            return;
          }

          const currentPosition = { x: candidate.position.x, y: toDefenseSpaceY(candidate) };
          const previousState = receiverMotionRef.current.get(candidate.id);
          if (!previousState) {
            receiverMotionRef.current.set(candidate.id, {
              position: currentPosition,
              direction: null,
              lastCutTime: null,
              timestamp: time,
              speed: 0,
            });
            recentCutByReceiverId.set(candidate.id, false);
            return;
          }

          const dx = currentPosition.x - previousState.position.x;
          const dy = currentPosition.y - previousState.position.y;
          const movementDistance = Math.hypot(dx, dy);
          const deltaMs = Math.max(time - (previousState.timestamp ?? time), 1);
          const receiverSpeed = movementDistance / (deltaMs / 1000);
          let currentDirection = previousState.direction;
          let lastCutTime = previousState.lastCutTime;

          if (movementDistance > 0.35) {
            currentDirection = normalizeVector({ x: dx, y: dy });
            if (previousState.direction) {
              const dot = Math.max(-1, Math.min(1, (previousState.direction.x * currentDirection.x) + (previousState.direction.y * currentDirection.y)));
              const turnSharpness = (1 - dot) / 2;
              if (turnSharpness >= 0.2) {
                lastCutTime = time;
              }
            }
          }

          const hasRecentCut = typeof lastCutTime === 'number' && (time - lastCutTime) <= 260;
          recentCutByReceiverId.set(candidate.id, hasRecentCut);

          receiverMotionRef.current.set(candidate.id, {
            position: currentPosition,
            direction: currentDirection,
            lastCutTime,
            timestamp: time,
            speed: receiverSpeed,
          });
        });

        const qb = prevPlayers.find((player) => player.isOffense && player.role === 'qb' && player.position);
        const runCarrier = isRunPlay
          ? prevPlayers.find((player) => player.isOffense && player.route === 'run' && player.role !== 'qb' && player.role !== 'offensive-lineman' && player.position)
          : null;
        const offensiveLine = prevPlayers.filter((player) => player.isOffense && player.role === 'offensive-lineman' && player.position);
        const supportBlockers = prevPlayers.filter((player) => {
          if (!player.isOffense || !player.position || player.role === 'qb' || player.role === 'offensive-lineman') {
            return false;
          }
          if (isRunPlay) {
            return runCarrier ? player.id !== runCarrier.id : true;
          }
          return player.isBlocking && (player.role === 'TE' || player.role === 'RB');
        });
        const passProtectors = [...offensiveLine, ...supportBlockers];
        // Initialize qbShared before any usage
        const qbShared = qb
          ? { x: qb.position.x, y: getSharedY(qb) }
          : { x: LOGICAL_FIELD_WIDTH / 2, y: Math.max((LOGICAL_FIELD_HEIGHT / 2) + 18, LOGICAL_FIELD_HEIGHT * 0.6) };
        const runCarrierShared = runCarrier
          ? { x: runCarrier.position.x, y: getSharedY(runCarrier) }
          : null;
        let runCarrierVelocity = { x: 0, y: 0 };
        if (isRunPlay && runCarrier?.id && runCarrierShared) {
          const previousCarrierState = runPursuitPredictionRef.current.lastByRunnerId.get(runCarrier.id);
          if (previousCarrierState?.position && typeof previousCarrierState.time === 'number') {
            const deltaSeconds = Math.max((time - previousCarrierState.time) / 1000, 0.016);
            runCarrierVelocity = {
              x: (runCarrierShared.x - previousCarrierState.position.x) / deltaSeconds,
              y: (runCarrierShared.y - previousCarrierState.position.y) / deltaSeconds,
            };
          }
          runPursuitPredictionRef.current.lastByRunnerId.set(runCarrier.id, {
            position: runCarrierShared,
            time,
          });
        } else {
          runPursuitPredictionRef.current.lastByRunnerId = new Map();
        }
        const protectionTargetShared = (isRunPlay && runCarrierShared) ? runCarrierShared : qbShared;

        if (isRunPlay && runCarrier?.id) {
          const currentRunState = runPlayStateRef.current;
          if (currentRunState.runnerId !== runCarrier.id || currentRunState.startSharedY === null) {
            const oneYardPixels = LOGICAL_FIELD_HEIGHT / 40;
            const lineOfScrimmageSharedY = LOGICAL_FIELD_HEIGHT / 2;
            const delayThresholdSharedY = lineOfScrimmageSharedY - (oneYardPixels * 8);
            const delayEligibleByPlayerId = new Map();
            prevPlayers.forEach((candidate) => {
              if (candidate.isOffense || !candidate.position || candidate.role === 'defensive-lineman') {
                return;
              }
              delayEligibleByPlayerId.set(candidate.id, candidate.position.y <= delayThresholdSharedY);
            });
            safetyPursuitDebugRef.current.delayEligibleByPlayerId = delayEligibleByPlayerId;
            runPlayStateRef.current = {
              runnerId: runCarrier.id,
              startSharedX: runCarrierShared?.x ?? null,
              startSharedY: runCarrierShared?.y ?? null,
              startTimeMs: time,
              tackledLogged: false,
            };
          }
        } else if (runPlayStateRef.current.runnerId !== null) {
          runPlayStateRef.current = { runnerId: null, startSharedX: null, startSharedY: null, startTimeMs: null, tackledLogged: false };
          safetyPursuitDebugRef.current.delayEligibleByPlayerId = new Map();
        }

        // Rushers: pass = DL + blitzers; run = all defenders pursue the ball carrier.
        const rushers = prevPlayers.filter((player) => {
          if (player.isOffense || !player.position) return false;
          if (isRunPlay) return true;
          return player.role === 'defensive-lineman' || player.isBlitzing;
        });
        const assignedDefenderByWrId = new Map();
        prevPlayers.forEach((defender) => {
          if (defender.isOffense || !defender.position || !defender.assignedOffensiveId) {
            return;
          }
          const targetWr = prevPlayers.find(
            (candidate) => candidate.isOffense && candidate.role === 'WR' && candidate.id === defender.assignedOffensiveId
          );
          if (targetWr?.position) {
            assignedDefenderByWrId.set(targetWr.id, defender.id);
          }
        });
        const runDriveRushers = isRunPlay
          ? rushers.filter((player) => player.role === 'defensive-lineman')
          : rushers;
        const activeRunDriveRushers = runDriveRushers.length > 0 ? runDriveRushers : rushers;

        const sortedLine = [...passProtectors].sort((a, b) => a.position.x - b.position.x);
        const sortedRushers = [...rushers].sort((a, b) => a.position.x - b.position.x);
        const sortedRunDriveRushers = [...activeRunDriveRushers].sort((a, b) => a.position.x - b.position.x);
        const edgeRusherById = new Map();
        sortedRushers.forEach((rusher, index) => {
          edgeRusherById.set(rusher.id, {
            isEdge: index === 0 || index === sortedRushers.length - 1,
            side: index === 0 ? 'left' : (index === sortedRushers.length - 1 ? 'right' : 'interior'),
          });
        });
        const nextAssignments = new Map();
        sortedLine.forEach((blocker, index) => {
          if (isRunPlay && blocker.role === 'offensive-lineman') {
            if (sortedRunDriveRushers[index]) {
              nextAssignments.set(blocker.id, sortedRunDriveRushers[index].id);
            }
            return;
          }

          const preferred = protectionAssignmentsRef.current.get(blocker.id);
          const preferredExists = preferred && rushers.some((rusher) => rusher.id === preferred);
          if (preferredExists) {
            nextAssignments.set(blocker.id, preferred);
            return;
          }
          if (sortedRushers[index]) {
            nextAssignments.set(blocker.id, sortedRushers[index].id);
          }
        });
        protectionAssignmentsRef.current = nextAssignments;

        const blockerTargetById = new Map();
        passProtectors.forEach((blocker) => {
          const blockerShared = { x: blocker.position.x, y: getSharedY(blocker) };
          if (isRunPlay && blocker.role === 'WR') {
            const assignedDefenderId = assignedDefenderByWrId.get(blocker.id);
            const assignedDefender = rushers.find((rusher) => rusher.id === assignedDefenderId);
            if (assignedDefender) {
              blockerTargetById.set(blocker.id, assignedDefender.id);
              return;
            }
          }
          const candidateRushers = (isRunPlay && blocker.role === 'offensive-lineman')
            ? activeRunDriveRushers
            : rushers;
          const assignedId = nextAssignments.get(blocker.id);
          const assigned = candidateRushers.find((rusher) => rusher.id === assignedId);
          const claimedRusherCounts = new Map();
          blockerTargetById.forEach((rusherId) => {
            claimedRusherCounts.set(rusherId, (claimedRusherCounts.get(rusherId) ?? 0) + 1);
          });

          const scoredThreats = candidateRushers.map((rusher) => {
            const rusherShared = { x: rusher.position.x, y: getSharedY(rusher) };
            const distance = Math.hypot(rusherShared.x - blockerShared.x, rusherShared.y - blockerShared.y);
            const rusherProfile = getRusherProfile(rusher);
            const laneThreat = Math.abs(rusherShared.x - protectionTargetShared.x) > (LOGICAL_FIELD_WIDTH * 0.18) ? 6 : 0;
            const claimedCount = claimedRusherCounts.get(rusher.id) ?? 0;
            const freeRusherPriority = claimedCount === 0 ? 20 : (-18 * claimedCount);
            const assignmentStickiness = rusher.id === assignedId ? 6 : 0;
            const threatScore = (Math.max(0, 95 - distance) * 0.55) + (rusherProfile.power * 0.45) + laneThreat + freeRusherPriority + assignmentStickiness;
            return { rusher, distance, threatScore };
          }).filter((entry) => entry.distance <= 160);

          scoredThreats.sort((a, b) => b.threatScore - a.threatScore);
          const bestThreat = scoredThreats[0]?.rusher;
          const assignedThreat = assigned ? scoredThreats.find((entry) => entry.rusher.id === assigned.id) : null;

          if (!assigned && bestThreat) {
            blockerTargetById.set(blocker.id, bestThreat.id);
            return;
          }

          if (!bestThreat || !assigned) {
            if (assigned) blockerTargetById.set(blocker.id, assigned.id);
            return;
          }

          const assignedScore = assignedThreat?.threatScore ?? -Infinity;
          const bestScore = scoredThreats[0]?.threatScore ?? assignedScore;
          blockerTargetById.set(blocker.id, (bestScore - assignedScore) >= 7 ? bestThreat.id : assigned.id);
        });

        const elapsedSinceSnapMs = Math.max(0, time - playStartTimeMs);
        const freeRusherScanWindowMs = 900;
        if (elapsedSinceSnapMs <= freeRusherScanWindowMs) {
          const offensiveLineBlockers = passProtectors.filter((blocker) => blocker.role === 'offensive-lineman' && blocker.position);
          if (offensiveLineBlockers.length > 0 && rushers.length > 0) {
            const oLineById = new Map(offensiveLineBlockers.map((blocker) => [blocker.id, blocker]));
            const rusherById = new Map(rushers.map((rusher) => [rusher.id, rusher]));
            const oLineTargetsByRusherId = new Map();

            blockerTargetById.forEach((rusherId, blockerId) => {
              if (!oLineById.has(blockerId) || !rusherById.has(rusherId)) {
                return;
              }
              const assigned = oLineTargetsByRusherId.get(rusherId) ?? [];
              assigned.push(blockerId);
              oLineTargetsByRusherId.set(rusherId, assigned);
            });

            const uncoveredRushers = rushers
              .filter((rusher) => (oLineTargetsByRusherId.get(rusher.id)?.length ?? 0) === 0)
              .map((rusher) => rusher.id);

            if (uncoveredRushers.length > 0) {
              const peelCandidates = [];

              oLineTargetsByRusherId.forEach((blockerIds, rusherId) => {
                if (blockerIds.length < 2) {
                  return;
                }

                const rusher = rusherById.get(rusherId);
                if (!rusher?.position) {
                  return;
                }

                const rusherShared = { x: rusher.position.x, y: getSharedY(rusher) };
                const sortedByDistance = [...blockerIds].sort((aId, bId) => {
                  const blockerA = oLineById.get(aId);
                  const blockerB = oLineById.get(bId);
                  if (!blockerA?.position || !blockerB?.position) {
                    return 0;
                  }
                  const blockerAShared = { x: blockerA.position.x, y: getSharedY(blockerA) };
                  const blockerBShared = { x: blockerB.position.x, y: getSharedY(blockerB) };
                  const distA = Math.hypot(blockerAShared.x - rusherShared.x, blockerAShared.y - rusherShared.y);
                  const distB = Math.hypot(blockerBShared.x - rusherShared.x, blockerBShared.y - rusherShared.y);
                  return distA - distB;
                });

                sortedByDistance.slice(1).forEach((blockerId) => {
                  peelCandidates.push(blockerId);
                });
              });

              const remainingFreeRushers = [...uncoveredRushers];
              peelCandidates.forEach((blockerId) => {
                if (remainingFreeRushers.length === 0) {
                  return;
                }

                const blocker = oLineById.get(blockerId);
                if (!blocker?.position) {
                  return;
                }

                const blockerShared = { x: blocker.position.x, y: getSharedY(blocker) };
                let bestIndex = -1;
                let bestDistance = Infinity;

                remainingFreeRushers.forEach((freeRusherId, index) => {
                  const freeRusher = rusherById.get(freeRusherId);
                  if (!freeRusher?.position) {
                    return;
                  }
                  const freeRusherShared = { x: freeRusher.position.x, y: getSharedY(freeRusher) };
                  const distance = Math.hypot(freeRusherShared.x - blockerShared.x, freeRusherShared.y - blockerShared.y);
                  if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = index;
                  }
                });

                if (bestIndex >= 0) {
                  const reassignedRusherId = remainingFreeRushers.splice(bestIndex, 1)[0];
                  blockerTargetById.set(blockerId, reassignedRusherId);
                }
              });
            }
          }
        }

        const blockersByRusherId = new Map();
        blockerTargetById.forEach((rusherId, blockerId) => {
          const list = blockersByRusherId.get(rusherId) ?? [];
          list.push(blockerId);
          blockersByRusherId.set(rusherId, list);
        });

        const newPlayers = prevPlayers.map((basePlayer) => {
          let player = basePlayer;

          if (player.isOffense && player.position && (player.role === 'offensive-lineman' || supportBlockers.some((blocker) => blocker.id === player.id))) {
            if (!trenchAnchorsRef.current.has(player.id)) {
              trenchAnchorsRef.current.set(player.id, { x: player.position.x, y: player.position.y });
            }

            const anchor = trenchAnchorsRef.current.get(player.id);
            const targetRusherId = blockerTargetById.get(player.id);
            const targetRusher = rushers.find((rusher) => rusher.id === targetRusherId);
            const blockerShared = { x: player.position.x, y: getSharedY(player) };
            const olProfile = getOlProfile(player);
            const anchorSharedY = anchor.y + (LOGICAL_FIELD_HEIGHT / 2);
            const isWideReceiverBlocker = player.role === 'WR';
            const isSupportBlocker = player.role === 'TE' || player.role === 'RB' || isWideReceiverBlocker;
            const isRunningBackBlocker = player.role === 'RB';
            const dropbackDepth = isRunningBackBlocker
              ? -clamp(LOGICAL_FIELD_HEIGHT * 0.015, LOGICAL_FIELD_HEIGHT * 0.006, LOGICAL_FIELD_HEIGHT * 0.02)
              : (isRunPlay && isWideReceiverBlocker)
                ? -clamp(LOGICAL_FIELD_HEIGHT * 0.08, LOGICAL_FIELD_HEIGHT * 0.04, LOGICAL_FIELD_HEIGHT * 0.12)
              : clamp(LOGICAL_FIELD_HEIGHT * 0.035, LOGICAL_FIELD_HEIGHT * 0.012, LOGICAL_FIELD_HEIGHT * 0.022);
            const inPassSetWindow = !isRunPlay && ((time - playStartTimeMs) < passSetWindowMs);
            const supportEngageDistance = isWideReceiverBlocker
              ? (engageDistanceThreshold * 1.7)
              : (isSupportBlocker ? (engageDistanceThreshold * 1.2) : engageDistanceThreshold);

            let targetSharedX = anchor.x;
            let targetSharedY = anchorSharedY + dropbackDepth;

            if (targetRusher) {
              const rusherShared = { x: targetRusher.position.x, y: getSharedY(targetRusher) };
              const rusherDistance = Math.hypot(rusherShared.x - blockerShared.x, rusherShared.y - blockerShared.y);
              const shouldEngage = isRunPlay
                ? true
                : (!inPassSetWindow && rusherDistance <= supportEngageDistance);
              const isRunLinemenDrive = isRunPlay && player.role === 'offensive-lineman';

              if (!shouldEngage) {
                const mirrorOffset = clamp(rusherShared.x - anchor.x, -LOGICAL_FIELD_WIDTH * 0.022, LOGICAL_FIELD_WIDTH * 0.022);
                targetSharedX = anchor.x + mirrorOffset;
                targetSharedY = isRunLinemenDrive
                  ? (anchorSharedY - clamp(LOGICAL_FIELD_HEIGHT * 0.016, LOGICAL_FIELD_HEIGHT * 0.008, LOGICAL_FIELD_HEIGHT * 0.024))
                  : (anchorSharedY + dropbackDepth);
              } else {
              if (isRunLinemenDrive) {
                const upfieldDriveDepth = clamp(LOGICAL_FIELD_HEIGHT * 0.022, LOGICAL_FIELD_HEIGHT * 0.014, LOGICAL_FIELD_HEIGHT * 0.034);
                const runLaneSign = Math.sign(anchor.x - (runCarrierShared?.x ?? (LOGICAL_FIELD_WIDTH / 2)));
                const runLaneWidth = clamp(LOGICAL_FIELD_WIDTH * 0.026, LOGICAL_FIELD_WIDTH * 0.012, LOGICAL_FIELD_WIDTH * 0.034);
                const rearLeverageDepth = clamp(LOGICAL_FIELD_HEIGHT * 0.015, LOGICAL_FIELD_HEIGHT * 0.01, LOGICAL_FIELD_HEIGHT * 0.024);
                const minRearBuffer = clamp(LOGICAL_FIELD_HEIGHT * 0.004, 2.5, 6.5);
                targetSharedX = rusherShared.x + (runLaneSign * runLaneWidth);
                targetSharedY = rusherShared.y + rearLeverageDepth;

                const dxEngage = rusherShared.x - blockerShared.x;
                const dyEngage = rusherShared.y - blockerShared.y;
                const engageDistance = Math.hypot(dxEngage, dyEngage);
                if (engageDistance <= LOGICAL_FIELD_WIDTH * 0.027) {
                  const rusherProfile = getRusherProfile(targetRusher);
                  const blockerForce = ((olProfile.blocking * 1.1) + (olProfile.strength * 1.1) + (olProfile.technique));
                  const rushForce = (rusherProfile.power) + (rusherProfile.strength) + (rusherProfile.technique);
                  const contest = blockerForce - rushForce;
                  const drivePush = contest >= 0
                    ? Math.min(LOGICAL_FIELD_HEIGHT * 0.018, LOGICAL_FIELD_HEIGHT * 0.004 + (contest * 0.0012))
                    : -Math.min(LOGICAL_FIELD_HEIGHT * 0.012, LOGICAL_FIELD_HEIGHT * 0.003 + (Math.abs(contest) * 0.001));
                  targetSharedY = Math.max(rusherShared.y + minRearBuffer, targetSharedY - drivePush);
                  targetSharedX = rusherShared.x + clamp(dxEngage * 0.18, -LOGICAL_FIELD_WIDTH * 0.01, LOGICAL_FIELD_WIDTH * 0.01);
                }

              } else {
              // Keep blocker between rusher and the active ball carrier lane.
              const laneDx = protectionTargetShared.x - rusherShared.x;
              const laneDy = protectionTargetShared.y - rusherShared.y;
              const laneLength = Math.hypot(laneDx, laneDy) || 1;
              const laneUnitX = laneDx / laneLength;
              const laneUnitY = laneDy / laneLength;
              const defaultLaneFraction = 0.36;
              const desiredDistanceFromRusher = clamp(laneLength * defaultLaneFraction, LOGICAL_FIELD_WIDTH * 0.012, LOGICAL_FIELD_WIDTH * 0.034);
              targetSharedX = rusherShared.x + (laneUnitX * desiredDistanceFromRusher);
              targetSharedY = rusherShared.y + (laneUnitY * desiredDistanceFromRusher);

              const dxEngage = rusherShared.x - blockerShared.x;
              const dyEngage = rusherShared.y - blockerShared.y;
              const engageDistance = Math.hypot(dxEngage, dyEngage);
              if (engageDistance <= LOGICAL_FIELD_WIDTH * 0.027) {
                const rusherProfile = getRusherProfile(targetRusher);
                const blockerForce = ((olProfile.blocking) + (olProfile.strength) + (olProfile.technique));
                const rushForce = (rusherProfile.power) + (rusherProfile.strength) + (rusherProfile.technique);
                const contest = blockerForce - rushForce;
                const contestPush = contest >= 0
                  ? Math.min(LOGICAL_FIELD_WIDTH * 0.0055, LOGICAL_FIELD_WIDTH * 0.0012 + (contest * 0.045))
                  : -Math.min(LOGICAL_FIELD_WIDTH * 0.015, LOGICAL_FIELD_WIDTH * 0.0026 + (Math.abs(contest) * 0.12));
                targetSharedX -= laneUnitX * contestPush;
                targetSharedY -= laneUnitY * contestPush;

                const lateralOffset = (dxEngage * laneUnitY) - (dyEngage * laneUnitX);
                targetSharedX += laneUnitY * Math.max(-LOGICAL_FIELD_WIDTH * 0.005, Math.min(LOGICAL_FIELD_WIDTH * 0.005, lateralOffset * 0.08));
                targetSharedY -= laneUnitX * Math.max(-LOGICAL_FIELD_WIDTH * 0.005, Math.min(LOGICAL_FIELD_WIDTH * 0.005, lateralOffset * 0.08));

                // If a blocker is losing badly, allow collapse depth to pass through QB level.
                if (contest < -6) {
                  const collapseDepth = Math.min(LOGICAL_FIELD_HEIGHT * 0.022, (Math.abs(contest) - 6) * (LOGICAL_FIELD_HEIGHT * 0.0011));
                  targetSharedX = protectionTargetShared.x + (laneUnitX * Math.min(LOGICAL_FIELD_WIDTH * 0.004, collapseDepth * 0.25));
                  targetSharedY = protectionTargetShared.y + (laneUnitY * collapseDepth);
                }
              }
              }
              }
            }

            targetSharedX = clamp(targetSharedX, LOGICAL_FIELD_WIDTH * 0.008, LOGICAL_FIELD_WIDTH - LOGICAL_FIELD_WIDTH * 0.008);
            const minSharedY = (isRunPlay && player.role === 'offensive-lineman')
              ? (LOGICAL_FIELD_HEIGHT * 0.43)
              : (isRunPlay && isWideReceiverBlocker)
                ? (LOGICAL_FIELD_HEIGHT * 0.01)
              : ((LOGICAL_FIELD_HEIGHT / 2) + LOGICAL_FIELD_HEIGHT * 0.004);
            targetSharedY = clamp(targetSharedY, minSharedY, LOGICAL_FIELD_HEIGHT - LOGICAL_FIELD_HEIGHT * 0.008);

            const rawNextX = player.position.x + (targetSharedX - player.position.x) * 0.18;
            const rawNextSharedY = blockerShared.y + (targetSharedY - blockerShared.y) * 0.18;
            const rawNextY = rawNextSharedY - (LOGICAL_FIELD_HEIGHT / 2);

            const lastTime = player.lastUpdateTime || time;
            const rawDeltaTime = (time - lastTime) / 1000;
            const deltaTime = clamp(rawDeltaTime, 0.016, 0.05);
            const blockerStepMultiplier = isRunPlay
              ? (isWideReceiverBlocker ? 2.7 : (isSupportBlocker ? 2.0 : 2.25))
              : (isSupportBlocker ? 1.9 : 1.8);
            const blockerTopSpeed = (player.speed ?? 68) * blockerStepMultiplier;
            let blockerCurrentSpeed = player.currentSpeed ?? 0;
            let maxOlStep = Math.max(LOGICAL_FIELD_WIDTH * 0.0016, blockerTopSpeed * deltaTime);

            if (isRunPlay && isWideReceiverBlocker) {
              const blockerAccelerationRate = getUnifiedAccelerationRate(player) * 0.6;
              const launchFloor = player.lastUpdateTime ? 0 : (blockerTopSpeed * 0.55);
              const acceleratedSpeed = (player.currentSpeed ?? 0) + (blockerAccelerationRate * deltaTime);
              blockerCurrentSpeed = Math.min(blockerTopSpeed, Math.max(launchFloor, acceleratedSpeed));
              maxOlStep = Math.max(LOGICAL_FIELD_WIDTH * 0.0016, blockerCurrentSpeed * deltaTime);
            }
            const stepDx = rawNextX - player.position.x;
            const stepDy = rawNextY - player.position.y;
            const stepDistance = Math.hypot(stepDx, stepDy);
            const stepScale = stepDistance > maxOlStep ? (maxOlStep / stepDistance) : 1;
            const nextX = player.position.x + (stepDx * stepScale);
            const nextY = player.position.y + (stepDy * stepScale);

            if (Math.abs(nextX - player.position.x) > 0.05 || Math.abs(nextY - player.position.y) > 0.05) {
              updated = true;
              return {
                ...player,
                position: { x: nextX, y: nextY },
                currentSpeed: (isRunPlay && isWideReceiverBlocker) ? blockerCurrentSpeed : player.currentSpeed,
                lastUpdateTime: time,
              };
            }

            return player;
          }

          if ((isRunPlay || player.role === 'defensive-lineman' || player.isBlitzing) && !player.isOffense && player.position) {
            const blockerIds = blockersByRusherId.get(player.id) ?? [];
            const engagedBlockers = blockerIds
              .map((blockerId) => prevPlayers.find((candidate) => candidate.id === blockerId && candidate.position))
              .filter(Boolean);

            const rusherProfile = getRusherProfile(player);
             const projectedRunCarrierTargetShared = (() => {
               if (!(isRunPlay && runCarrierShared)) {
                 return null;
               }

               const defenderSpeed = Math.max(player.currentSpeed ?? 0, rusherProfile.speed * dLineSpeedScale * 0.4);
               const relX = runCarrierShared.x - player.position.x;
               const relY = runCarrierShared.y - player.position.y;
               const vbX = runCarrierVelocity.x;
               const vbY = runCarrierVelocity.y;

               const a = (vbX * vbX) + (vbY * vbY) - (defenderSpeed * defenderSpeed);
               const b = 2 * ((relX * vbX) + (relY * vbY));
               const c = (relX * relX) + (relY * relY);

               let interceptTime = null;
               if (Math.abs(a) < 1e-6) {
                 if (Math.abs(b) > 1e-6) {
                   const linearTime = -c / b;
                   if (linearTime > 0) {
                     interceptTime = linearTime;
                   }
                 }
               } else {
                 const discriminant = (b * b) - (4 * a * c);
                 if (discriminant >= 0) {
                   const sqrtDiscriminant = Math.sqrt(discriminant);
                   const t1 = (-b - sqrtDiscriminant) / (2 * a);
                   const t2 = (-b + sqrtDiscriminant) / (2 * a);
                   const positiveTimes = [t1, t2].filter((candidateTime) => candidateTime > 0);
                   if (positiveTimes.length > 0) {
                     interceptTime = Math.min(...positiveTimes);
                   }
                 }
               }

               if (!(typeof interceptTime === 'number' && Number.isFinite(interceptTime))) {
                 const directDistance = Math.hypot(relX, relY);
                 interceptTime = directDistance / Math.max(defenderSpeed, 1);
               }

               const boundedInterceptTime = clamp(interceptTime, 0.06, 1.2);
               return {
                 x: clamp(runCarrierShared.x + (vbX * boundedInterceptTime), 6, LOGICAL_FIELD_WIDTH - 6),
                 y: clamp(runCarrierShared.y + (vbY * boundedInterceptTime), 6, LOGICAL_FIELD_HEIGHT - 6),
               };
             })();
             const rusherTargetShared = (isRunPlay && runCarrierShared)
               ? (projectedRunCarrierTargetShared ?? runCarrierShared)
               : qbShared;
             let targetX = rusherTargetShared.x;
             let targetY = rusherTargetShared.y;
             let activeContest = null;
             // Edge rushers: before engagement, target phantom QB offset
             const edgeMeta = edgeRusherById.get(player.id);
             const isEdgeRusher = edgeMeta?.isEdge === true;
             const edgeSign = edgeMeta?.side === 'left' ? -2 : (edgeMeta?.side === 'right' ? 2 : 0);
             let phantomOffset = 0;
             const elapsedSinceSnapMs = Math.max(0, time - playStartTimeMs);
             const oneYardPixels = LOGICAL_FIELD_HEIGHT / 40;
             const lineOfScrimmageSharedY = LOGICAL_FIELD_HEIGHT / 2;
             const hasDelayEligibility = safetyPursuitDebugRef.current.delayEligibleByPlayerId.get(player.id) === true;
             const inRunLateralOnlyWindow = isRunPlay
               && hasDelayEligibility
               && elapsedSinceSnapMs < 2000;
             const isSafetyPursuitEligible = isRunPlay
               && player.role !== 'defensive-lineman';
             const yardsFromLos = (player.position.y - lineOfScrimmageSharedY) / oneYardPixels;
             const pursuitDelayMs = hasDelayEligibility ? 2000 : 0;
             const delayRemainingMs = Math.max(0, pursuitDelayMs - elapsedSinceSnapMs);
             const shouldFollowX = inRunLateralOnlyWindow;
             const currentlyPursuing = isRunPlay && !inRunLateralOnlyWindow;
             const phantomRbTargetShared = {
               x: runCarrierShared?.x ?? targetX,
               y: player.position.y,
             };

             if (isSafetyPursuitEligible) {
               const lastLogAt = safetyPursuitDebugRef.current.lastLogByPlayerId.get(player.id) ?? -Infinity;
               if ((time - lastLogAt) >= 500) {
                 safetyPursuitDebugRef.current.lastLogByPlayerId.set(player.id, time);
               }
             }
             if (!isRunPlay && isEdgeRusher) {
               const phantomWindowMs = 250 + Math.random() * 150; // 250–400ms
               if (elapsedSinceSnapMs < phantomWindowMs) {
                 const widthMultiplier = 0.20 + Math.random() * 0.20; // 0.20–0.40
                 const clampMax = 60 + Math.random() * 60; // 60–120
                 phantomOffset = clamp(LOGICAL_FIELD_WIDTH * widthMultiplier, 32, clampMax);
                 targetX = rusherTargetShared.x + (phantomOffset * edgeSign);
                 targetY = rusherTargetShared.y + clamp(LOGICAL_FIELD_HEIGHT * 0.03, 4, 10);
               }
             }
             let pressureModifier = 1;
             const inDlBurstWindow = !isRunPlay && elapsedSinceSnapMs < 500;

            if (!inRunLateralOnlyWindow && engagedBlockers.length > 0 && !inDlBurstWindow) {
              const blocker = engagedBlockers[0];
              const blockerShared = { x: blocker.position.x, y: getSharedY(blocker) };
              const dx = blockerShared.x - player.position.x;
              const dy = blockerShared.y - player.position.y;
              const distance = Math.hypot(dx, dy);
              const olProfile = getOlProfile(blocker);
              const blockerForce = ((olProfile.blocking * 0.46) + (olProfile.strength * 0.34) + (olProfile.technique * 0.2));
              const rushForce = (rusherProfile.power * 0.46) + (rusherProfile.strength * 0.34) + (rusherProfile.technique * 0.2);
              const contest = blockerForce - rushForce;
              activeContest = contest;

              if (distance <= 30) {
                const toQb = normalizeVector({ x: rusherTargetShared.x - player.position.x, y: rusherTargetShared.y - player.position.y });
                const contestFactor = Math.min(1.4, Math.max(0.5, Math.abs(contest) / 26));
                if (contest >= 0) {
                  targetX = player.position.x - (toQb.x * (8 + (contestFactor * 5)));
                  targetY = player.position.y - (toQb.y * (8 + (contestFactor * 5)));
                  pressureModifier = 0.45;
                } else {
                  targetX = rusherTargetShared.x;
                  targetY = rusherTargetShared.y;
                  pressureModifier = 1 + (contestFactor * 0.24);
                }
              } else {
                targetX = blockerShared.x;
                targetY = blockerShared.y;
              }

              if (isEdgeRusher) {
                const edgeSign = edgeMeta.side === 'left' ? -1 : 1;
                const outsideOffset = clamp(LOGICAL_FIELD_WIDTH * 0.06, 16, 28);
                const bendDepth = clamp(LOGICAL_FIELD_HEIGHT * 0.075, 18, 32);
                const outsideX = clamp(blockerShared.x + (edgeSign * outsideOffset), 6, LOGICAL_FIELD_WIDTH - 6);
                const bendY = Math.min(rusherTargetShared.y, blockerShared.y + bendDepth);
                const hasClearedEdge = Math.abs(player.position.x - blockerShared.x) >= (outsideOffset * 0.75);

                // Force an outside bend path before turning downhill to the QB.
                if (!hasClearedEdge && player.position.y <= (rusherTargetShared.y - 4)) {
                  targetX = outsideX;
                  targetY = bendY;
                  pressureModifier = Math.max(pressureModifier, 1.06);
                }
              }
            } else if (inDlBurstWindow) {
              // First half-second: let DL get vertical surge before full engagement slows them.
              pressureModifier = 1.2;
            }

            if (inRunLateralOnlyWindow) {
              targetX = phantomRbTargetShared.x;
              targetY = phantomRbTargetShared.y;
            } else if (isSafetyPursuitEligible && runCarrierShared) {
              targetX = runCarrierShared.x;
              targetY = projectedRunCarrierTargetShared?.y ?? runCarrierShared.y;
            }

            const dx = targetX - player.position.x;
            const dy = targetY - player.position.y;
            const distance = Math.hypot(dx, dy);

            if (distance > 0.2) {
              const lastTime = player.lastUpdateTime || time;
              const deltaTime = Math.max((time - lastTime) / 1000, 0.016);

              if (inRunLateralOnlyWindow) {
                const lateralTopSpeed = rusherProfile.speed * dLineSpeedScale;
                const lateralFloor = lateralTopSpeed * 0.1;
                const lateralAcceleration = getUnifiedAccelerationRate(player);
                const acceleratedSpeed = (player.currentSpeed ?? 0) + (lateralAcceleration * deltaTime);
                const currentSpeed = Math.min(
                  lateralTopSpeed,
                  Math.max(lateralFloor, acceleratedSpeed)
                );
                const catchUpStep = Math.min(
                  Math.abs(dx) * 0.03,
                  LOGICAL_FIELD_WIDTH * 0.008
                );
                const lateralStep = Math.min(Math.abs(dx), Math.max(currentSpeed * deltaTime, catchUpStep));
                const stepSign = Math.sign(dx);
                const nextX = clamp(player.position.x + (stepSign * lateralStep), 6, LOGICAL_FIELD_WIDTH - 6);
                const nextY = player.position.y;
                const heading = { x: stepSign === 0 ? 0 : stepSign, y: 0 };

                updated = true;
                return {
                  ...player,
                  position: { x: nextX, y: nextY },
                  currentSpeed,
                  heading,
                  lastUpdateTime: time,
                };
              }

              const baseDirection = { x: dx / distance, y: dy / distance };
              const avoidance = inRunLateralOnlyWindow
                ? { x: 0, y: 0 }
                : passProtectors.reduce((acc, blocker) => {
                const blockerShared = { x: blocker.position.x, y: getSharedY(blocker) };
                const sepX = player.position.x - blockerShared.x;
                const sepY = player.position.y - blockerShared.y;
                const sepDist = Math.hypot(sepX, sepY);
                const collisionRadius = 22;
                if (sepDist <= 0 || sepDist >= collisionRadius) return acc;
                const weight = (collisionRadius - sepDist) / collisionRadius;
                return {
                  x: acc.x + ((sepX / sepDist) * weight * 1.9),
                  y: acc.y + ((sepY / sepDist) * weight * 1.9),
                };
              }, { x: 0, y: 0 });
              const lateralBiasMultiplier = (isSafetyPursuitEligible && !inRunLateralOnlyWindow) ? 1.38 : 1;
              const desiredDirection = normalizeVector({
                x: (baseDirection.x * lateralBiasMultiplier) + avoidance.x,
                y: baseDirection.y + avoidance.y,
              });
              const speedBoost = player.isBlitzing ? 1.05 : 1;
              const movementPlayer = {
                ...player,
                speed: rusherProfile.speed,
                acceleration: rusherProfile.acceleration,
              };
              const { heading } = applyTurnInertia({
                player: movementPlayer,
                desiredDirection,
                maxSpeed: rusherProfile.speed * dLineSpeedScale * speedBoost * pressureModifier,
                deltaTime,
                paused: false,
              });
              const currentSpeed = rusherProfile.speed * dLineSpeedScale * speedBoost * pressureModifier;

              const step = Math.min((currentSpeed/2.1) * deltaTime, distance);
              let nextX = clamp(player.position.x + heading.x * step, 6, LOGICAL_FIELD_WIDTH - 6);
              let nextY = clamp(player.position.y + heading.y * step, 6, LOGICAL_FIELD_HEIGHT - 6);

              if (!inRunLateralOnlyWindow) {
              passProtectors.forEach((blocker) => {
                const blockerShared = { x: blocker.position.x, y: getSharedY(blocker) };
                const dxNext = nextX - blockerShared.x;
                const dyNext = nextY - blockerShared.y;
                const distNext = Math.hypot(dxNext, dyNext);
                const minClearance = isRunPlay
                  ? (LOGICAL_FIELD_WIDTH * 0.024)
                  : (LOGICAL_FIELD_WIDTH * 0.018);
                if (distNext > 0 && distNext < minClearance) {
                  const pushScale = minClearance / distNext;
                  nextX = blockerShared.x + (dxNext * pushScale);
                  nextY = blockerShared.y + (dyNext * pushScale);
                }
              });
              }

              nextX = clamp(nextX, 6, LOGICAL_FIELD_WIDTH - 6);
              nextY = clamp(nextY, 6, LOGICAL_FIELD_HEIGHT - 6);
              if (inRunLateralOnlyWindow) {
                nextY = player.position.y;
              }
              if (!inRunLateralOnlyWindow && isRunPlay && engagedBlockers.length > 0) {
                const losSharedY = LOGICAL_FIELD_HEIGHT / 2;
                const elapsedSinceSnapMs = time - playStartTimeMs;
                const contestValue = activeContest ?? 0;
                const defenderClearlyWinning = contestValue <= -8;
                const inTrenchLockWindow = elapsedSinceSnapMs <= 1200;
                if (inTrenchLockWindow || !defenderClearlyWinning) {
                  nextY = Math.min(nextY, losSharedY - 2.5);
                }
              }
              updated = true;
              return {
                ...player,
                position: {
                  x: nextX,
                  y: nextY,
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
          }

          if (player.zone === 'man' && player.assignedOffensiveId) {
            const target = prevPlayers.find((offensivePlayer) => offensivePlayer.id === player.assignedOffensiveId);
            if (!target) return player;
            const targetY = toDefenseSpaceY(target);

            if (player.pauseUntil && time < player.pauseUntil) {
              return player;
            }

            if (player.pauseUntil && time >= player.pauseUntil) {
              player = { ...player, pauseUntil: null };
            }

            const lastTime = player.lastUpdateTime || time;
            const deltaTime = (time - lastTime) / 1000;
            const levelBuffer = Math.max(6, LOGICAL_FIELD_HEIGHT * 0.008);
            const receiverHasCut = recentCutByReceiverId.get(target.id) === true;
            const receiverIsLevelOrPast = targetY <= (player.position.y + levelBuffer);

            const pursuitState = pursuitStateRef.current.get(player.id) || {
              mode: 'none',
              pendingMode: null,
              readyAt: null,
              pendingDelayMs: 0,
              followLiveReceiver: false,
              justActivated: false,
              activatedAt: null,
            };

            if (receiverHasCut && !pursuitState.followLiveReceiver) {
              pursuitState.followLiveReceiver = true;
            }

            const shouldFollowLiveReceiver = pursuitState.followLiveReceiver;
            const routeType = target.route;
            const isGoOrFade = routeType === 'go' || routeType === 'fade';
            const activationReached = isGoOrFade
              ? receiverIsLevelOrPast
              : (receiverIsLevelOrPast || shouldFollowLiveReceiver);
            const desiredMode = activationReached ? 'direct' : 'none';

            if (desiredMode !== pursuitState.mode && desiredMode !== pursuitState.pendingMode) {
              if (desiredMode === 'none') {
                pursuitState.pendingMode = null;
                pursuitState.readyAt = null;
                pursuitState.pendingDelayMs = 0;
              } else {
                const reactionDelayMs = 0;
                pursuitState.pendingMode = desiredMode;
                pursuitState.readyAt = time + reactionDelayMs;
                pursuitState.pendingDelayMs = reactionDelayMs;
              }
              pursuitStateRef.current.set(player.id, pursuitState);
            }

            if (pursuitState.pendingMode && pursuitState.readyAt !== null && time >= pursuitState.readyAt) {
              pursuitState.mode = pursuitState.pendingMode;
              pursuitState.pendingMode = null;
              pursuitState.readyAt = null;
              pursuitState.pendingDelayMs = 0;
              pursuitState.justActivated = true;
              pursuitState.activatedAt = time;
              pursuitStateRef.current.set(player.id, pursuitState);
            }

            if (pursuitState.mode === 'none' || (pursuitState.pendingMode && pursuitState.readyAt !== null && time < pursuitState.readyAt)) {
              const decelRate = getAccelerationRate(player);
              const idleSpeed = Math.max((player.currentSpeed ?? 0) - (decelRate * deltaTime), 0);
              return {
                ...player,
                currentSpeed: idleSpeed,
                lastUpdateTime: idleSpeed > 0.05 ? time : null,
              };
            }

            const waypointTarget = target.moveTarget && typeof target.moveTarget.x === 'number' && typeof target.moveTarget.y === 'number'
              ? { x: target.moveTarget.x, y: toDefenseSpaceY({ ...target, position: target.moveTarget }) }
              : { x: target.position.x, y: targetY };
            const chaseTarget = (shouldFollowLiveReceiver || pursuitState.mode !== 'waypoint')
              ? { x: target.position.x, y: targetY }
              : waypointTarget;

            const dx = chaseTarget.x - player.position.x;
            const dy = chaseTarget.y - player.position.y;
            const distance = Math.hypot(dx, dy);

            if (distance > 0.1) {
              const topSpeed = getUnifiedMaxSpeed(player) * SKILL_SPEED_SCALE;
              const isDb = player.role === 'CB' || player.role === 'S' || player.role === 'DB';
              const justActivated = pursuitState.justActivated === true
                || (typeof pursuitState.activatedAt === 'number' && (time - pursuitState.activatedAt) <= 260);
              const timeSinceActivation = typeof pursuitState.activatedAt === 'number'
                ? (time - pursuitState.activatedAt)
                : Infinity;
              const cutPenalty = (receiverHasCut && isDb)
                ? ((player.reactionTime ?? 75) / 4)
                : 0;
              const adjustedTopSpeed = Math.max(topSpeed - cutPenalty, topSpeed * 0.45);
              const inCutRecoveryWindow = isDb && receiverHasCut && timeSinceActivation <= 700;
              const recoveryTopSpeedMultiplier = inCutRecoveryWindow ? 0.9 : 1;
              const cappedTopSpeed = adjustedTopSpeed * recoveryTopSpeedMultiplier;
              const desiredDirection = { x: dx / distance, y: dy / distance };
              const accelerationRate = getUnifiedAccelerationRate(player)
                * (inCutRecoveryWindow ? 0.85 : 1);
              const hasTrackingHistory = Boolean(player.lastUpdateTime);
              const launchFloor = hasTrackingHistory ? 0 : (cappedTopSpeed * 0.55);
              const baseSpeed = player.currentSpeed ?? 0;
              const acceleratedSpeed = baseSpeed + (accelerationRate * deltaTime);
              const currentSpeed = Math.min(cappedTopSpeed, Math.max(launchFloor, acceleratedSpeed));
              const heading = desiredDirection;
              const step = Math.min(currentSpeed * deltaTime, distance);

              if (pursuitState.justActivated) {
                pursuitState.justActivated = false;
                pursuitStateRef.current.set(player.id, pursuitState);
              }

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
            const topSpeed = getUnifiedMaxSpeed(player);
            const isDb = player.role === 'CB' || player.role === 'S' || player.role === 'LB';
            const zoneAccelerationMultiplier = isDb ? 1.525 : 2.05;
            const accelerationRate = getUnifiedAccelerationRate(player) * zoneAccelerationMultiplier;
            const hasTrackingHistory = Boolean(player.lastUpdateTime);
            const launchFloor = hasTrackingHistory ? 0 : (topSpeed * 0.56);
            const baseSpeed = Math.max(player.currentSpeed ?? 0, launchFloor);
            const currentSpeed = Math.min(topSpeed, baseSpeed + (accelerationRate * deltaTime));
            const heading = desiredDirection;
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

        if (routeStarted && outcome === "" && isRunPlay) {
          const resolveRunOutcome = (runCarrierNow, runOutcome, tag, tacklerId = 'n/a') => {
            const runState = runPlayStateRef.current;
            if (runState.tackledLogged || pendingRunOutcomeRef.current) {
              return false;
            }
            runState.tackledLogged = true;
            runPlayStateRef.current = runState;
            const oneYardPixels = LOGICAL_FIELD_HEIGHT / 40;
            const runCarrierSharedNow = { x: runCarrierNow.position.x, y: runCarrierNow.position.y + (LOGICAL_FIELD_HEIGHT / 2) };
            const lineOfScrimmageSharedY = LOGICAL_FIELD_HEIGHT / 2;
            const yardsGained = Math.round((lineOfScrimmageSharedY - runCarrierSharedNow.y) / oneYardPixels);
            outcomeTriggered = true;
            triggeredOutcome = runOutcome;
            triggeredCompletedYards = yardsGained;
            pendingRunOutcomeRef.current = {
              outcome: runOutcome,
              completedYards: yardsGained,
              tag,
              tacklerId,
            };
            return true;
          };

          const runCarrierNow = newPlayers.find((player) => player.isOffense && player.route === 'run' && player.role !== 'qb' && player.role !== 'offensive-lineman' && player.position);
          if (runCarrierNow) {
            const runCarrierSharedNow = { x: runCarrierNow.position.x, y: runCarrierNow.position.y + (LOGICAL_FIELD_HEIGHT / 2) };
            if (runCarrierSharedNow.y <= 1) {
              resolveRunOutcome(runCarrierNow, 'Touchdown!', 'run-carrier-top-boundary');
            }

            if (!outcomeTriggered) {
              const runState = runPlayStateRef.current;
              const runStartTimeMs = typeof runState.startTimeMs === 'number' ? runState.startTimeMs : null;
              const elapsedSinceSnapMs = runStartTimeMs !== null ? (time - runStartTimeMs) : Infinity;
              const startedFromX = typeof runState.startSharedX === 'number' ? runState.startSharedX : runCarrierSharedNow.x;
              const startedFromY = typeof runState.startSharedY === 'number' ? runState.startSharedY : runCarrierSharedNow.y;
              const snapDisplacement = Math.hypot(runCarrierSharedNow.x - startedFromX, runCarrierSharedNow.y - startedFromY);
              const tackleChecksEnabled = elapsedSinceSnapMs >= 180 || snapDisplacement >= 2.25;
              if (tackleChecksEnabled) {
              const contactDistance = clamp(LOGICAL_FIELD_WIDTH * 0.016, 10, 13);
              const intersectingRusherNow = newPlayers.find((player) => {
                if (player.isOffense || !player.position) {
                  return false;
                }
                const dx = player.position.x - runCarrierSharedNow.x;
                const dy = player.position.y - runCarrierSharedNow.y;
                return Math.hypot(dx, dy) <= contactDistance;
              });

              if (intersectingRusherNow) {
                const lineOfScrimmageSharedY = LOGICAL_FIELD_HEIGHT / 2;
                const yardsGained = Math.round((lineOfScrimmageSharedY - runCarrierSharedNow.y) / (LOGICAL_FIELD_HEIGHT / 40));
                const isRacCarrier = runCarrierNow.hasCaughtBall === true && typeof runCarrierNow.catchSharedY === 'number';
                const yacYards = isRacCarrier
                  ? Math.round((runCarrierNow.catchSharedY - runCarrierSharedNow.y) / (LOGICAL_FIELD_HEIGHT / 40))
                  : 0;
                const passYardsBeforeCatch = isRacCarrier
                  ? (runCarrierNow.passYardsBeforeCatch ?? 0)
                  : 0;
                const totalCatchYards = passYardsBeforeCatch + yacYards;
                const runOutcome = yardsGained > (100 - yardLine)
                  ? 'Touchdown!'
                  : (isRacCarrier ? `${totalCatchYards} yard catch` : `${yardsGained} yard run`);
                resolveRunOutcome(runCarrierNow, runOutcome, 'defender-touch', intersectingRusherNow.id);
              }
              }
            }
          }

          if (outcomeTriggered) {
            return updated ? newPlayers : prevPlayers;
          }
        }

        // Keep OL from occupying the same space when they pass-set or engage.
        const adjustedPlayers = [...newPlayers];
        if (routeStarted) {
          const offensiveLineIndexes = adjustedPlayers
            .map((player, index) => ({ player, index }))
            .filter(({ player }) => player.isOffense && player.position && (player.role === 'offensive-lineman' || supportBlockers.some((blocker) => blocker.id === player.id)))
            .map(({ index }) => index);
          const olMinSpacing = 12;

          for (let i = 0; i < offensiveLineIndexes.length; i += 1) {
            for (let j = i + 1; j < offensiveLineIndexes.length; j += 1) {
              const indexA = offensiveLineIndexes[i];
              const indexB = offensiveLineIndexes[j];
              const playerA = adjustedPlayers[indexA];
              const playerB = adjustedPlayers[indexB];
              if (!playerA?.position || !playerB?.position) continue;

              const dx = playerA.position.x - playerB.position.x;
              const dy = playerA.position.y - playerB.position.y;
              const distance = Math.hypot(dx, dy);
              if (distance <= 0 || distance >= olMinSpacing) continue;

              const rawPush = (olMinSpacing - distance) / 2;
              const push = Math.min(rawPush, LOGICAL_FIELD_WIDTH * 0.0011);
              const ux = dx / distance;
              const uy = dy / distance;

              const nextAX = clamp(playerA.position.x + (ux * push), LOGICAL_FIELD_WIDTH * 0.008, LOGICAL_FIELD_WIDTH - LOGICAL_FIELD_WIDTH * 0.008);
              const nextAY = clamp(playerA.position.y + (uy * push), LOGICAL_FIELD_HEIGHT * 0.006, (LOGICAL_FIELD_HEIGHT / 2) - LOGICAL_FIELD_HEIGHT * 0.002);
              const nextBX = clamp(playerB.position.x - (ux * push), LOGICAL_FIELD_WIDTH * 0.008, LOGICAL_FIELD_WIDTH - LOGICAL_FIELD_WIDTH * 0.008);
              const nextBY = clamp(playerB.position.y - (uy * push), LOGICAL_FIELD_HEIGHT * 0.006, (LOGICAL_FIELD_HEIGHT / 2) - LOGICAL_FIELD_HEIGHT * 0.002);

              adjustedPlayers[indexA] = { ...playerA, position: { x: nextAX, y: nextAY } };
              adjustedPlayers[indexB] = { ...playerB, position: { x: nextBX, y: nextBY } };
              updated = true;
            }
          }
        }

        if (updated) {
          adjustedPlayers.forEach((player, index) => {
            const previousPlayer = prevPlayers[index];
            if (
              previousPlayer &&
              (previousPlayer.position.x !== player.position.x || previousPlayer.position.y !== player.position.y)
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

        if (routeStarted && outcome === "") {
          const qbNow = adjustedPlayers.find((player) => player.isOffense && player.role === 'qb' && player.position);
          if (qbNow && !isRunPlay) {
            const qbSharedNow = { x: qbNow.position.x, y: qbNow.position.y + (LOGICAL_FIELD_HEIGHT / 2) };
            const playerRadius = clamp(LOGICAL_FIELD_WIDTH * 0.0208, 9, 16);
            const sackContactDistance = playerRadius * 2;
            const intersectingRusher = adjustedPlayers.find((player) => {
              if (player.isOffense || !player.position || (player.role !== 'defensive-lineman' && !player.isBlitzing)) {
                return false;
              }
              const dx = player.position.x - qbSharedNow.x;
              const dy = player.position.y - qbSharedNow.y;
              return Math.hypot(dx, dy) <= sackContactDistance;
            });

            if (intersectingRusher) {
              if (!sackDebugRef.current.sackedLogged) {
                sackDebugRef.current.sackedLogged = true;
                outcomeTriggered = true;
                triggeredOutcome = 'Sacked';
                triggeredCompletedYards = 0;
              }
            }
          }
        }

        return updated ? adjustedPlayers : prevPlayers;
      });

      if (outcomeTriggered && routeStarted && outcome === "") {
        if (!sackDebugRef.current.sackedLogged) {
          sackDebugRef.current.sackedLogged = true;
        }
        setSackTimeRemaining(0);
        setRouteStarted(false);
        setCompletedYards(triggeredCompletedYards);
        setOutcome(triggeredOutcome);
        socket.emit('route_started', { routeStarted: false, roomId });
        socket.emit('play_outcome', { outcome: triggeredOutcome, completedYards: triggeredCompletedYards, roomId });
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      pursuitStateRef.current = new Map();
      receiverMotionRef.current = new Map();
      protectionAssignmentsRef.current = new Map();
      trenchAnchorsRef.current = new Map();
      safetyPursuitDebugRef.current = {
        lastLogByPlayerId: new Map(),
        delayEligibleByPlayerId: new Map(),
      };
      sackDebugRef.current = { sackedLogged: false };
      runPlayStateRef.current = { runnerId: null, startSharedX: null, startSharedY: null, startTimeMs: null, tackledLogged: false };
      pendingRunOutcomeRef.current = null;
      runPursuitPredictionRef.current = {
        lastByRunnerId: new Map(),
      };
      cancelAnimationFrame(animationFrameId);
    };
  }, [dLineRating, defensiveLineProfiles, isRunPlay, oLineRating, offensiveLineProfiles, outcome, roomId, routeStarted, setCompletedYards, setOutcome, setPlayers, setRouteStarted, setSackTimeRemaining, socket, toDefenseSpaceY, yardLine]);

  return (
    <div className="half top-half"
      onDragOver={(e)=>handleDragOver(e)}
      onDrop={(e) => handleDrop(e, fieldSize?.height)}
    >
      {!isOffense && defensiveMessage && (
        <div className="defense-alert">{defensiveMessage}</div>
      )}
      {safePlayers.filter(p => p.isOffense === false).map((player) => (
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
              )
            }

            {/* Draw line to assigned offensive player in man coverage */}
            {!isOffense && player.zone === 'man' &&
            outcome === "" &&
            !routeStarted &&
            player.assignedOffensiveId &&
            (() => {
              const target = safePlayers.find(p => p.id === player.assignedOffensiveId);

              if (!target || !target.position || !player.position) return null;
              const targetY = toDefenseSpaceY(target);

              return (
                <svg className="man-svg">
                  <line
                    x1={toScreenX(player.position.x)}
                    y1={toScreenY(player.position.y)}
                    x2={toScreenX(target.position.x)}
                    y2={toScreenY(targetY)}
                    stroke="gray"
                    strokeWidth="5"
                  />
                </svg>
              );
            })()}

            {!isOffense && player.isBlitzing && outcome === "" && !routeStarted && player.position && (() => {
              const qbTarget = safePlayers.find((p) => p.isOffense && p.role === 'qb' && p.position);
              if (!qbTarget?.position) {
                return null;
              }
              const targetY = toDefenseSpaceY(qbTarget);
              const arrowT = 0.5;
              const arrowEndX = player.position.x + ((qbTarget.position.x - player.position.x) * arrowT);
              const arrowEndY = player.position.y + ((targetY - player.position.y * 1.3) * arrowT);

              return (
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
                    d={`M ${toScreenX(player.position.x)} ${toScreenY(player.position.y)} L ${toScreenX(arrowEndX)} ${toScreenY(arrowEndY)}`}
                    stroke="red"
                    strokeWidth="5"
                    fill="none"
                    markerEnd="url(#arrow)"
                  />
                </svg>
              );
            })()}


            {/* In Zone coverage Draw line to zoneCircle and circle itself */}
            {!isOffense && player.zoneCircle && (
            <svg className='zone-svg'>
                <line
                x1={toScreenX(player.position.x)}
                y1={toScreenY(player.position.y)}
                x2={toScreenX(player.zoneCircle.x)}
                y2={toScreenY(player.zoneCircle.y)}
                stroke="blue"
                strokeWidth="2"
                />
                <ellipse
                cx={toScreenX(player.zoneCircle.x)}
                cy={toScreenY(player.zoneCircle.y)}
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