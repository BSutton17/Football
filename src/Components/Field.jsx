import React, { useRef, useEffect, useCallback } from 'react';
import '../App.css';
import OffensiveField from './OffensiveField';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import DefensiveField from './DefensiveField';
import PlayerInventory from './PlayerInventory';
import FieldYardLines from './FieldYardLines';
import { calculateRunPlayResult } from '../Utils/runPlay';
import { logPlayerMovementReport } from '../Utils/playDebug';

function Field({ socket, room }) {
  const {
    players,
    setPlayers,
    setSelectedPlayerId,
    draggingId,
    fieldRef,
    fieldSize = { width: 0, height: 0, area: 0 },
    setFieldSize,
    routeStarted,
    setRouteStarted,
    setRouteProgress,
    inventory = { offense: [], defense: [] },
    setInventory,
    sackTimeRemaining,
    outcome, 
    liveCountdown, 
    setLiveCountdown,
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
    score,
    otherScore,
    gameClockRef,
    gameIntervalRef,
    gameClock, 
    setGameClock,
    quarter, 
    setQuarter,
    setButtonEnabled, 
    setSetButtonEnabled,
    postSetCountdown, 
    setPostSetCountdown,
    isSetClicked, 
    setIsSetClicked,
    isGoalToGo, 
    isRunPlay, 
    setIsRunPlay,
    activePlayId,
    setActivePlayId
  } = useAppContext();

  const { handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd } = useHandlerContext();
  const oneYardInPixels = fieldSize.height / 40;
  const lineOfScrimmageY = fieldSize.height / 2;
  const movementDebugRef = useRef({
    playId: null,
    startTime: null,
    startById: new Map(),
    loggedByPlayId: new Set(),
  });

  const toGlobalPosition = useCallback((player, position, height) => ({
    x: position.x,
    y: player.isOffense ? position.y + (height / 2) : position.y,
  }), []);

  const toRelativePosition = useCallback((position, width, height) => ({
    x: Number((position.x / Math.max(width, 1)).toFixed(4)),
    y: Number((position.y / Math.max(height, 1)).toFixed(4)),
  }), []);

  const capturePlayMovementStart = useCallback((playId, playerSnapshot, rect) => {
    const startById = new Map();
    playerSnapshot.forEach((player) => {
      if (!player.position) return;
      const globalPosition = toGlobalPosition(player, player.position, rect.height);
      startById.set(player.id, {
        position: globalPosition,
        relativePosition: toRelativePosition(globalPosition, rect.width, rect.height),
      });
    });

    movementDebugRef.current = {
      ...movementDebugRef.current,
      playId,
      startTime: performance.now(),
      startById,
    };
  }, [toGlobalPosition, toRelativePosition]);

  const emitPlayMovementReport = useCallback((playId, outcomeValue) => {
    const tracker = movementDebugRef.current;
    if (!playId || tracker.playId !== playId || !tracker.startTime) return;
    if (tracker.loggedByPlayId.has(playId)) return;

    const moveTimeSeconds = Math.max((performance.now() - tracker.startTime) / 1000, 0.001);
    const width = Math.max(fieldSize.width, 1);
    const height = Math.max(fieldSize.height, 1);

    const report = players
      .filter((player) => tracker.startById.has(player.id) && player.position)
      .map((player) => {
        const startState = tracker.startById.get(player.id);
        const finalPosition = toGlobalPosition(player, player.position, height);
        const dx = finalPosition.x - startState.position.x;
        const dy = finalPosition.y - startState.position.y;
        const distance = Math.hypot(dx, dy);

        return {
          id: player.id,
          role: player.role,
          startPositionRelative: startState.relativePosition,
          finalPositionRelative: toRelativePosition(finalPosition, width, height),
          moveTimeSeconds: Number(moveTimeSeconds.toFixed(3)),
          distancePixels: Number(distance.toFixed(2)),
          distanceOverTime: Number((distance / moveTimeSeconds).toFixed(2)),
          speed: player.speed ?? null,
          acceleration: player.acceleration ?? player.speed ?? null,
          route: player.role === 'WR' ? (player.route ?? null) : undefined,
          man: (!player.isOffense && (player.role === 'CB' || player.role === 'S' || player.role === 'DB'))
            ? (player.assignedOffensiveId ?? null)
            : undefined,
        };
      });

    logPlayerMovementReport({
      socket,
      payload: {
        playId,
        roomId,
        outcome: outcomeValue,
        moveTimeSeconds: Number(moveTimeSeconds.toFixed(3)),
        players: report,
      },
    });

    tracker.loggedByPlayId.add(playId);
  }, [fieldSize.height, fieldSize.width, players, roomId, socket, toGlobalPosition, toRelativePosition]);

  useEffect(() => {
    gameClockRef.current = gameClock;
  }, [gameClock, gameClockRef]);

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
  }, [gameClockRef, gameIntervalRef, setGameClock, setOutcome, setQuarter]);

  // Show offense inventory if player is currently on offense, else defense inventory
  const inventoryToShow = isOffense ? (inventory?.offense ?? []) : (inventory?.defense ?? []);
  const inventoryType = isOffense ? "offense" : "defense";

  // Calculate offsets based on field size
  // These offsets are used to position players and buttons relative to the field size
  const aspectRatio = fieldSize.width / fieldSize.height;
  

  let offsetX, offsetY;

  if (aspectRatio < 1) {
    // Tall viewport (like phones in portrait)
    offsetX = fieldSize.width / 7; // maybe slightly larger horizontal offset
    offsetY = fieldSize.height / 14; 
  } else {
    // Wide viewport (like desktop)
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

    // ✅ Stop game clock
    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
      socket.emit("stop_clock", { roomId });
      setTimeout(()=>{
        startClock()
      }, 10000)
    }
  };

    
  useEffect(() => {
    if (!socket) return;
    
    const handleStopClock = () => {
    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
      setTimeout(()=>{
        startClock()
      }, 10000)
      }
  };
    
  socket.off("stop_clock", handleStopClock);
  socket.on("stop_clock", handleStopClock);
    
  return () => socket.off("stop_clock", handleStopClock);
  }, [gameIntervalRef, socket, startClock]);

  const sackTimeRef = useRef(sackTimeRemaining);
  const playSequenceRef = useRef(0);

  // Keep the ref in sync
  useEffect(() => {
    sackTimeRef.current = sackTimeRemaining;
  }, [sackTimeRemaining]);

  useEffect(() => {
    const updateFieldSize = () => {
      if (fieldRef.current) {
        const rect = fieldRef.current.getBoundingClientRect();
        setFieldSize({ width: rect.width, height: rect.height, area: rect.width * rect.height });
      }
    };
    
    updateFieldSize();
    window.addEventListener('resize', updateFieldSize);
    return () => window.removeEventListener('resize', updateFieldSize);
  }, [fieldRef, setFieldSize]);

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
    const rect = fieldRef.current.getBoundingClientRect();
    const nextPlayId = `${roomId || 'local'}-play-${playSequenceRef.current + 1}`;
    playSequenceRef.current += 1;
    setActivePlayId(nextPlayId);
    capturePlayMovementStart(nextPlayId, players, rect);

    // Save local pre-snap state (absolute positions)
    setPreSnapPlayers(players.map(p => ({
      ...p,
      position: { ...p.position },
      route: null
    })));

    // Emit normalized pre-snap state to others
    socket.emit("pre_snap_players", {
      players: players.map(p => ({
        ...p,
        position: {
          x: p.position.x / rect.width,
          y: p.position.y / rect.height
        },
        zoneCircle: null,
        route: null
      })),
      room: roomId
    });

  const runRB = players.find(p => p.role === "RB" && p.route === "run");
  setIsRunPlay(runRB)
