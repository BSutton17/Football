import React, { useEffect, useRef, useState } from 'react';
import { FaLongArrowAltUp } from 'react-icons/fa';
import '../App.css';

const GET_READY_DURATION = 1000;
const COUNTDOWN_DURATION = 2500;
const MAX_HEALTH = 100;
const HEALTH_DECREASE_RATE = 1;
const TAP_HEALTH_BOOST = 8;
const ANGLE_CHANGE = 5;
const TICK_INTERVAL = 14;

function Kickoff({ onComplete }) {
  const [showGetReady, setShowGetReady] = useState(true);
  const [countdownOver, setCountdownOver] = useState(false);
  const [type, setType] = useState("kickoff")
  const [frozen, setFrozen] = useState(false);

  const [health, setHealth] = useState(MAX_HEALTH);
  const [angle, setAngle] = useState(0);

  const [result, setResult] = useState(null); // Final result to display

  const intervalRef = useRef(null);
  const healthRef = useRef(MAX_HEALTH);

  useEffect(() => {
    const getReadyTimeout = setTimeout(() => {
      setShowGetReady(false);

      startDepletion();

      const countdownTimeout = setTimeout(() => {
        setCountdownOver(true);
        setFrozen(true);
        clearInterval(intervalRef.current);

        const finalHealth = healthRef.current;
        const finalAngle = angle;
        const distance =
          type === "punt"
            ? 20 + finalHealth / 3
            : 20 + finalHealth / 2;

        let position = 'Out of bounds';
        if (finalAngle >= -10 && finalAngle <= 10) {
          position = 'Center';
        } else if (finalAngle >= -30 && finalAngle < -10) {
          position = 'Right';
        } else if (finalAngle > 10 && finalAngle <= 30) {
          position = 'Left';
        }
        else{
          position = "out of bounds"
        }

        setResult({
          angle: finalAngle,
          health: finalHealth,
          distance: Math.round(distance),
          position,
        });

      }, COUNTDOWN_DURATION);

      return () => clearTimeout(countdownTimeout);
    }, GET_READY_DURATION);

    return () => {
      clearTimeout(getReadyTimeout);
      clearInterval(intervalRef.current);
    };
  }, []);


  const startDepletion = () => {
    intervalRef.current = setInterval(() => {
      healthRef.current = Math.max(0, healthRef.current - HEALTH_DECREASE_RATE);
      setHealth(healthRef.current);

      if (healthRef.current <= 0) {
        clearInterval(intervalRef.current);
        setFrozen(true);
        setCountdownOver(true);
        onComplete?.(angle);
      }
    }, TICK_INTERVAL);
  };

  const handleTap = (e) => {
    if (showGetReady || frozen) return;

    const tapX = e.clientX;
    const screenMiddle = window.innerWidth / 2;

    healthRef.current = Math.min(MAX_HEALTH, healthRef.current + TAP_HEALTH_BOOST);
    setHealth(healthRef.current);

    setAngle((prev) => prev + (tapX < screenMiddle ? -ANGLE_CHANGE : ANGLE_CHANGE));
  };

  return (
    <div className="kickoff-container" onClick={handleTap}>
      {showGetReady && <div className="kickoff-countdown">Get Ready...</div>}

      {result && (
        <div className="status-display">
          <div>Final Angle: {result.angle}°</div>
          <div>Final Health: {Math.round((result.health / MAX_HEALTH) * 100)}%</div>
          <div>Distance Traveled: {result.distance} yards</div>
          <div>Landing Position: {result.position}</div>
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
