import { useEffect } from 'react';

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
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
      const pixelX = data.position.x * rect.width;
      const pixelY = data.position.y * rect.height;

      const newPlayer = {
        ...data,
        position: { x: pixelX, y: pixelY },
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
          if (updated) {
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
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
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
      setPlayers(preSnapRef.current);
      setOutcome('');
      setCurrentYards(0);
      setDistance(data.newDistance);
      setDown(data.newDown);
      setYardLine(data.newYardLine);
      setFirstDownStartY(data.newFirstDownStartY * (rect.height / 40));

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
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
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
        const pixelX = normalizedX * rect.width;
        const pixelY = normalizedY * rect.height;
        setThrownBallLine({ x: pixelX, y: pixelY, targetHalf });
      }
    };

    const handlePreSnapPlayers = (data) => {
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
      const updatedPlayers = data.players.map((p) => ({
        ...p,
        position: {
          x: p.position.x * rect.width,
          y: p.position.y * rect.height,
        },
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