if (runRB) {
  const runPlayResult = calculateRunPlayResult({
    players,
    runRB,
    oneYardInPixels,
    lineOfScrimmageY,
    yardLine,
    viewportWidth: window.innerWidth,
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

    useEffect(() => {
      if (!isOffense) return;
      let intervalId;

      if (routeStarted && outcome === "" && sackTimeRemaining > 0) {
        setLiveCountdown(sackTimeRemaining); // initialize countdown

        intervalId = setInterval(() => {
          sackTimeRef.current -= 47; 
          const next = sackTimeRef.current;
          socket.emit("sack_timer_update", { sackTimeRemaining: next, roomId });

          if (next <= -47) {
            clearInterval(intervalId);
            setLiveCountdown(0);
          } else {
            setLiveCountdown(next);
          }
        }, 47);
      } else {
        setLiveCountdown(null);
      }

      return () => clearInterval(intervalId);
    }, [isOffense, outcome, roomId, routeStarted, sackTimeRemaining, setLiveCountdown, socket]);

    const displayDangerLevel = () =>{
      if(liveCountdown / 1000 > 1.5) {
        return "white"
      }
      else if(liveCountdown / 1000 <= 1.5 && liveCountdown / 1000 > 0.5){
        return "yellow"
      }
      else{
        return "red"
      }
    }

  const formatDown = (down)=> {
  switch (down) {
    case 1: return "1st";
    case 2: return "2nd";
    case 3: return "3rd";
    case 4: return "4th";
    default:
        setOutcome("Turnover on Downs");
      }
  }

  const handleEndOfPlay = useCallback(() => {

    // STOP CLOCK unless it's a run, sack, or catch
    const shouldStopClock = !(
      outcome === "Sacked" ||
      outcome.endsWith("yard run") ||
      outcome.endsWith("yard catch")
    );

    if (gameIntervalRef.current && shouldStopClock) {
      clearInterval(gameIntervalRef.current);
      gameIntervalRef.current = null;
      socket.emit("stop_clock", { roomId });
    }

    setTimeout(() => {
      setOutcome("");
    }, 3000);
  }, [gameIntervalRef, outcome, roomId, setOutcome, socket]);

  
  useEffect(() => {
    if (!isOffense || !activePlayId || outcome === "") return;
    emitPlayMovementReport(activePlayId, outcome);
  }, [activePlayId, emitPlayMovementReport, isOffense, outcome]);

  useEffect(() => {
    if (outcome === "Sacked" || outcome === "Dropped" || outcome === "Broken Up" || outcome === "Thrown Away") {
      handleEndOfPlay();
    }
    if(outcome === "Touchdown!"){
      setDown(1)
      setDistance(10)
      handleEndOfPlay();
    }
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
    if (gameIntervalRef.current) {
      clearInterval(gameIntervalRef.current);
    }
  };
  }, [gameIntervalRef]);

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
    {routeStarted && liveCountdown !== null && !isRunPlay &&(
      <div className="countdown-timer">
        <span style={{ color: displayDangerLevel() }}>{(liveCountdown / 1000).toFixed(2)}</span>
      </div>
    )}
    <h1 className="scoreboard-outcome">{outcome}</h1>
    </div>
    <div
      className="field"
      ref={fieldRef}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >  
    {/* Tick marks */}
      <FieldYardLines oneYardInPixels={oneYardInPixels} yardLine={yardLine} />
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
    {isOffense && !isSetClicked && (
      <button
        className='set'
        disabled={!setButtonEnabled}
        onClick={handleSetClick}
      >
        Set!
      </button>
    )}

    <button
      className={isOffense && isSetClicked ? 'hike' : 'hide'}
      disabled={postSetCountdown !== null}
      onClick={startRoute}
    >
      {postSetCountdown !== null && postSetCountdown > 0
        ? `Hike (${Math.ceil(postSetCountdown / 1000)})`
        : "Hike!"}
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
