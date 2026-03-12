// Keep this outside the function to persist across calls
import { getUnifiedMaxSpeed } from './movementModel';

export const OPENNESS_BUBBLE_RADIUS_BASE = 50;

const previousPositions = new Map();
const opennessDebugSnapshots = new Map();

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
  opennessDebugSnapshots.clear();

  const filteredOffense = offensivePlayers.filter(
    (player) => player.role !== 'offensive-lineman' && player.role !== 'qb'
  );

  const filteredDefense = defensivePlayers.filter(
    (player) => player.role !== 'defensive-lineman' && !player.isBlitzing
  );

  const fieldHeight = Math.max(fieldSize.height || 524, 1);
  const fieldWidth = Math.max(fieldSize.width || 320, 1);
  const scale = fieldHeight / 524;

  const losOffset = 262 * scale;
  const closeCoverageThreshold = 18 * scale;
  const mediumCoverageThreshold = 42 * scale;
  const wideCoverageThreshold = 72 * scale;
  const laneContestThreshold = 14 * scale;
  const opennessBubbleRadius = OPENNESS_BUBBLE_RADIUS_BASE * scale;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const routeFamilies = {
    insideBreak: new Set(['slant', 'in', 'shallow', 'drag', 'texas', 'deep cross', 'Deep Cross', 'post']),
    outsideBreak: new Set(['out', 'speed out', 'corner', 'flat', 'rb flat', 'swing', 'wheel', 'fade']),
    vertical: new Set(['go', 'seam', 'fade', 'wheel']),
    comebackStyle: new Set(['comeback', 'curl', 'curl inside', 'curl outside', 'return', 'zig', 'Double Move']),
  };

  const normalize = (vector) => {
    const length = Math.hypot(vector.x, vector.y) || 1;
    return { x: vector.x / length, y: vector.y / length };
  };

  const dot = (left, right) => left.x * right.x + left.y * right.y;

  const projectPointToSegment = (point, start, end) => {
    const segment = { x: end.x - start.x, y: end.y - start.y };
    const segmentLengthSquared = segment.x * segment.x + segment.y * segment.y || 1;
    const t = clamp(
      ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / segmentLengthSquared,
      0,
      1
    );
    return {
      x: start.x + segment.x * t,
      y: start.y + segment.y * t,
      t,
    };
  };

  const getRouteIntent = (player, velocity) => {
    const route = player.route || '';
    const lowerRoute = route.toLowerCase();
    const wrOnLeft = player.position.x <= fieldWidth / 2;
    const insideDirection = wrOnLeft ? 1 : -1;
    const outsideDirection = wrOnLeft ? -1 : 1;

    let lateralDirection = 0;
    let depthYards = 9;

    if (routeFamilies.insideBreak.has(route) || routeFamilies.insideBreak.has(lowerRoute)) {
      lateralDirection = insideDirection;
      depthYards = ['drag', 'shallow'].includes(lowerRoute) ? 4 : lowerRoute === 'texas' ? 5 : 8;
    } else if (routeFamilies.outsideBreak.has(route) || routeFamilies.outsideBreak.has(lowerRoute)) {
      lateralDirection = outsideDirection;
      depthYards = ['flat', 'rb flat', 'swing'].includes(lowerRoute) ? 3 : lowerRoute === 'speed out' ? 7 : 9;
    } else if (routeFamilies.vertical.has(route) || routeFamilies.vertical.has(lowerRoute)) {
      lateralDirection = lowerRoute === 'fade' ? outsideDirection * 0.5 : 0;
      depthYards = lowerRoute === 'wheel' ? 16 : 18;
    } else if (routeFamilies.comebackStyle.has(route) || routeFamilies.comebackStyle.has(lowerRoute)) {
      lateralDirection = lowerRoute === 'zig' ? insideDirection : 0;
      depthYards = ['curl', 'curl inside', 'curl outside', 'return'].includes(lowerRoute) ? 6 : 11;
    }

    if (!route) {
      const velocityNorm = normalize(velocity);
      return {
        vector: velocityNorm,
        lowerRoute,
        catchDepthPixels: fieldHeight / 8,
      };
    }

    const intent = normalize({
      x: lateralDirection,
      y: -1,
    });

    return {
      vector: intent,
      lowerRoute,
      catchDepthPixels: (fieldHeight / 40) * depthYards,
    };
  };

  filteredOffense.forEach((receiver) => {
    const previousPosition = previousPositions.get(receiver.id);
    const receiverVelocity = previousPosition
      ? {
          x: (receiver.position.x - previousPosition.x) / deltaTime,
          y: (receiver.position.y - previousPosition.y) / deltaTime,
        }
      : { x: 0, y: -1 };

    previousPositions.set(receiver.id, { ...receiver.position });

    const routeIntent = getRouteIntent(receiver, receiverVelocity);
    const receiverSpeed = Math.max(Math.hypot(receiverVelocity.x, receiverVelocity.y), 0.1);

    const defendersWithDistance = filteredDefense
      .map((defender) => {
        const adjustedDefenderPosition = {
          x: defender.position.x,
          y: defender.position.y - losOffset,
        };

        return {
          defender,
          adjustedDefenderPosition,
          dist: distance(receiver.position, adjustedDefenderPosition),
        };
      })
      .sort((left, right) => left.dist - right.dist);

    const primary = defendersWithDistance[0];
    const helper = defendersWithDistance[1];

    if (!primary) {
      opennessScores[receiver.id] = 1;
      return;
    }

    const primaryVector = {
      x: primary.adjustedDefenderPosition.x - receiver.position.x,
      y: primary.adjustedDefenderPosition.y - receiver.position.y,
    };
    const primaryVectorNorm = normalize(primaryVector);

    const pathSeparation = dot(primaryVector, routeIntent.vector);
    const trailingAmount = -pathSeparation;
    const lateralOffset = Math.abs(
      primaryVector.x * routeIntent.vector.y - primaryVector.y * routeIntent.vector.x
    );

    const routeSide = routeIntent.vector.x === 0 ? 0 : Math.sign(routeIntent.vector.x);
    const primarySide = primaryVector.x === 0 ? 0 : Math.sign(primaryVector.x);
    const leverageWin = routeSide !== 0 && routeSide !== primarySide;
    const isVerticalRoute = routeFamilies.vertical.has(routeIntent.lowerRoute);

    dotProduct = dot(receiverVelocity, primaryVectorNorm);

    let coverageScore;
    let distanceBucket = 'tight';
    let leverageAdjustment = 0;
    let speedAdjustment = 0;
    let helpAdjustment = 0;
    let laneAdjustment = 0;

    if (primary.dist > opennessBubbleRadius) {
      const autoOpenScore = 1;
      opennessScores[receiver.id] = autoOpenScore;
      opennessDebugSnapshots.set(receiver.id, {
        receiverId: receiver.id,
        route: receiver.route || 'none',
        primaryDefenderId: primary.defender?.id ?? null,
        helperDefenderId: helper?.defender?.id ?? null,
        primaryDistance: Number(primary.dist.toFixed(2)),
        helperDistance: helper ? Number(helper.dist.toFixed(2)) : null,
        trailingAmount: Number(trailingAmount.toFixed(2)),
        lateralOffset: Number(lateralOffset.toFixed(2)),
        leverageWin,
        distanceBucket: 'bubble-open',
        immediateHelpCount: 0,
        bubbleRadius: Number(opennessBubbleRadius.toFixed(2)),
        bubbleOpen: true,
        baseScore: autoOpenScore,
        leverageAdjustment: 0,
        speedAdjustment: 0,
        helpAdjustment: 0,
        laneAdjustment: 0,
        rawScore: autoOpenScore,
        finalScore: autoOpenScore,
      });
      return;
    }

    if (primary.dist <= closeCoverageThreshold) {
      coverageScore = 9.3;
      distanceBucket = 'tight';
    } else if (primary.dist >= wideCoverageThreshold) {
      coverageScore = 2;
      distanceBucket = 'wide';
    } else if (primary.dist >= mediumCoverageThreshold) {
      const t = (primary.dist - mediumCoverageThreshold) / (wideCoverageThreshold - mediumCoverageThreshold);
      coverageScore = 6 - t * 4;
      distanceBucket = 'medium-wide';
    } else {
      const t = (primary.dist - closeCoverageThreshold) / (mediumCoverageThreshold - closeCoverageThreshold);
      coverageScore = 9.3 - t * 3.3;
      distanceBucket = 'medium-tight';
    }

    if (routeFamilies.insideBreak.has(routeIntent.lowerRoute)) {
      if (leverageWin && trailingAmount > 3 * scale) {
        coverageScore -= 2.2;
        leverageAdjustment -= 2.2;
      }
      if (!leverageWin && primary.dist < mediumCoverageThreshold) {
        coverageScore += 1.4;
        leverageAdjustment += 1.4;
      }
    }

    if (routeFamilies.outsideBreak.has(routeIntent.lowerRoute)) {
      if (leverageWin && trailingAmount > 2 * scale) {
        coverageScore -= 1.7;
        leverageAdjustment -= 1.7;
      }
      if (!leverageWin && lateralOffset < 10 * scale) {
        coverageScore += 1.2;
        leverageAdjustment += 1.2;
      }
    }

    if (isVerticalRoute) {
      const receiverTopSpeed = getUnifiedMaxSpeed(receiver);
      const defenderTopSpeed = getUnifiedMaxSpeed(primary.defender);
      const speedEdge = receiverTopSpeed - defenderTopSpeed;
      if (speedEdge > 3.0 && trailingAmount > 3 * scale) {
        coverageScore -= 2.8;
        speedAdjustment -= 2.8;
      }
      if (speedEdge > 1.2 && trailingAmount > 1.2 * scale) {
        coverageScore -= 1.4;
        speedAdjustment -= 1.4;
      }
      if (speedEdge < -2.0 && primary.dist < mediumCoverageThreshold) {
        coverageScore += 1.2;
        speedAdjustment += 1.2;
      }
    }

    if (routeFamilies.comebackStyle.has(routeIntent.lowerRoute)) {
      if (primary.dist < closeCoverageThreshold && trailingAmount < 1 * scale) {
        coverageScore += 1.6;
        leverageAdjustment += 1.6;
      } else if (trailingAmount > 2 * scale) {
        coverageScore -= 0.8;
        leverageAdjustment -= 0.8;
      }
    }

    const catchPoint = {
      x: receiver.position.x + routeIntent.vector.x * routeIntent.catchDepthPixels,
      y: receiver.position.y + routeIntent.vector.y * routeIntent.catchDepthPixels,
    };

    const timeToCatch = routeIntent.catchDepthPixels / Math.max(receiverSpeed, 0.2);
    const allHelpers = defendersWithDistance.slice(1);

    let immediateHelpCount = 0;
    allHelpers.forEach(({ defender, adjustedDefenderPosition }) => {
      if (isVerticalRoute) {
        const helperIsOverTop = adjustedDefenderPosition.y <= (receiver.position.y - (6 * scale));
        const helperInVerticalLane = Math.abs(adjustedDefenderPosition.x - catchPoint.x) <= (22 * scale);
        if (!helperIsOverTop || !helperInVerticalLane) {
          return;
        }
      }

      const defenderDistanceToCatch = distance(adjustedDefenderPosition, catchPoint);
      const defenderSpeed = Math.max(defender.speed || 1.8, 0.4);
      const defenderArrival = defenderDistanceToCatch / defenderSpeed;

      if (defenderArrival <= timeToCatch + (2.4 * scale)) {
        immediateHelpCount += 1;
      }
    });

    if (immediateHelpCount >= 1) {
      coverageScore += 1.1;
      helpAdjustment += 1.1;
    }
    if (immediateHelpCount >= 2) {
      coverageScore += 0.7;
      helpAdjustment += 0.7;
    }

    if (helper && helper.dist < closeCoverageThreshold * 1.5) {
      if (!isVerticalRoute || helper.adjustedDefenderPosition.y <= (receiver.position.y - (6 * scale))) {
        coverageScore += 0.4;
        helpAdjustment += 0.4;
      }
    }

    const quarterback = offensivePlayers.find((player) => player.role === 'qb');
    if (quarterback) {
      const qbPoint = quarterback.position;
      let lanePenalty = 0;

      filteredDefense.forEach((defender) => {
        const adjustedDefenderPosition = {
          x: defender.position.x,
          y: defender.position.y - losOffset,
        };
        const closestPoint = projectPointToSegment(adjustedDefenderPosition, qbPoint, catchPoint);
        const contestDistance = distance(adjustedDefenderPosition, closestPoint);
        if (closestPoint.t > 0.15 && closestPoint.t < 0.95 && contestDistance < laneContestThreshold) {
          if (!isVerticalRoute || adjustedDefenderPosition.y <= (receiver.position.y - (4 * scale))) {
            lanePenalty += 0.35;
          }
        }
      });

      const cappedLanePenalty = Math.min(lanePenalty, 1.2);
      coverageScore += cappedLanePenalty;
      laneAdjustment += cappedLanePenalty;
    }

    const unclampedCoverageScore = coverageScore;
    coverageScore = clamp(coverageScore - 0.7, 1, 10);
    opennessScores[receiver.id] = coverageScore;
    opennessDebugSnapshots.set(receiver.id, {
      receiverId: receiver.id,
      route: receiver.route || 'none',
      primaryDefenderId: primary.defender?.id ?? null,
      helperDefenderId: helper?.defender?.id ?? null,
      primaryDistance: Number(primary.dist.toFixed(2)),
      helperDistance: helper ? Number(helper.dist.toFixed(2)) : null,
      trailingAmount: Number(trailingAmount.toFixed(2)),
      lateralOffset: Number(lateralOffset.toFixed(2)),
      leverageWin,
      distanceBucket,
      immediateHelpCount,
      bubbleRadius: Number(opennessBubbleRadius.toFixed(2)),
      bubbleOpen: false,
      baseScore: Number((unclampedCoverageScore - leverageAdjustment - speedAdjustment - helpAdjustment - laneAdjustment).toFixed(2)),
      leverageAdjustment: Number(leverageAdjustment.toFixed(2)),
      speedAdjustment: Number(speedAdjustment.toFixed(2)),
      helpAdjustment: Number(helpAdjustment.toFixed(2)),
      laneAdjustment: Number(laneAdjustment.toFixed(2)),
      rawScore: Number(unclampedCoverageScore.toFixed(2)),
      finalScore: Number(coverageScore.toFixed(2)),
    });

  });

  return opennessScores;
}

