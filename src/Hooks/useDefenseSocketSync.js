import { useEffect } from 'react';

const LOGICAL_FIELD_WIDTH = 800;
const LOGICAL_FIELD_HEIGHT = 600;
const clampX = (value) => Math.max(0, Math.min(LOGICAL_FIELD_WIDTH, value));

const realignTrenchToSpot = (playersList, spotX) => {
  if (!Array.isArray(playersList)) return playersList;

  const center = playersList.find((p) => p.id === 'O-L3' && p.position);
  if (!center?.position || typeof spotX !== 'number' || Number.isNaN(spotX)) return playersList;

  const deltaX = spotX - center.position.x;
  if (Math.abs(deltaX) < 0.001) return playersList;

  const trenchIds = new Set(['QB', 'O-L1', 'O-L2', 'O-L3', 'O-L4', 'O-L5', 'D-L1', 'D-L2', 'D-L3', 'D-L4']);
  const shiftedRoles = new Set(['WR', 'TE', 'RB', 'CB', 'LB', 'S', 'qb', 'offensive-lineman', 'defensive-lineman']);

  return playersList.map((player) => {
    const shouldShift = trenchIds.has(player.id) || shiftedRoles.has(player.role);
    if (!shouldShift || !player.position) return player;

    const shiftedX = clampX(player.position.x + deltaX);
    const shiftedZoneCircle = player.zoneCircle && typeof player.zoneCircle.x === 'number'
      ? { ...player.zoneCircle, x: clampX(player.zoneCircle.x + deltaX) }
      : player.zoneCircle;

    return {
      ...player,
      position: {
        ...player.position,
        x: shiftedX,
      },
      zoneCircle: shiftedZoneCircle,
    };
  });
};

