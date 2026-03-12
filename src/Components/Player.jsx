import React from 'react';
import { LOGICAL_FIELD_WIDTH, LOGICAL_FIELD_HEIGHT } from './Field';
import '../App.css';
import { catchBall } from '../Utils/catchBall';
import { useAppContext } from '../Context/AppContext';
import { useEffect } from 'react'
import { resetPlayerMovementState } from '../Utils/playerState';
import { logPlaySnapshot } from '../Utils/playDebug';
import { CiFootball } from "react-icons/ci";

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
    isRunPlay,
    setIsRunPlay,
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
      const receiverAtCatch = players.find((p) => p.id === id);
      const fallbackDirection = { x: 0, y: -1 };
      const moveTarget = receiverAtCatch?.moveTarget;
      const dx = (moveTarget?.x ?? receiverAtCatch?.position?.x ?? position.x) - position.x;
      const dy = (moveTarget?.y ?? (position.y - 1)) - position.y;
      const magnitude = Math.hypot(dx, dy);
      const racDirection = magnitude > 0.001
        ? { x: dx / magnitude, y: dy / magnitude }
        : fallbackDirection;
      const oneYardInPixels = LOGICAL_FIELD_HEIGHT / 40;
      const lineOfScrimmageSharedY = LOGICAL_FIELD_HEIGHT / 2;
      const catchSharedY = position.y + (LOGICAL_FIELD_HEIGHT / 2);
      const passYardsBeforeCatch = Math.round((lineOfScrimmageSharedY - catchSharedY) / oneYardInPixels);

      logPlaySnapshot({
        socket,
        event: 'pass_caught_rac_started',
        payload: {
          playerId: id,
          openness: openess,
          catchX: position.x,
          catchY: position.y,
          yardLine,
          playId: activePlayId,
        },
      });

      const receiver = players.find((p) => p.id === id);
      const normalizedX = position.x / LOGICAL_FIELD_WIDTH;
      const normalizedY = position.y / LOGICAL_FIELD_HEIGHT;

      setThrownBallLine({
        x: receiver.position.x,
        y: receiver.position.y,
        targetHalf: 'bottom',
      });

      socket.emit("ball_thrown", {
        normalizedX,
        normalizedY,
        targetHalf: 'bottom',
        roomId,
      });

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          if (player.id !== id && player.hasCaughtBall) {
            return {
              ...player,
              hasCaughtBall: false,
            };
          }

          if (player.id === id) {
            return {
              ...player,
              hasCaughtBall: true,
              racTransitionEndsAt: performance.now() + 350,
              racDirection,
              racTransitionStartedAt: performance.now(),
              catchCarrySpeed: player.currentSpeed ?? 0,
              catchSharedY,
              passYardsBeforeCatch,
            };
          }

          return player;
        })
      );

      outcomeRef.current = "";
      sackTimerRef.current = null;
      return;
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


  const hasActiveBallCarrier = players.some((player) => player?.hasCaughtBall === true);
  const activeRunCarrierId = players.find(
    (player) => player?.isOffense && player?.route === 'run' && player?.role !== 'qb' && player?.role !== 'offensive-lineman'
  )?.id;
  const showFootballIcon = routeStarted && ((id === activeRunCarrierId) || (players.find((player) => player?.id === id)?.hasCaughtBall === true));
  const notMoveablePlayer = role === "qb" || role === "offensive-lineman" || role === "defensive-lineman";
  const isNonLinemanDefender = !isOffense && role !== 'defensive-lineman';
  const canResolvePassOutcome = routeStarted && !isRunPlay && !hasActiveBallCarrier && isUserOffense && (isOffense || isNonLinemanDefender);

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
      {showFootballIcon && (
        <span
          style={{
            position: 'absolute',
            right: '-6px',
            bottom: '-7px',
            color: 'white',
            fontSize: '16px',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          <CiFootball />
        </span>
      )}
    </div>
  );


};

export default Player;