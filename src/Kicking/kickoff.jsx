import React, { useEffect, useRef, useState } from 'react';
import '../App.css';

const COUNTDOWN_DURATION = 2500; // 2.5 seconds before allowed to tap
const MAX_HEALTH = 100;
const HEALTH_DECREASE_RATE = 1;
const TAP_HEALTH_BOOST = 8;
const ANGLE_CHANGE = 5;
const TICK_INTERVAL = 14;

function Kickoff({ onComplete }) {
  const [countdownOver, setCountdownOver] = useState(false);
  const [health, setHealth] = useState(MAX_HEALTH);
  const [angle, setAngle] = useState(0);

  const intervalRef = useRef(null);
  const healthRef = useRef(MAX_HEALTH);

  useEffect(() => {
    const countdownTimeout = setTimeout(() => {
      setCountdownOver(true);
    }, COUNTDOWN_DURATION);

    return () => {
      clearTimeout(countdownTimeout);
      clearInterval(intervalRef.current);
    };
  }, []);

  const startDepletion = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      healthRef.current = Math.max(0, healthRef.current - HEALTH_DECREASE_RATE);
      setHealth(healthRef.current);

      if (healthRef.current <= 0) {
        clearInterval(intervalRef.current);
        onComplete?.(angle);
      }
    }, TICK_INTERVAL);
  };

  const handleTap = (e) => {
    if (!countdownOver) return;

    const tapX = e.clientX;
    const screenMiddle = window.innerWidth / 2;

    // Boost health on tap
    healthRef.current = Math.min(MAX_HEALTH, healthRef.current + TAP_HEALTH_BOOST);
    setHealth(healthRef.current);

    // Rotate arrow left/right based on tap position
    setAngle((prev) => prev + (tapX < screenMiddle ? -ANGLE_CHANGE : ANGLE_CHANGE));

    // Start or restart depletion on tap
    startDepletion();
  };

  return (
    <div className="kickoff-container" onClick={handleTap}>
      {!countdownOver && <div className="kickoff-countdown">Get Ready...</div>}

      <div className="arrow-wrapper">
        <div
          className="arrow"
          style={{
            transform: `rotate(${angle}deg)`,
            opacity: countdownOver ? 1 : 0,
          }}
        />
        <div className="health-bar">
          <div
            className="health-fill"
            style={{ width: `${(health / MAX_HEALTH) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default Kickoff;
