export function getRandomInt(min, max) {
  const minValue = Math.ceil(min);
  const maxValue = Math.floor(max);
  return Math.floor(Math.random() * (maxValue - minValue + 1) + minValue);
}

export function calculateRunPlayResult({
  players,
  runRB,
  oneYardInPixels,
  lineOfScrimmageY,
  yardLine,
  viewportWidth,
}) {
  const angleDeg = runRB.runAngle ?? 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const boxHeight = oneYardInPixels * 9;
  const boxTop = lineOfScrimmageY - oneYardInPixels * 6;
  const boxBottom = boxTop + boxHeight;
  const horizontalOffset = Math.sin(angleRad) * boxHeight;
  const boxCenterX = runRB.position.x + horizontalOffset;
  const boxLeft = boxCenterX - viewportWidth * 0.15;
  const boxRight = boxCenterX + viewportWidth * 0.15;

  const isOffenseInBox = (player) => {
    return player.position.x >= boxLeft && player.position.x <= boxRight;
  };

  const isDefenseInBox = (player) => {
    return (
      player.position.x >= boxLeft &&
      player.position.x <= boxRight &&
      player.position.y >= boxTop &&
      player.position.y <= boxBottom
    );
  };

  const offensivePlayersInBox = players.filter((player) => player.isOffense && isOffenseInBox(player)).length - 2;
  const defensivePlayersInBox = players.filter((player) => !player.isOffense && isDefenseInBox(player)).length;

  const rbSpeed = runRB.speed ?? 5;
  const rbStrength = runRB.strength ?? 5;
  const pushFactor = 3;
  const statBonus = rbSpeed * 0.02 + rbStrength * 0.03 + getRandomInt(-1, 1);

  const rawYards =
    (offensivePlayersInBox - defensivePlayersInBox) * pushFactor +
    statBonus +
    getRandomInt(-2, 2);

  const yardsGained = Math.round(rawYards);
  const delayMs = 1000 + 250 * yardsGained;
  const outcome = yardsGained > 100 - yardLine ? 'Touchdown!' : `${yardsGained} yard run`;

  return {
    yardsGained,
    delayMs,
    outcome,
    debug: {
      boxTop,
      boxBottom,
      boxLeft,
      boxRight,
      rawYards,
    },
  };
}
