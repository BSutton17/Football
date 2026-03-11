const clampRating = (value, fallback = 75) => {
  const numeric = typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
  return Math.max(40, Math.min(numeric, 99));
};

export const getUnifiedMaxSpeed = (player) => {
  const speedRating = clampRating(player?.speed, 75);
  // Global non-lineman boost: +25% on top of the shared baseline.
  return speedRating * 1.5625;
};

export const getUnifiedAccelerationRate = (player) => {
  const accelerationRating = clampRating(player?.acceleration ?? player?.speed, 75);
  return 8 + ((accelerationRating - 40) / 59) * 44;
};
