import React from 'react';
import { useAppContext } from '../Context/AppContext';

function getReturnYardLine(landingYardLine) {
  // Normalize edge cases
  if (landingYardLine >= 100) return 25;
  if (landingYardLine < 0) landingYardLine = 0;

  // Bias toward shorter returns for deeper kicks
  const bias = (5 - Math.abs(landingYardLine)) * 1.5;
  const base = 20 + bias + Math.random() * 15;
  const variance = (Math.random() - 0.5) * 10;

  let result = Math.round(base + variance);

  // Clamp and touchdown logic
  if (result > 99) result = 99;
  if (result >= 70) return "Touchdown";

  return result;
}

const Return = ({ kickoffResult, onComplete, onTouchback }) => {
  const {
    setYardLine,
    setOutcome,
    setDown,
    setDistance,
    switchSides,
    fieldSize,
  } = useAppContext();

  const handleTouchback = () => {
    setYardLine(25);
    setOutcome("Touchback");
    setDown(1);
    setDistance(10);
    switchSides("Kickoff Return", 25, fieldSize.height); // ✅ flip offense/defense
    onTouchback?.();
  };

  const handleReturn = () => {
    const landing = kickoffResult?.yardLine ?? 0;
    const returnYard = getReturnYardLine(landing);

    if (returnYard === "Touchdown") {
      setOutcome("Touchdown!");
      setYardLine(25); // reset for next drive
      setDown(1);
      setDistance(10);
    } else {
      setOutcome(`Returned to the ${returnYard}`);
      setYardLine(returnYard);
      setDown(1);
      setDistance(10);
    }

    switchSides("Kickoff Return", returnYard === "Touchdown" ? 25 : returnYard, fieldSize.height); // ✅ switch after return
    onComplete?.({ yardLine: returnYard === "Touchdown" ? 25 : returnYard, outcome: returnYard === "Touchdown" ? "Touchdown!" : `Returned to the ${returnYard}` });
  };

  if (!kickoffResult) return null;

  return (
    <div className="return-options">
      <h3>
        Ball landed at {kickoffResult.yardLine} yard line ({kickoffResult.position})
      </h3>
      <button onClick={handleTouchback}>Touchback</button>
      <button onClick={handleReturn}>Return</button>
    </div>
  );
};

export default Return;
