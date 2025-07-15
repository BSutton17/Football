import React, { useState, useRef, useEffect } from 'react';
import Player from './Player';
import '../App.css';
import OffensiveField from './OffensiveField';
import { useAppContext } from '../Context/AppContext';
import { useHandlerContext } from '../Context/HandlerContext';
import DefensiveField from './DefensiveField';
import PlayerInventory from './PlayerInventory';
import teamData from '../Teams.json';

function Field({ socket, room, name }) {
  const {
    players,
    setPlayers,
    setSelectedPlayerId,
    draggingId,
    fieldRef,
    fieldSize,
    setFieldSize,
    routeStarted,
    setRouteStarted,
    setRouteProgress,
    inventory,
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
    setButtonEnabled, setSetButtonEnabled,
    postSetCountdown, setPostSetCountdown,
    isSetClicked, setIsSetClicked,
    isGoalToGo, 
    isRunPlay, setIsRunPlay
  } = useAppContext();

  const { handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd } = useHandlerContext();
  const oneYardInPixels = fieldSize.height / 40;
  const lineOfScrimmageY = fieldSize.height / 2

  useEffect(() => {
    gameClockRef.current = gameClock;
  }, [gameClock]);

  useEffect(() => {
    setSetButtonEnabled(false);
    setIsSetClicked(false);
    setPostSetCountdown(null);
    const delay = down === 1 ? 10000 : 0; // ms
    const timeout = setTimeout(() => {
      setSetButtonEnabled(true);
    }, delay);

    return () => clearTimeout(timeout);
  }, [down, yardLine]);

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
  }, [isSetClicked, postSetCountdown]);

  // Show offense inventory if player is currently on offense, else defense inventory
  const inventoryToShow = isOffense ? inventory.offense : inventory.defense;
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
    setIsSetClicked(true);
    setSetButtonEnabled(false);
    setPostSetCountdown(10000); 
    socket.emit("offense_set", { roomId }); 

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
  }, [socket]);

  const sackTimeRef = useRef(sackTimeRemaining);

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
  }, []);

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
  }, [draggingId, handleMouseUp]);

  const startRoute = () => {
    const rect = fieldRef.current.getBoundingClientRect();

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
  const angleDeg = runRB.runAngle ?? 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const boxHeight = oneYardInPixels * 9;
  const boxTop = lineOfScrimmageY - oneYardInPixels * 6;
  const boxBottom = boxTop + boxHeight;
  const horizontalOffset = Math.sin(angleRad) * boxHeight;
  const boxCenterX = runRB.position.x + horizontalOffset;
  const boxLeft = boxCenterX - window.innerWidth * 0.15;
  const boxRight = boxCenterX + window.innerWidth * 0.15;

  console.log("📦 Tackle Box:");
  console.log("  Top:", boxTop);
  console.log("  Bottom:", boxBottom);
  console.log("  Left:", boxLeft);
  console.log("  Right:", boxRight);

  const isOffenseInBox = (player) => {
    const inBox = player.position.x >= boxLeft && player.position.x <= boxRight;
    return inBox;
  };

  const isDefenseInBox = (player) => {
    const inBox =
      player.position.x >= boxLeft &&
      player.position.x <= boxRight &&
      player.position.y >= boxTop &&
      player.position.y <= boxBottom;
    return inBox;
  };

  const offensivePlayersInBox = players.filter((p) => p.isOffense && isOffenseInBox(p)).length - 2;
  const defensivePlayersInBox = players.filter((p) => !p.isOffense && isDefenseInBox(p)).length;

  const rbSpeed = runRB.speed ?? 5;
  const rbStrength = runRB.strength ?? 5;
  const pushFactor = 3;
  const statBonus = (rbSpeed * 0.02 + rbStrength * 0.03) + getRandomInt(-1, 1);

  const rawYards = (((offensivePlayersInBox - defensivePlayersInBox) * pushFactor) + statBonus) + getRandomInt(-2, 2);
  console.log("Raw Yards Gained: " + rawYards);
  const yardsGained = Math.round(rawYards);
  setCompletedYards(yardsGained); 

  setTimeout(() => {
    if(yardsGained > 100 - yardLine){
      setOutcome("Touchdown!");
    }
    else { 
      setOutcome(`${yardsGained} yard run`);
    }
    }, 1000 + (250 * yardsGained));
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

  const startClock = () =>{
    if (!gameIntervalRef.current) {
      gameIntervalRef.current = setInterval(() => {
        gameClockRef.current -= 1000;
        setGameClock(gameClockRef.current);

        if (gameClockRef.current <= 0) {
          clearInterval(gameIntervalRef.current);
          gameIntervalRef.current = null;

          // Advance quarter or end game
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
  }
  function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
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
    }, [routeStarted, sackTimeRemaining, outcome]);

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

  const handleEndOfPlay = () => {

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
  };

  
  useEffect(() => {
    if (outcome === "Sacked" || outcome === "Dropped" || outcome === "Broken Up" || outcome === "Thrown Away") {
      handleEndOfPlay();
    }
    if(outcome === "Touchdown!"){
      setDown(1)
      setDistance(10)
      handleEndOfPlay();
    }
  }, [outcome]);

  function formatDistance(distance) {
    return isGoalToGo ? "goal" : distance;
  }

  function renderYardLines() {
    return Array.from({ length: 41 }).flatMap((_, i) => {
      const top = i * oneYardInPixels;
      const offset = yardLine % 5;
      const isFiveYardLine = ((i % 5) - offset) === 0;

      // Calculate absolute yard number accounting for offset and base yardLine
     const yardNumber = yardLine - i + 20
     const newYardNumber = yardNumber <= 50
    ? yardLine - i + 20
    : 100 -(yardLine - i + 20);

      const isTenYardLine = newYardNumber % 10 === 0 && newYardNumber !== 0;

      const lines = [];

      if (isFiveYardLine) {
        // Full width line every 5 yards
        lines.push(
          <div
            key={`yard-line-full-${i}`}
            style={{
              position: 'absolute',
              top: `${top}px`,
              left: 0,
              width: '100%',
              height: '2px',
              backgroundColor: 'white',
              zIndex: 1,
            }}
          />
        );
      } else {
        // Four small ticks on opposite sides: two near edges, two closer to middle
        lines.push(
          // Left edge tick
          <div
            key={`yard-line-tick-left-edge-${i}`}
            style={{
              position: 'absolute',
              top: `${top}px`,
              left: '0%',
              width: '3%',
              height: '2px',
              backgroundColor: 'white',
              zIndex: 1,
            }}
          />,
          // Right edge tick
          <div
            key={`yard-line-tick-right-edge-${i}`}
            style={{
              position: 'absolute',
              top: `${top}px`,
              right: '0%',
              width: '3%',
              height: '2px',
              backgroundColor: 'white',
              zIndex: 1,
            }}
          />,
          // Left inner tick (closer to middle)
          <div
            key={`yard-line-tick-left-inner-${i}`}
            style={{
              position: 'absolute',
              top: `${top}px`,
              left: '30%', // adjust percentage to position closer to middle
              width: '3%',
              height: '2px',
              backgroundColor: 'white',
              zIndex: 1,
            }}
          />,
          // Right inner tick (closer to middle)
          <div
            key={`yard-line-tick-right-inner-${i}`}
            style={{
              position: 'absolute',
              top: `${top}px`,
              right: '30%', // adjust percentage to position closer to middle
              width: '3%',
              height: '2px',
              backgroundColor: 'white',
              zIndex: 1,
            }}
          />
        );
      }

      //If this is a 10-yard line, render the yard number labels on both sides
      if (isTenYardLine) {
        lines.push(
          <div
            key={`yard-line-number-left-${i}`}
            style={{
              position: 'absolute',
              top: `calc(${top}px - 2.5vh)`, // slightly above the line
              left: '5px',
              color: 'white',
              fontSize: '150%',
              fontWeight: 'bold',
              userSelect: 'none',
              rotate: '90deg',
              zIndex: 2,
            }}
          >
            {newYardNumber}
          </div>,
          <div
            key={`yard-line-number-right-${i}`}
            style={{
              position: 'absolute',
              top: `calc(${top}px - 2.5vh)`,
              right: '5px',
              color: 'white',
              fontSize: '150%',
              fontWeight: 'bold',
              userSelect: 'none',
              rotate: '-90deg',
              zIndex: 2,
            }}
          >
            {newYardNumber}
          </div>
        );
      }

      return lines;
    });
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
  }, []);

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
      {renderYardLines()}
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