export function getLastOpennessDebug(receiverId) {
  return opennessDebugSnapshots.get(receiverId) ?? null;
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

  switch (route) {
    case 'corner':
      averageYards = 15;
      easeOfYac = getRandomInt(1, 8);
      break;
    case 'go':
    case 'Double Move':
    case 'fade':
      averageYards = 25;
      easeOfYac = getRandomInt(1, 28);
      break;
    case 'seam':
    case 'wheel':
      averageYards = 20;
      easeOfYac = getRandomInt(1, 15);
      break;
    case 'post':
    case 'Deep Cross':
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
    case 'speed out':
    case 'rb flat':
    case 'zig':
    case 'return':
    case 'drag':
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

  if(((route == "go" || route == "fade" || route == "Double Move") &&  openness == "lime") || totalYards > 100 - yardLine) {
    return "Touchdown!"
  }
  
  // Calculate yards after catch
  const yac = totalYards - averageYards;

  return {
    totalYards: Math.round(totalYards),
    yac: Math.max(0, Math.round(yac))
  };
}

export function calculatePassYardsFromCatch({
  openness,
  catchY,
  lineOfScrimmageY,
  oneYardInPixels,
  yardLine,
}) {
  const safeOneYard = Math.max(oneYardInPixels || 0, 0.0001);
  const rawAirYards = Math.max(0, Math.round((lineOfScrimmageY - catchY) / safeOneYard));
  let minYac = 0;
  let maxYac = 2;

  if (openness === 'red') {
    minYac = 0;
    maxYac = 1;
  } else if (openness === 'yellow') {
    minYac = 0;
    maxYac = 3;
  } else if (openness === 'lime') {
    minYac = 2;
    maxYac = 8;
  }
  const airYards = rawAirYards;

  const yac = getRandomInt(minYac, maxYac);
  const totalYards = Math.max(0, airYards + yac);
  const yardsToScore = Math.max(0, 100 - yardLine);

  if (totalYards >= yardsToScore && yardsToScore > 0) {
    return 'Touchdown!';
  }

  return {
    totalYards,
    passYardsWithoutYac: airYards,
    airYards,
    yac,
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
