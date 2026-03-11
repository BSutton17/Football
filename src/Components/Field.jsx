import React, { useRef, useEffect, useCallback } from 'react';
import '../App.css';
import OffensiveField from './OffensiveField';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import DefensiveField from './DefensiveField';
import PlayerInventory from './PlayerInventory';
import FieldYardLines from './FieldYardLines';
import { calculateRunPlayResult } from '../Utils/runPlay';
import { calculateAllOpenness, getLastOpennessDebug } from '../Utils/calculator';

// --- LOGICAL FIELD SIZE CONSTANTS ---
export const LOGICAL_FIELD_WIDTH = 800;
export const LOGICAL_FIELD_HEIGHT = 600;

function Field({ socket, room }) {
  const {
    players,
    setPlayers,
    setSelectedPlayerId,
    draggingId,
    fieldRef,
    fieldSize = { width: 0, height: 0, area: 0 },
    setFieldSize = () => {},
    routeStarted,
    setRouteStarted,
    setRouteProgress,
    inventory = { offense: [], defense: [] },
    setInventory,
    outcome, 
    down, 
    distance,
    yardLine,
    roomId, 
    selectedPlayerId,
    isOffense, 
    setOutcome,
    setDistance,
    setDown,
    setThrownBallLine,
    setCompletedYards, 
    setPreSnapPlayers,
    preSnapPlayers,
    score,
    otherScore,
    gameClockRef,
    gameIntervalRef,
    gameClock, 
    setGameClock,
    quarter, 
    setQuarter,
    setButtonEnabled, 
    setSetButtonEnabled = () => {},
    postSetCountdown, 
    setPostSetCountdown = () => {},
    isSetClicked, 
    setIsSetClicked = () => {},
    isGoalToGo, 
    setIsRunPlay,
    setActivePlayId
  } = useAppContext();

  const { handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd } = useHandlerContext();
  const localFieldRef = useRef(null);
  const activeFieldRef = fieldRef ?? localFieldRef;
  const localGameClockRef = useRef(gameClock ?? 300000);
  const localGameIntervalRef = useRef(null);
  const activeGameClockRef = gameClockRef ?? localGameClockRef;
  const activeGameIntervalRef = gameIntervalRef ?? localGameIntervalRef;
  // Keep gameplay math in logical units and render in screen units.
  const logicalOneYardInPixels = LOGICAL_FIELD_HEIGHT / 40;
  const renderOneYardInPixels = (fieldSize?.height || LOGICAL_FIELD_HEIGHT) / 40;
  const lineOfScrimmageY = LOGICAL_FIELD_HEIGHT / 2;

  useEffect(() => {
    activeGameClockRef.current = gameClock;
  }, [activeGameClockRef, gameClock]);

  useEffect(() => {
    setSetButtonEnabled(false);
    setIsSetClicked(false);
    setPostSetCountdown(null);
    const delay = down === 1 ? 10000 : 0; // ms
    const timeout = setTimeout(() => {
      setSetButtonEnabled(true);
    }, delay);

    return () => clearTimeout(timeout);
  }, [down, yardLine, setIsSetClicked, setPostSetCountdown, setSetButtonEnabled]);

  useEffect(() => {
    if (!isSetClicked || postSetCountdown === null) return;

    const interval = setInterval(() => {
      setPostSetCountdown(prev => {
        if (prev <= 1000) {
          clearInterval(interval);
          return null;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSetClicked, postSetCountdown, setPostSetCountdown]);

  const startClock = useCallback(() => {
    if (!activeGameIntervalRef.current) {
      activeGameIntervalRef.current = setInterval(() => {
        activeGameClockRef.current -= 1000;
        setGameClock(activeGameClockRef.current);

        if (activeGameClockRef.current <= 0) {
          clearInterval(activeGameIntervalRef.current);
          activeGameIntervalRef.current = null;

          setQuarter((prev) => {
            if (prev < 4) {
              setGameClock(300000);
              activeGameClockRef.current = 300000;
              return prev + 1;
            } else {
              setOutcome("Game Over");
              return prev;
            }
          });
        }
      }, 1000);
    }
  }, [activeGameClockRef, activeGameIntervalRef, setGameClock, setOutcome, setQuarter]);

  // Show offense inventory if player is currently on offense, else defense inventory
  const inventoryToShow = isOffense ? (inventory?.offense ?? []) : (inventory?.defense ?? []);
  const inventoryType = isOffense ? "offense" : "defense";

  // Calculate offsets based on field size (for UI only, not game logic)
  const aspectRatio = fieldSize.width / fieldSize.height;
  let offsetX, offsetY;
  if (aspectRatio < 1) {
    offsetX = fieldSize.width / 7;
    offsetY = fieldSize.height / 14;
  } else {
    offsetX = fieldSize.width / 15;
    offsetY = fieldSize.height / 10;
  }

  const handleSetClick = () => {
    const scrollSnapshot = { x: window.scrollX, y: window.scrollY };
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsSetClicked(true);
    setSetButtonEnabled(false);
    setPostSetCountdown(10000);
    socket.emit("offense_set", { roomId });

    requestAnimationFrame(() => {
      window.scrollTo(scrollSnapshot.x, scrollSnapshot.y);
    });
    setTimeout(() => {
      window.scrollTo(scrollSnapshot.x, scrollSnapshot.y);
    }, 50);
    setTimeout(() => {
      window.scrollTo(scrollSnapshot.x, scrollSnapshot.y);
    }, 300);

    if (activeGameIntervalRef.current) {
      clearInterval(activeGameIntervalRef.current);
      activeGameIntervalRef.current = null;
      socket.emit("stop_clock", { roomId });
      setTimeout(() => {
        startClock();
      }, 10000);
    }
  };

    
  useEffect(() => {
    if (!socket) return;
    
    const handleStopClock = () => {
    if (activeGameIntervalRef.current) {
      clearInterval(activeGameIntervalRef.current);
      activeGameIntervalRef.current = null;
      setTimeout(()=>{
        startClock()
      }, 10000)
      }
  };
    
  socket.off("stop_clock", handleStopClock);
  socket.on("stop_clock", handleStopClock);
    
  return () => socket.off("stop_clock", handleStopClock);
  }, [activeGameIntervalRef, socket, startClock]);

  const playSequenceRef = useRef(0);
  const playStartTimeRef = useRef(null);
  const playMotionStatsRef = useRef(new Map());
  const playPositionHistoryRef = useRef([]);
  const endOfPlayLoggedOutcomeRef = useRef(null);

  // Only use fieldSize for rendering and input conversion
  useEffect(() => {
    const updateFieldSize = () => {
      if (activeFieldRef.current) {
        const rect = activeFieldRef.current.getBoundingClientRect();
        if (typeof setFieldSize === 'function') {
          setFieldSize({ width: rect.width, height: rect.height, area: rect.width * rect.height });
        }
      }
    };
    updateFieldSize();
    window.addEventListener('resize', updateFieldSize);
    return () => window.removeEventListener('resize', updateFieldSize);
  }, [activeFieldRef, setFieldSize]);

  useEffect(() => {
    if (draggingId !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingId, handleMouseMove, handleMouseUp]);

  const startRoute = () => {
    const rect = activeFieldRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const nextPlayId = `${roomId || 'local'}-play-${playSequenceRef.current + 1}`;
    playSequenceRef.current += 1;
    setActivePlayId(nextPlayId);

    // Save local pre-snap state in logical coordinates
    setPreSnapPlayers(players.map(p => ({
      ...p,
      position: { ...p.position },
      route: null
    })));

    // Emit logical positions to others
    socket.emit("pre_snap_players", {
      players: players.map(p => ({
        ...p,
        position: { ...p.position },
        zoneCircle: null,
        route: null
      })),
      room: roomId
    });

  const runRB = players.find(p => p.role === "RB" && p.route === "run");
  setIsRunPlay(runRB)
  const playStartNow = performance.now();
  playStartTimeRef.current = playStartNow;
  playPositionHistoryRef.current = [];
  endOfPlayLoggedOutcomeRef.current = null;
  // Reset per-play motion stats so end-of-play logging compares like-for-like.
  playMotionStatsRef.current = new Map();
if (runRB) {
  const runPlayResult = calculateRunPlayResult({
    players,
    runRB,
    oneYardInPixels: logicalOneYardInPixels,
    lineOfScrimmageY,
    yardLine,
    viewportWidth: LOGICAL_FIELD_WIDTH,
  });

  const yardsGained = runPlayResult.yardsGained;
  setCompletedYards(yardsGained); 

  setTimeout(() => {
      setOutcome(runPlayResult.outcome);
    }, runPlayResult.delayMs);
  }
    setThrownBallLine(null);
    setRouteStarted(true);

    const interval = setInterval(() => {
      setRouteProgress((prev) => {
        const updated = { ...prev };
        let done = true;

        players.forEach((player) => {
          if (!player.route) return;

          const current = prev[player.id] ?? 0;
          const duration = player.routeDuration ?? 3000; // fallback to 3 seconds
          const increment = 100 / (duration / 100); // progress per 100ms

          if (current < 100) {
            done = false;
            updated[player.id] = Math.min(current + increment, 100); // cap at 100
          } else {
            updated[player.id] = 100;
          }
        });

        if (done) clearInterval(interval);
        return updated;
      });
    }, 100);

    socket.emit("route_started", { routeStarted: true, roomId });
    // Start or resume game clock
    startClock()
  }

    const outcomeRef = useRef(outcome);
    
    // Keep the ref updated with the latest outcome
    useEffect(() => {
      outcomeRef.current = outcome;
    }, [outcome]);

  const formatDown = (down)=> {
  switch (down) {
    case 1: return "1st";
    case 2: return "2nd";
    case 3: return "3rd";
    case 4: return "4th";
    default: return "4th";
      }
  }


  const handleEndOfPlay = useCallback(() => {
    const endTime = performance.now();
    const elapsedMs = playStartTimeRef.current ? (endTime - playStartTimeRef.current) : 0;
    const elapsedSeconds = elapsedMs >= 250 ? (elapsedMs / 1000) : null;

    const getPlayerSnapshot = (id) => preSnapPlayers?.find((p) => p.id === id);
    const isValidPos = (pos) => pos && typeof pos.x === 'number' && typeof pos.y === 'number';
    const isDb = (player) => player?.role === 'CB' || player?.role === 'S' || player?.role === 'DB';
    const getMovementRelation = ({ wrStart, wrEnd, dbEnd }) => {
      if (!isValidPos(wrStart) || !isValidPos(wrEnd) || !isValidPos(dbEnd)) return 'even';
      const wrMove = { x: wrEnd.x - wrStart.x, y: wrEnd.y - wrStart.y };
      const wrTravel = Math.hypot(wrMove.x, wrMove.y);
      if (wrTravel < 0.05) return 'even';

      const toDb = { x: dbEnd.x - wrEnd.x, y: dbEnd.y - wrEnd.y };
      const relation = (wrMove.x * toDb.x) + (wrMove.y * toDb.y);
      if (relation > 0.35) return 'toward';
      if (relation < -0.35) return 'away';
      return 'even';
    };

    const history = playPositionHistoryRef.current;
    const targetSnapshotTime = endTime - 500;
    let snapshotEntry = null;
    for (let index = 0; index < history.length; index += 1) {
      const entry = history[index];
      if (entry.time <= targetSnapshotTime) {
        snapshotEntry = entry;
      } else {
        break;
      }
    }
    if (!snapshotEntry && history.length > 0) {
      snapshotEntry = history[history.length - 1];
    }

    const playersForLog = Array.isArray(snapshotEntry?.players) && snapshotEntry.players.length > 0
      ? snapshotEntry.players
      : players;

    if (Array.isArray(playersForLog)) {
      const offensivePlayers = playersForLog.filter((player) => player?.isOffense === true);
      const defensivePlayers = playersForLog.filter((player) => player?.isOffense === false);
      const opennessScores = calculateAllOpenness(
        offensivePlayers,
        defensivePlayers,
        { width: LOGICAL_FIELD_WIDTH, height: LOGICAL_FIELD_HEIGHT }
      );

      const defensiveSkillPlayers = defensivePlayers.filter((player) => isDb(player) && isValidPos(player?.position));

      playersForLog.forEach((player) => {
        if (player?.role !== 'WR' || !isValidPos(player?.position)) return;

        const wrStart = getPlayerSnapshot(player.id)?.position;
        const assignedDb = defensiveSkillPlayers.find((defender) => defender.assignedOffensiveId === player.id)
          ?? defensiveSkillPlayers.reduce((closest, defender) => {
            if (!closest) return defender;
            const currentDist = Math.hypot(defender.position.x - player.position.x, defender.position.y - player.position.y);
            const closestDist = Math.hypot(closest.position.x - player.position.x, closest.position.y - player.position.y);
            return currentDist < closestDist ? defender : closest;
          }, null);

        const openness = opennessScores[player.id];
        const opennessDebug = getLastOpennessDebug(player.id);

        if (!assignedDb || !isValidPos(assignedDb.position)) {
          console.log(
            `[OPENNESS LOG] wr=${player.id} route=${player.route ?? 'n/a'} wrFinal=(${player.position.x.toFixed(1)},${player.position.y.toFixed(1)}) assignedDb=n/a movementVsDb=even openness=${typeof openness === 'number' ? openness.toFixed(2) : 'n/a'}`
          );
          return;
        }

        const dbStart = getPlayerSnapshot(assignedDb.id)?.position;
        const startDistance = isValidPos(wrStart) && isValidPos(dbStart)
          ? Math.hypot(dbStart.x - wrStart.x, dbStart.y - wrStart.y)
          : null;
        const endDistance = Math.hypot(assignedDb.position.x - player.position.x, assignedDb.position.y - player.position.y);
        const movementVsDb = getMovementRelation({ wrStart, wrEnd: player.position, dbEnd: assignedDb.position });

        console.log(
          `[OPENNESS LOG] sampleMsBeforeEnd=${snapshotEntry ? Math.max(0, Math.round(endTime - snapshotEntry.time)) : 0} wr=${player.id} route=${player.route ?? 'n/a'} db=${assignedDb.id} wrFinal=(${player.position.x.toFixed(1)},${player.position.y.toFixed(1)}) dbFinal=(${assignedDb.position.x.toFixed(1)},${assignedDb.position.y.toFixed(1)}) movementVsDb=${movementVsDb} startDist=${startDistance !== null ? startDistance.toFixed(2) : 'n/a'} endDist=${endDistance.toFixed(2)} openness=${typeof openness === 'number' ? openness.toFixed(2) : 'n/a'} calc=${opennessDebug ? `base=${opennessDebug.baseScore.toFixed(2)} bucket=${opennessDebug.distanceBucket} leverage=${opennessDebug.leverageAdjustment.toFixed(2)} speed=${opennessDebug.speedAdjustment.toFixed(2)} help=${opennessDebug.helpAdjustment.toFixed(2)} lane=${opennessDebug.laneAdjustment.toFixed(2)} raw=${opennessDebug.rawScore.toFixed(2)} final=${opennessDebug.finalScore.toFixed(2)} primary=${opennessDebug.primaryDefenderId ?? 'n/a'} primaryDist=${opennessDebug.primaryDistance?.toFixed?.(2) ?? 'n/a'} helper=${opennessDebug.helperDefenderId ?? 'n/a'} helperDist=${typeof opennessDebug.helperDistance === 'number' ? opennessDebug.helperDistance.toFixed(2) : 'n/a'} trailing=${opennessDebug.trailingAmount.toFixed(2)} lateral=${opennessDebug.lateralOffset.toFixed(2)} leverageWin=${opennessDebug.leverageWin} helpCount=${opennessDebug.immediateHelpCount}` : 'n/a'}`
        );
      });
    }

    playStartTimeRef.current = null;
    playMotionStatsRef.current = new Map();
    playPositionHistoryRef.current = [];

    // STOP CLOCK unless it's a run, sack, or catch
    const shouldStopClock = !(
      outcome === "Sacked" ||
      outcome.endsWith("yard run") ||
      outcome.endsWith("yard catch")
    );

    if (activeGameIntervalRef.current && shouldStopClock) {
      clearInterval(activeGameIntervalRef.current);
      activeGameIntervalRef.current = null;
      socket.emit("stop_clock", { roomId });
    }

  }, [activeGameIntervalRef, outcome, roomId, socket, players, preSnapPlayers]);

  useEffect(() => {
    if (!routeStarted || !Array.isArray(players)) {
      return;
    }

    const now = performance.now();
    const sampledPlayers = players
      .filter((player) => player?.position && typeof player.position.x === 'number' && typeof player.position.y === 'number')
      .map((player) => ({
        id: player.id,
        role: player.role,
        route: player.route,
        isOffense: player.isOffense,
        assignedOffensiveId: player.assignedOffensiveId,
        speed: player.speed,
        position: { x: player.position.x, y: player.position.y },
      }));
    playPositionHistoryRef.current.push({ time: now, players: sampledPlayers });
    playPositionHistoryRef.current = playPositionHistoryRef.current.filter((entry) => (now - entry.time) <= 8000);

    const statsMap = playMotionStatsRef.current;

    players.forEach((p) => {
      const isTracked = p?.role === 'WR' || p?.role === 'CB' || p?.role === 'S' || p?.role === 'DB';
      const hasPos = p?.position && typeof p.position.x === 'number' && typeof p.position.y === 'number';
      if (!isTracked || !hasPos) return;

      const existing = statsMap.get(p.id);
      if (!existing) {
        statsMap.set(p.id, {
          lastPosition: { x: p.position.x, y: p.position.y },
          pathDistance: 0,
          firstMoveTimeMs: null,
        });
        return;
      }

      const segDx = p.position.x - existing.lastPosition.x;
      const segDy = p.position.y - existing.lastPosition.y;
      const segmentDistance = Math.hypot(segDx, segDy);

      if (segmentDistance > 0.05) {
        existing.pathDistance += segmentDistance;
        if (existing.firstMoveTimeMs === null) {
          existing.firstMoveTimeMs = now;
        }
      }

      existing.lastPosition = { x: p.position.x, y: p.position.y };
      statsMap.set(p.id, existing);
    });
  }, [players, routeStarted]);

  
  useEffect(() => {
    if (!outcome) {
      endOfPlayLoggedOutcomeRef.current = null;
      return;
    }

    if (endOfPlayLoggedOutcomeRef.current === outcome) {
      return;
    }

    if (outcome === "Game Over") {
      return;
    }

    endOfPlayLoggedOutcomeRef.current = outcome;
    if (outcome === "Touchdown!") {
      setDown(1);
      setDistance(10);
    }
    handleEndOfPlay();

  }, [outcome, handleEndOfPlay, setDistance, setDown]);

  function formatDistance(distance) {
    return isGoalToGo ? "goal" : distance;
  }

  const displayYardLine = (yardLine, isOffense) => {
    if (isOffense) {
      return yardLine <= 50 ? `< ${yardLine}` : `> ${50 - (yardLine - 50)}`;
    } else {
      return yardLine <= 50 ? `> ${yardLine}` : `< ${50 + (50 - yardLine)}`;
    }
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
  return () => {
    if (activeGameIntervalRef.current) {
      clearInterval(activeGameIntervalRef.current);
    }
  };
  }, [activeGameIntervalRef]);

  return (
    <>
    <div className="game-header">
      <div className="scoreboard-box">
        <span className="yard-line">{displayYardLine(yardLine, isOffense)}</span>
        <div className="down-distance">{formatDown(down)} & {formatDistance(distance)}</div>
      </div>
      <div className='score'>
        <div>{score} - {otherScore}</div>
      </div>
      <div className="clock-box">
        <span className="quarter">Q{quarter}</span>
        <span className="clock-time">{formatTime(gameClock)}</span>
      </div>
    </div>
    <div className='result'>
    <h1 className="scoreboard-outcome">{outcome}</h1>
    </div>
    <div
      className="field"
      ref={activeFieldRef}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >  
    {/* Tick marks */}
      <FieldYardLines oneYardInPixels={renderOneYardInPixels} yardLine={yardLine} />
      <DefensiveField 
        offsetX={offsetX}
        offsetY={offsetY}
        socket={socket}
        />
      <OffensiveField 
        offsetX={offsetX}
        offsetY={offsetY}
        socket={socket}
        room={room}
      />
      <PlayerInventory className="player-inventory"players={inventoryToShow} type={inventoryType} socket={socket} />
    </div>
    {isOffense && isSetClicked && (
      <button
        className='set'
        disabled={setButtonEnabled}
        onClick={handleSetClick}
      >
        Set!
      </button>
    )}

    <button
      // className={isOffense && isSetClicked ? 'hike' : 'hide'}
      className='hike'
      // disabled={postSetCountdown !== null}
      onClick={startRoute}
    >
      {/* {postSetCountdown !== null && postSetCountdown > 0
        ? `Hike (${Math.ceil(postSetCountdown / 1000)})`
        : "Hike!"} */}
        Hike
    </button>
    <h3 className='roomID'>{roomId}</h3>
    <div className='clock-display'>
      <div className='clock-box'>
        <span>Q{quarter}</span>
        <span>{formatTime(gameClock)}</span>
      </div>
    </div>
    {selectedPlayerId && (
    <button
      className="remove-player-button"
      onClick={() => {
        const playerToRemove = players.find(p => p.id === selectedPlayerId);
        if (!playerToRemove) return;

        // Remove from players
        setPlayers(prev => prev.filter(p => p.id !== selectedPlayerId));

        // Add back to inventory
        setInventory(prev => ({
          ...prev,
          [playerToRemove.isOffense ? "offense" : "defense"]: [
            ...prev[playerToRemove.isOffense ? "offense" : "defense"],
            playerToRemove,
          ],
        }));

        // Emit event to other clients
        socket.emit("remove_player", {
          playerId: selectedPlayerId,
          isOffense,
          room: roomId,
        });

        // Clear selection
        setSelectedPlayerId(null);
      }}
    >
      Remove
    </button>
    )}
    </>
  );
};

export default Field;
