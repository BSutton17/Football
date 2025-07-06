import React from 'react';
import '../App.css';
import { catchBall } from '../Utils/catchBall';
import { useAppContext } from '../Context/AppContext';
import { calculateTotalAndYAC } from '../Utils/calculator';
import { useRef, useEffect } from 'react'

export const Player = ({
  id,
  position,
  onMouseDown,
  onTouchStart,
  isOffense,
  bgColor,
  openess,
  routeStarted,
  route,
  role,
}) => {
  const {
    outcome,
    setOutcome,
    setPlayers,
    players,
    yardLine, 
    setCompletedYards,
    inventory,
    fieldSize,
    outcomeRef,
    socket,
    roomId,
    setThrownBallLine,
    sackTimerRef 
  } = useAppContext();

  if (!position) {
    // If position is null or undefined, don't render the player or render a placeholder
    return null;
  }

  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome]);

  const handleCatch = () => {
    if (outcome !== "") return;

    let result = "";

    if (role === "CB" || role === "LB" || role === "S") {
      result = "Intercepted";
    } else if (isOffense) {
      console.log("QB: " + inventory.Qb + ", inventory" + inventory);
      const catchResult = catchBall(openess, inventory.Qb);

      console.log(`[CATCH] Result: ${catchResult}`);
      
     // setOutcome(catchResult)
      if (catchResult === "Caught") {
        const yards = calculateTotalAndYAC(openess, route, yardLine);
        if (yards === "Touchdown!") {
          result = "Touchdown!";
        } else {
          result = `${yards.totalYards} yard completion`;
          setCompletedYards(yards.totalYards);
        }
      } else {
        result = catchResult;
      } // only here
    }

    setOutcome(result);
    const receiver = players.find(p => p.id === id);
    const normalizedX = position.x / fieldSize.width;
    const normalizedY = position.y / fieldSize.height;

    setThrownBallLine({ x: receiver.position.x, y: receiver.position.y });
    socket.emit("ball_thrown", {
      normalizedX,
      normalizedY,
      roomId,
    });
    
    outcomeRef.current = result;
    sackTimerRef.current = null
    

    if (result !== "") {
      console.log(`[CATCH] Sending outcome to defense: ${result}`);
      socket.emit("play_outcome", {
        outcome: result,
        yardLine: yardLine,
        roomId,
      });
    }

    // Stop all player motion
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


  const notMoveablePlayer = role === "qb" || role === "offensive-lineman" || role === "defensive-lineman";

  return (
    <div
      onMouseDown={!routeStarted && !notMoveablePlayer ? (e) => onMouseDown(e, id) : null}
      onTouchStart={!routeStarted && !notMoveablePlayer ? (e) => onTouchStart(e, id) : null}
      className={`player ${isOffense ? bgColor : "defense"}`}
      onMouseUp={routeStarted ? handleCatch : null}
      onTouchEnd={routeStarted ? handleCatch : null}
      style={{
        left: position.x,
        top: position.y,
        position: 'absolute',
      }}
    >
      {isOffense ? (
        <span className="offensive-player">X</span>
      ) : (
        <span className="defensive-player">O</span>
      )}
    </div>
  );


};

export default Player;