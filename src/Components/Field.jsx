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
    draggingId,
    fieldRef,
    fieldSize,
    setFieldSize,
    routeStarted,
    setRouteStarted,
    setRouteProgress,
    inventory,
    sackTimeRemaining,
    outcome, 
    liveCountdown, 
    setLiveCountdown,
    down, 
    distance,
    yardLine,
    roomId, 
    setQbPenalty,
    isOffense, 
    isPlayerOne,
    setYardLine,
    setDistance,
    setDown
  } = useAppContext();

  const { handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd } = useHandlerContext();

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

    socket.emit("route_started", {routeStarted: true, roomId});
    };

    const outcomeRef = useRef(outcome);
    
    // Keep the ref updated with the latest outcome
    useEffect(() => {
      outcomeRef.current = outcome;
    }, [outcome]);

    useEffect(() => {
      if (!isOffense) return;
      let intervalId;

      if (routeStarted && outcome == "" && sackTimeRemaining > 0) {
        setLiveCountdown(sackTimeRemaining); // initialize countdown

        intervalId = setInterval(() => {
          setLiveCountdown(prev => {
            const next = prev - 47;
            socket.emit("sack_timer_update", { sackTimeRemaining: next, roomId });
            if (next <= 0) {
              clearInterval(intervalId);
              return 0;
            }
            return next;
          });
        }, 47);
      } else {
        setLiveCountdown(null);
      }

      return () => clearInterval(intervalId);
    }, [routeStarted, sackTimeRemaining, outcome]);


    const displayDangerLevel = () =>{
      if(liveCountdown / 1000 > 1.5) {
        return "black"
      }
      else if(liveCountdown / 1000 <= 1.5 && liveCountdown / 1000 > 0.5){
        return "Warning"
      }
      // else{
      //   setQbPenalty(10)
      //   return "danger"
      // }
    }

  function formatDown(down) {
  switch (down) {
    case 1: return "1st";
    case 2: return "2nd";
    case 3: return "3rd";
    case 4: return "4th";
    default: return `${down}th`;
  }
}

useEffect(()=>{
  setYardLine(yardLine)
}, [yardLine])

useEffect(()=>{
  setDistance(distance)
}, [distance])

useEffect(()=>{
  setDown(down)
}, [down])

function formatDistance(distance){
  if(yardLine >= 90){
    return "goal"
  }
  else{
    return distance
  }
}
  return (
    <>
    <div className='info'>
      <h2>
        Yard Line:{' '}
        {typeof yardLine === 'number' && !isNaN(yardLine)
          ? yardLine <= 50
            ? `< ${yardLine}`
            : `> ${50 - (yardLine - 50)}`
          : 'Loading...'}
      </h2>

      <h2>{formatDown(down)} & {formatDistance(distance)}</h2>
    </div>
    <div className='result'>
    {routeStarted && liveCountdown !== null && (
      <div className={displayDangerLevel()}><h1>{(liveCountdown / 1000).toFixed(2)}</h1></div>
    )}
    <h1>{outcome}</h1>
    </div>
    <div
      className="field"
      ref={fieldRef}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >  
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
      <PlayerInventory players={inventoryToShow} type={inventoryType} socket={socket} />
    </div>
    <button className={isOffense ? 'hike' : "hide"} onClick={startRoute}>Hike!</button>
    <h3 className='roomID'>{roomId}</h3>
    </>
  );
};

export default Field;
