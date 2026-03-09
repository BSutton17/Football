import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaLongArrowAltUp } from 'react-icons/fa';
import { useAppContext } from '../Context/AppContext';
import '../App.css';

const GET_READY_DURATION = 1000;
const COUNTDOWN_DURATION = 2500;
const MAX_HEALTH = 100;
const HEALTH_DECREASE_RATE = 1;
const TAP_HEALTH_BOOST = 8;
const ANGLE_CHANGE = 5;
const TICK_INTERVAL = 14;

function Kickoff({ onComplete, room }) {
  const [showGetReady, setShowGetReady] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState(null);
  const [type] = useState("kickoff");

  const intervalRef = useRef(null);
  const healthRef = useRef(MAX_HEALTH);
  const {players} = useAppContext()
  let bothPlayersJoined = players.length > 2

  const startDepletion = useCallback(() => {
    intervalRef.current = setInterval(() => {
      healthRef.current = Math.max(0, healthRef.current - HEALTH_DECREASE_RATE);
      setHealth(healthRef.current);

      if (healthRef.current <= 0) {
        clearInterval(intervalRef.current);
        setFrozen(true);
        onComplete?.({
          angle,
          health: 0,
          distance: 20,
          yardLine: 80,
          position: "Center"
        });
      }
    }, TICK_INTERVAL);
  }, [angle, onComplete]);

  useEffect(() => {
    if (!bothPlayersJoined) return;

    setShowGetReady(true);

    const getReadyTimeout = setTimeout(() => {
      setShowGetReady(false);
      startDepletion();

      const countdownTimeout = setTimeout(() => {
        setFrozen(true);
        clearInterval(intervalRef.current);

        const finalHealth = healthRef.current;
        const finalAngle = angle;
        const distance =
          type === "punt"
            ? 20 + finalHealth / 3
            : 20 + finalHealth / 2;

        const landingYardLine = 100 - Math.round(distance);

        let position = 'Out of bounds';
        if (finalAngle >= -10 && finalAngle <= 10) {
          position = 'Center';
        } else if (finalAngle >= -30 && finalAngle < -10) {
          position = 'Right';
        } else if (finalAngle > 10 && finalAngle <= 30) {
          position = 'Left';
        }

        const kickoffResult = {
          angle: finalAngle,
          health: finalHealth,
          distance: Math.round(distance),
          yardLine: landingYardLine,
          position,
        };

        setResult(kickoffResult);
        onComplete?.(kickoffResult);
      }, COUNTDOWN_DURATION);

      return () => clearTimeout(countdownTimeout);
    }, GET_READY_DURATION);

    return () => {
      clearTimeout(getReadyTimeout);
      clearInterval(intervalRef.current);
    };
  }, [angle, bothPlayersJoined, onComplete, players, startDepletion, type]);

  const handleTap = (e) => {
    if (showGetReady || frozen || !bothPlayersJoined) return;

    const tapX = e.clientX;
    const screenMiddle = window.innerWidth / 2;

    healthRef.current = Math.min(MAX_HEALTH, healthRef.current + TAP_HEALTH_BOOST);
    setHealth(healthRef.current);

    setAngle((prev) =>
      prev + (tapX < screenMiddle ? -ANGLE_CHANGE : ANGLE_CHANGE)
    );
  };

  return (
    <div className="kickoff-container" onClick={handleTap}>
      {!players.length > 2 && (
        <>
        <div className="kickoff-countdown">Waiting for opponent...</div>
        <div className="kickoff-countdown">Room ID: {room}</div>
        </>
      )}

      {showGetReady && <div className="kickoff-countdown">Get Ready...</div>}

      {result && (
        <div className="status-display">
          <div>Final Angle: {result.angle}°</div>
          <div>Final Health: {Math.round((result.health / MAX_HEALTH) * 100)}%</div>
          <div>Distance Traveled: {result.distance} yards</div>
          <div>Landing Position: {result.position}</div>
          <div>Landing Yard Line: {result.yardLine}</div>
        </div>
      )}

      <div
        className="arrow-wrapper"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <div className="arrow-fill-container">
          <div
            className="arrow-fill"
            style={{ height: `${(health / MAX_HEALTH) * 100}%` }}
          />
          <FaLongArrowAltUp className="arrow-icon" />
        </div>
      </div>
    </div>
  );
}

export default Kickoff;
