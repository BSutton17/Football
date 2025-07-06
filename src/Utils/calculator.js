// Keep this outside the function to persist across calls
const previousPositions = new Map();

/**
 * Calculates Euclidean distance between two points
 */
function distance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

let dotProduct;
/**
 * Calculate openness scores for all offensive players based on defender positions,
 * WR velocity (calculated locally), and coverage thresholds.
 * 
 * @param {Array} offensivePlayers - array of WR/player objects with id and position {x,y}
 * @param {Array} defensivePlayers - array of defender objects with position {x,y}
 * @param {Object} fieldSize - object with height property for scaling
 * @param {number} deltaTime - time elapsed between calls, used for velocity calc
 * @returns {Object} opennessScores keyed by WR id
 */
export function calculateAllOpenness(offensivePlayers, defensivePlayers, fieldSize, deltaTime = 1) {
  const opennessScores = {};

    // Skip linemen: only include WRs, TEs, RBs, etc.
  // Skip linemen: only include WRs, TEs, RBs, etc.
  const filteredOffense = offensivePlayers.filter(p =>
    p.role !== 'offensive-lineman' && p.role !== 'qb'
  );

  // Skip defensive linemen
  const filteredDefense = defensivePlayers.filter(p =>
    p.role !== 'defensive-lineman' && !p.isBlitzing
  );

  // Reference baseline height: 524
  const fieldHeight = fieldSize.height;
  const scale = fieldHeight / 524;

  const losOffset = 262 * scale;
  const closeCoverageThreshold = 17.5 * scale;
  const doubleCoverageThreshold = 25 * scale;
  const opennessScale = 200 * scale;

  filteredOffense.forEach((wr) => {
    // Calculate local velocity based on previous position
    const prevPos = previousPositions.get(wr.id);
    let wrVelocity = { x: 0, y: 0 };

    if (prevPos) {
      wrVelocity = {
        x: (wr.position.x - prevPos.x) / deltaTime,
        y: (wr.position.y - prevPos.y) / deltaTime,
      };
    }

    // Update previous position for next frame
    previousPositions.set(wr.id, { ...wr.position });

    // Calculate distances to defenders (adjusting y by LOS offset)
    const defendersWithDistance = filteredDefense.map((def) => {
      const defPos = {
        x: def.position.x,
        y: def.position.y - losOffset,
      };
      return { def, dist: distance(wr.position, defPos), defPos };
    });

    defendersWithDistance.sort((a, b) => a.dist - b.dist);

    const closest = defendersWithDistance[0];
    const secondClosest = defendersWithDistance[1];

    // Double coverage penalty
    if (
      closest?.dist < doubleCoverageThreshold &&
      secondClosest?.dist < doubleCoverageThreshold
    ) {
      opennessScores[wr.id] = 10;
      return;
    }

    if (!closest) {
      opennessScores[wr.id] = 1;
      return;
    }

    // Vector from WR to defender
    const wrToDef = {
      x: closest.def.position.x - wr.position.x,
      y: closest.def.position.y - losOffset - wr.position.y,
    };

    const length = Math.sqrt(wrToDef.x ** 2 + wrToDef.y ** 2) || 1;
    const normWrToDef = { x: wrToDef.x / length, y: wrToDef.y / length };

    let wrToSecondef = { x: 0, y: 0}
    let dotSecond = 0;

    if (secondClosest) {
      wrToSecondef = {
        x: secondClosest.def.position.x - wr.position.x,
        y: secondClosest.def.position.y - losOffset - wr.position.y,
      };

      const lengthSecond = Math.sqrt(wrToSecondef.x ** 2 + wrToSecondef.y ** 2) || 1;
      const normWrToSecondDef = {
        x: wrToSecondef.x / lengthSecond,
        y: wrToSecondef.y / lengthSecond,
      };

      dotSecond = wrVelocity.x * normWrToSecondDef.x + wrVelocity.y * normWrToSecondDef.y;
    }
  

    // Dot product between WR velocity and normalized vector to defender
    const dot = wrVelocity.x * normWrToDef.x + wrVelocity.y * normWrToDef.y;
    dotProduct = dot;
    // Calculate openness score based on distance and velocity direction
    let opennessScore;

    if (dot < -0.50 && closest.dist < closeCoverageThreshold) {
      // WR moving away from defender and is smothered = make them covered
      opennessScore = 5;
      opennessScores[wr.id] = opennessScore;
      return;
    }
    else if(dot < -0.50 && dotSecond > 0 && secondClosest.dist < closeCoverageThreshold * 4 ){
      opennessScore = 5;
      opennessScores[wr.id] = opennessScore;
      return;
    }
    else if (closest.dist < closeCoverageThreshold) {
      opennessScore = 10;
      opennessScores[wr.id] = opennessScore;
      return; // ✅ exits early
    } 
    else if(dot > 0 && dotSecond > 0.20 ){
      opennessScore = 10;
      opennessScores[wr.id] = opennessScore;
      return;
    }
    else if(dot > 0){
      opennessScore = 5;
      opennessScores[wr.id] = opennessScore;
      return;
    }
    else if (dot < -0.50) {
      // WR moving away from defender and not smothered
      opennessScore = 1;
      opennessScores[wr.id] = opennessScore;
      return;
    }
    if (dot > 0.51 && closest.dist < opennessScale * 0.6) {
      opennessScore = 9;
      opennessScores[wr.id] = opennessScore;
      return
    } else {
      opennessScore = Math.min(10, Math.max(1, opennessScale / closest.dist));
      opennessScores[wr.id] = opennessScore;
      return;
    }

  });

  return opennessScores;
}