export function useDefenseSocketSync({
  socket,
  fieldRef,
  outcome,
  defensiveMessage,
  setDefensiveMessage,
  setPlayers,
  setRouteStarted,
  setGameClock,
  gameClockRef,
  gameIntervalRef,
  setQuarter,
  setOutcome,
  setReadyToCatchIds,
  setSackTimeRemaining,
  setCompletedYards,
  setRouteProgress,
  setSelectedPlayerId,
  setSelectedZoneId,
  setDraggingId,
  setOpeness,
  setPaused,
  setLiveCountdown,
  setQbPenalty,
  preSnapRef,
  setCurrentYards,
  setDistance,
  setDown,
  setYardLine,
  setFirstDownStartY,
  setThrownBallLine,
  setPreSnapPlayers,
}) {
  useEffect(() => {
    if (!socket) return;

    const handleCharacterPlaced = (data) => {
      const newPlayer = {
        ...data,
        position: { x: data.position.x, y: data.position.y },
      };

      setPlayers((prevPlayers) => {
        const playerId = data.id || data.playerId;
        const filtered = prevPlayers.filter((p) => p.id !== playerId);
        return [...filtered, newPlayer];
      });
    };

    const handleRouteStarted = (data) => {
      setRouteStarted(data);
      if (!gameIntervalRef.current) {
        gameIntervalRef.current = setInterval(() => {
          gameClockRef.current -= 1000;
          setGameClock(gameClockRef.current);

          if (gameClockRef.current <= 0) {
            clearInterval(gameIntervalRef.current);
            gameIntervalRef.current = null;

            setQuarter((prev) => {
              if (prev < 4) {
                setGameClock(300000);
                gameClockRef.current = 300000;
                return prev + 1;
              }

              setOutcome('Game Over');
              return prev;
            });
          }
        }, 1000);
      }
    };

    const handlePlayerPositionsUpdate = (data) => {
      if (!data.players || data.players.length === 0) return;

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          const updated = data.players.find((p) => p.id === player.id);
          const hasValidPosition =
            updated?.position &&
            typeof updated.position.x === 'number' &&
            typeof updated.position.y === 'number';

          if (updated && hasValidPosition) {
            return {
              ...player,
              position: { ...updated.position },
              routeProgress: updated.routeProgress,
            };
          }

          return player;
        })
      );
    };

    const handleCharacterPositionUpdated = ({ playerId, logicalX, logicalY, normalizedX, normalizedY }) => {
      const nextX = typeof logicalX === 'number' ? logicalX : (normalizedX * LOGICAL_FIELD_WIDTH);
      const nextY = typeof logicalY === 'number' ? logicalY : (normalizedY * LOGICAL_FIELD_HEIGHT);

      if (typeof nextX !== 'number' || Number.isNaN(nextX) || typeof nextY !== 'number' || Number.isNaN(nextY)) {
        return;
      }

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, position: { x: nextX, y: nextY } }
            : p
        )
      );
    };

    const handleReadyToCatch = (ids) => {
      setReadyToCatchIds(new Set(ids));
    };

    const handleRouteAssigned = ({ playerId, routeName }) => {
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, route: routeName } : p)));
    };

    const handleSackTimerUpdate = (data) => {
      setSackTimeRemaining(data);
    };

    const handlePlayOutcome = ({ outcome: playOutcome, completedYards }) => {
      setOutcome(playOutcome);
      setCompletedYards(completedYards);
    };

    const handlePlayReset = (data) => {
      setRouteProgress({});
      setSelectedPlayerId(null);
      setSelectedZoneId(null);
      setDraggingId(null);
      setOpeness('');
      setPaused(false);
      setSackTimeRemaining(0);
      setLiveCountdown(null);
      setQbPenalty(0);
      setRouteStarted(false);
      const alignedPreSnapPlayers = realignTrenchToSpot(preSnapRef.current, data.ballSpotX);
      setPlayers(alignedPreSnapPlayers);
      setOutcome('');
      setCurrentYards(0);
      setDistance(data.newDistance);
      setDown(data.newDown);
      setYardLine(data.newYardLine);
      setFirstDownStartY(data.newFirstDownStartY * (LOGICAL_FIELD_HEIGHT / 40));

      if (
        data.outcome === 'Touchdown!' ||
        data.outcome === 'Safety!' ||
        data.outcome === 'Turnover on Downs' ||
        data.outcome === 'Intercepted'
      ) {
        setPlayers([]);
      }
    };

    const handleBallThrown = (payloadOrX, maybeY) => {
      const normalizedX = typeof payloadOrX === 'object' && payloadOrX !== null
        ? payloadOrX.normalizedX
        : payloadOrX;
      const normalizedY = typeof payloadOrX === 'object' && payloadOrX !== null
        ? payloadOrX.normalizedY
        : maybeY;
      const targetHalf = typeof payloadOrX === 'object' && payloadOrX !== null
        ? payloadOrX.targetHalf
        : 'bottom';

      if (typeof normalizedX !== 'number' || typeof normalizedY !== 'number') {
        return;
      }

      if (outcome !== 'Sacked') {
        setThrownBallLine({
          x: normalizedX * LOGICAL_FIELD_WIDTH,
          y: normalizedY * LOGICAL_FIELD_HEIGHT,
          targetHalf,
        });
      }
    };

    const handlePreSnapPlayers = (data) => {
      const updatedPlayers = data.players.map((p) => ({
        ...p,
        position: { ...p.position },
      }));

      setPreSnapPlayers(updatedPlayers);
      preSnapRef.current = updatedPlayers;
    };

    const handleOffenseSet = () => {
      setDefensiveMessage('Offense is Set');
      setTimeout(() => setDefensiveMessage(''), 10000);
    };

    const handleRemovePlayer = (playerId) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    };

    socket.on('player_removed', handleRemovePlayer);
    socket.on('offense_set', handleOffenseSet);
    socket.on('character_placed', handleCharacterPlaced);
    socket.on('character_position_updated', handleCharacterPositionUpdated);
    socket.on('route_started', handleRouteStarted);
    socket.on('play_reset', handlePlayReset);
    socket.on('ball_thrown', handleBallThrown);
    socket.on('pre_snap_players', handlePreSnapPlayers);
    socket.on('player_positions_update', handlePlayerPositionsUpdate);
    socket.on('ready_to_catch', handleReadyToCatch);
    socket.on('route_assigned', handleRouteAssigned);
    socket.on('play_outcome', handlePlayOutcome);
    socket.on('sack_timer_update', handleSackTimerUpdate);

    return () => {
      socket.off('player_removed', handleRemovePlayer);
      socket.off('offense_set', handleOffenseSet);
      socket.off('character_placed', handleCharacterPlaced);
      socket.off('character_position_updated', handleCharacterPositionUpdated);
      socket.off('route_started', handleRouteStarted);
      socket.off('play_reset', handlePlayReset);
      socket.off('ball_thrown', handleBallThrown);
      socket.off('pre_snap_players', handlePreSnapPlayers);
      socket.off('player_positions_update', handlePlayerPositionsUpdate);
      socket.off('ready_to_catch', handleReadyToCatch);
      socket.off('route_assigned', handleRouteAssigned);
      socket.off('play_outcome', handlePlayOutcome);
      socket.off('sack_timer_update', handleSackTimerUpdate);
    };
  }, [
    socket,
    outcome,
    defensiveMessage,
    fieldRef,
    gameClockRef,
    gameIntervalRef,
    preSnapRef,
    setCompletedYards,
    setCurrentYards,
    setDefensiveMessage,
    setDistance,
    setDown,
    setDraggingId,
    setFirstDownStartY,
    setGameClock,
    setLiveCountdown,
    setOpeness,
    setOutcome,
    setPaused,
    setPlayers,
    setPreSnapPlayers,
    setQbPenalty,
    setQuarter,
    setReadyToCatchIds,
    setRouteProgress,
    setRouteStarted,
    setSackTimeRemaining,
    setSelectedPlayerId,
    setSelectedZoneId,
    setThrownBallLine,
    setYardLine,
  ]);
}
