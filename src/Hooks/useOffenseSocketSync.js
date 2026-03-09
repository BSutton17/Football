import { useEffect } from 'react';

export function useOffenseSocketSync({
  socket,
  fieldRef,
  setPlayers,
  setRouteStarted,
  setOutcome,
  stopAllPlayerMovement,
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

    const handlePlayStopped = () => {
      stopAllPlayerMovement();
      setRouteStarted(false);
      setOutcome('');
    };

    const handleZoneAssigned = ({ playerId, zoneType, zoneCircle, assignedOffensiveId }) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === playerId) {
            if (zoneType === 'man') {
              return {
                ...p,
                zone: 'man',
                assignedOffensiveId,
                zoneCircle: null,
                hasCut: false,
              };
            }

            return {
              ...p,
              zone: zoneType,
              zoneCircle,
              assignedOffensiveId: null,
              hasCut: false,
            };
          }

          return p;
        })
      );
    };

    const handleCharacterPositionUpdated = ({ playerId, normalizedX, normalizedY }) => {
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };
      const pixelX = normalizedX * rect.width;
      const pixelY = normalizedY * rect.height;

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, position: { x: pixelX, y: pixelY } }
            : p
        )
      );
    };

    const handleZoneDefenderUpdate = (data) => {
      if (!data || !data.playerId || !data.position) return;

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          if (player.id === data.playerId && player.zone !== 'man') {
            return {
              ...player,
              position: { ...data.position },
            };
          }

          return player;
        })
      );
    };

    const handleZoneAreaUpdate = (data) => {
      const { playerId, zoneType, zoneCircle } = data;
      const rect = fieldRef.current?.getBoundingClientRect() || { width: 1, height: 1 };

      const pixelX = zoneCircle.x * rect.width;
      const pixelY = zoneCircle.y * rect.height;

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) => {
          if (player.id === playerId) {
            return {
              ...player,
              zone: zoneType,
              zoneCircle: {
                ...zoneCircle,
                x: pixelX,
                y: pixelY,
              },
            };
          }

          return player;
        })
      );
    };

    const handleRemovePlayer = (playerId) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
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

    socket.on('player_removed', handleRemovePlayer);
    socket.on('zone_area_assigned', handleZoneAreaUpdate);
    socket.on('zone_defender_position_update', handleZoneDefenderUpdate);
    socket.on('character_position_updated', handleCharacterPositionUpdated);
    socket.on('character_placed', handleCharacterPlaced);
    socket.on('zone_assigned', handleZoneAssigned);
    socket.on('play_stopped', handlePlayStopped);
    socket.on('player_positions_update', handlePlayerPositionsUpdate);

    return () => {
      socket.off('player_removed', handleRemovePlayer);
      socket.off('zone_area_assigned', handleZoneAreaUpdate);
      socket.off('zone_defender_position_update', handleZoneDefenderUpdate);
      socket.off('character_position_updated', handleCharacterPositionUpdated);
      socket.off('character_placed', handleCharacterPlaced);
      socket.off('zone_assigned', handleZoneAssigned);
      socket.off('play_stopped', handlePlayStopped);
      socket.off('player_positions_update', handlePlayerPositionsUpdate);
    };
  }, [socket, fieldRef, setOutcome, setPlayers, setRouteStarted, stopAllPlayerMovement]);
}
