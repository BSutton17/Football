import React from 'react';
import { LOGICAL_FIELD_WIDTH, LOGICAL_FIELD_HEIGHT } from './Field';
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
  extraClassName,
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
      const lineOfScrimmageY = LOGICAL_FIELD_HEIGHT / 2;
      const oneYardInPixels = LOGICAL_FIELD_HEIGHT / 40;
      const catchYGlobal = position.y + (LOGICAL_FIELD_HEIGHT / 2);

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
    const normalizedX = position.x / LOGICAL_FIELD_WIDTH;
    const normalizedY = position.y / LOGICAL_FIELD_HEIGHT;

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

  // Convert logical position to screen coordinates for rendering
  const screenX = (position.x / LOGICAL_FIELD_WIDTH) * fieldSize.width;
  const screenY = (position.y / LOGICAL_FIELD_HEIGHT) * fieldSize.height;

  return (
    <div
      onMouseDown={!routeStarted && !notMoveablePlayer ? (e) => onMouseDown(e, id) : null}
      onTouchStart={!routeStarted && !notMoveablePlayer ? (e) => onTouchStart(e, id) : null}
      className={`player ${isOffense ? bgColor : "defense"} ${extraClassName ?? ''}`.trim()}
      onMouseUp={canResolvePassOutcome ? handleCatch : null}
      onTouchEnd={canResolvePassOutcome ? handleCatch : null}
      style={{
        left: screenX,
        top: screenY,
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