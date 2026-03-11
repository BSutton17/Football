import { useEffect } from 'react';

const LOGICAL_FIELD_WIDTH = 800;
const LOGICAL_FIELD_HEIGHT = 600;

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
      // Treat all received positions as logical units (0-800, 0-600)
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

    const handleCharacterPositionUpdated = ({ playerId, logicalX, logicalY, normalizedX, normalizedY }) => {
      const nextX = typeof logicalX === 'number' ? logicalX : (normalizedX * LOGICAL_FIELD_WIDTH);
      const nextY = typeof logicalY === 'number' ? logicalY : (normalizedY * LOGICAL_FIELD_HEIGHT);

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, position: { x: nextX, y: nextY } }
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
      const pixelX = typeof zoneCircle.x === 'number' ? zoneCircle.x : 0;
      const pixelY = typeof zoneCircle.y === 'number' ? zoneCircle.y : 0;

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
