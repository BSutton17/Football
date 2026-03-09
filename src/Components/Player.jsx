import React from 'react';
import '../App.css';
import { catchBall } from '../Utils/catchBall';
import { useAppContext } from '../Context/AppContext';
import { calculatePassYardsFromCatch } from '../Utils/calculator';
import { useEffect } from 'react'
import { resetPlayerMovementState } from '../Utils/playerState';
import { logPlaySnapshot } from '../Utils/playDebug';

export const Player = ({
  id,
  position,
  onMouseDown,
  onTouchStart,
  isOffense,
  bgColor,
  openess,
  routeStarted,
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
    activePlayId,
    isOffense: isUserOffense,
    setThrownBallLine,
    sackTimerRef 
  } = useAppContext();

  useEffect(() => {
    outcomeRef.current = outcome;
  }, [outcome, outcomeRef]);

  if (!position) {
    // If position is null or undefined, don't render the player or render a placeholder
    return null;
  }

  const handleCatch = () => {
    if (outcome !== "") return;
    if (!isUserOffense) return;
    const isNonLinemanDefender = !isOffense && role !== 'defensive-lineman';
    if (!isOffense && !isNonLinemanDefender) return;

    let result = "";

    const catchResult = isNonLinemanDefender ? "Intercepted" : catchBall(openess, inventory.Qb);
    
    if (catchResult === "Intercepted") {
      logPlaySnapshot({
        socket,
        event: 'pass_intercepted',
        payload: {
          playerId: id,
          role,
          catchX: position.x,
          catchY: position.y,
          yardLine,
          playId: activePlayId,
        },
      });
      result = "Intercepted";
    } else if (catchResult === "Caught") {
      const lineOfScrimmageY = fieldSize.height / 2;
      const oneYardInPixels = fieldSize.height / 40;
      const catchYGlobal = position.y + fieldSize.height / 2;

      const yards = calculatePassYardsFromCatch({
        openness: openess,
        catchY: catchYGlobal,
        lineOfScrimmageY,
        oneYardInPixels,
        yardLine,
      });

      if (yards === "Touchdown!") {
        logPlaySnapshot({
          socket,
          event: 'pass_touchdown',
          payload: {
            playerId: id,
            openness: openess,
            catchX: position.x,
            catchY: position.y,
            catchYGlobal,
            lineOfScrimmageY,
            yardLine,
            playId: activePlayId,
          },
        });
        result = "Touchdown!";
      } else {
        logPlaySnapshot({
          socket,
          event: 'pass_completion',
          payload: {
            playerId: id,
            openness: openess,
            catchX: position.x,
            catchY: position.y,
            catchYGlobal,
            lineOfScrimmageY,
            passYardsWithoutYac: yards.passYardsWithoutYac,
            yac: yards.yac,
            totalYards: yards.totalYards,
            yardLine,
            playId: activePlayId,
          },
        });
        result = `${yards.totalYards} yard completion`;
        setCompletedYards(yards.totalYards);
      }
    } else {
      logPlaySnapshot({
        socket,
        event: 'pass_incomplete',
        payload: {
          playerId: id,
          openness: openess,
          catchResult,
          catchX: position.x,
          catchY: position.y,
          yardLine,
          playId: activePlayId,
        },
      });
      result = catchResult;
    }

    setOutcome(result);
    const receiver = players.find(p => p.id === id);
    const normalizedX = position.x / fieldSize.width;
    const normalizedY = position.y / fieldSize.height;

    const targetHalf = isNonLinemanDefender ? 'top' : 'bottom';

    setThrownBallLine({
      x: receiver.position.x,
      y: receiver.position.y,
      targetHalf,
    });
    socket.emit("ball_thrown", {
      normalizedX,
      normalizedY,
      targetHalf,
      roomId,
    });
    
    outcomeRef.current = result;
    sackTimerRef.current = null
    

    if (result !== "") {
      socket.emit("play_outcome", {
        outcome: result,
        yardLine: yardLine,
        roomId,
      });
    }

    // Stop all player motion
    setPlayers(prev =>
      prev.map((player) => resetPlayerMovementState(player))
    );
  };


  const notMoveablePlayer = role === "qb" || role === "offensive-lineman" || role === "defensive-lineman";
  const isNonLinemanDefender = !isOffense && role !== 'defensive-lineman';
  const canResolvePassOutcome = routeStarted && isUserOffense && (isOffense || isNonLinemanDefender);

  return (
    <div
      onMouseDown={!routeStarted && !notMoveablePlayer ? (e) => onMouseDown(e, id) : null}
      onTouchStart={!routeStarted && !notMoveablePlayer ? (e) => onTouchStart(e, id) : null}
      className={`player ${isOffense ? bgColor : "defense"}`}
      onMouseUp={canResolvePassOutcome ? handleCatch : null}
      onTouchEnd={canResolvePassOutcome ? handleCatch : null}
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