export const isMovingTowardDefender = dotProduct > 0;

/**
 * Estimate Yards After Catch based on WR and defender states
 *
 * @param {Object} wr - The WR object who caught the ball
 * @param {number} openness - Openness score (1–10)
 * @returns {number} estimated YAC
 */
export function calculateTotalAndYAC(openness, route, yardLine) {
  let coverage;
  let averageYards;
  let easeOfYac;

  if (openness == "red") {
    coverage = 0; // Smothered
  } else if (openness == "yellow") {
    coverage = Math.random();
  } else {
    coverage = Math.random() * (1.25 - 1) + 1;
  }

  console.log("route: " + route)

  switch (route) {
    case 'corner':
      averageYards = 15;
      easeOfYac = getRandomInt(1, 8);
      break;
    case 'go':
      averageYards = 25;
      easeOfYac = getRandomInt(1, 28);
      break;
    case 'seam':
    case 'wheel':
      averageYards = 20;
      easeOfYac = getRandomInt(1, 15);
      break;
    case 'post':
      averageYards = 18;
      easeOfYac = getRandomInt(1, 15);
      break;
    case 'in':
      averageYards = 9;
      easeOfYac = getRandomInt(1, 7);
      break;
    case 'curl inside':
    case 'curl outside':
      averageYards = 4;
      easeOfYac = getRandomInt(1, 2);
      break;
    case 'curl':
      averageYards = 6;
      easeOfYac = getRandomInt(1, 2);
      break;
    case 'slant':
    case 'shallow':
    case 'texas':
      averageYards = 4;
      easeOfYac = getRandomInt(1, 7);
      break;
    case 'comeback':
      averageYards = 7;
      easeOfYac = getRandomInt(1, 4);
      break;
    case 'out':
      averageYards = 9;
      easeOfYac = getRandomInt(1, 6);
      break;
    case 'flat':
    case 'rb flat':
      averageYards = 3;
      easeOfYac = getRandomInt(1, 8);
      break;
    case 'swing':
      averageYards = 1;
      easeOfYac = getRandomInt(1, 6);
      break;
    default:
      averageYards = 10;
      easeOfYac = 0.5;
      break;
  }

  // Calculate total yards as average + some factor based on easeOfYac and coverage
  // Higher easeOfYac and lower coverage lead to more yards
  const coveragePenalty = coverage; // coverage value reduces yards
  const yacPotential = easeOfYac;

  // total yards = average yards - coverage penalty + yac potential
  let totalYards = averageYards + (coveragePenalty * yacPotential);

  console.log("totalYards: " + totalYards + ", yards to go: " + (100 - yardLine))
  if((route == "go" &&  openness == "lime") || totalYards > 100 - yardLine) {
    return "Touchdown!"
  }
  
  // Calculate yards after catch
  const yac = totalYards - averageYards;

  console.log("Coverage: " + coverage + ", averageYards" + averageYards + ", totalYards: " + totalYards)


  return {
    totalYards: Math.round(totalYards),
    yac: Math.max(0, Math.round(yac))
  };
}


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function calculateRunYardage({ runRB, offensivePlayers, defensivePlayers, lineOfScrimmageY, oneYardInPixels }) {
  const angleDeg = runRB.runAngle ?? 90;
  const angleRad = angleDeg * (Math.PI / 180);
  const boxHeight = oneYardInPixels * 8;
  const boxTop = lineOfScrimmageY - oneYardInPixels * 6;
  const boxBottom = boxTop + boxHeight;

  const horizontalOffset = Math.sin(angleRad) * boxHeight;
  const boxCenterX = runRB.position.x + horizontalOffset;
  const boxLeft = boxCenterX - window.innerWidth * 0.15;
  const boxRight = boxCenterX + window.innerWidth * 0.15;

  const isInBox = (player) =>
    player.position.y >= boxTop &&
    player.position.y <= boxBottom &&
    player.position.x >= boxLeft &&
    player.position.x <= boxRight;

  const offenseInBox = offensivePlayers.filter(p => isInBox(p)).length;
  const defenseInBox = defensivePlayers.filter(p => isInBox(p)).length;

  const baseYards = 2;
  const pushFactor = 1;
  const rbSpeed = runRB.speed ?? 5;
  const rbStrength = runRB.strength ?? 5;
  const statBonus = rbSpeed * 0.2 + rbStrength * 0.3;

  const yards = baseYards + (offenseInBox - defenseInBox) * pushFactor + statBonus;

  return Math.max(0, Math.min(20, Math.round(yards)));
}
