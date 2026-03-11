import React, { useMemo, useState } from 'react';
import { useHandlerContext } from '../Context/HandlerContext';

const PlayerInventory = ({ players, type }) => {
  const { handleTouchStartCustom } = useHandlerContext();
  const [showInv, setShowInv] = useState(true);
  const [selectedRole, setSelectedRole] = useState('ALL');

  const roles = useMemo(() => {
    const uniqueRoles = Array.from(new Set(players.map((player) => player.role).filter(Boolean)));
    return ['ALL', ...uniqueRoles.sort()];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => selectedRole === 'ALL' || player.role === selectedRole);
  }, [players, selectedRole]);

  const getOverall = (player) => {
    if (typeof player.overall === 'number') return Math.round(player.overall);

    const candidateRatings = [
      player.speed,
      player.acceleration,
      player.routeRunning,
      player.blocking,
      player.blitzing,
      player.reactionTime,
      player.strength,
    ].filter((value) => typeof value === 'number');

    if (candidateRatings.length === 0) return '--';
    const average = candidateRatings.reduce((sum, value) => sum + value, 0) / candidateRatings.length;
    return Math.round(average);
  };

  return (
    <div className="inventory-container">
      {showInv ? (
        <div className={`${type}-inventory inventory-panel`}>
          <div className="inventory-header">
            <div className="inventory-title-wrap">
              <h4 className="inventory-title">{type === 'offense' ? 'Offense' : 'Defense'} Inventory</h4>
              <span className="inventory-count">{filteredPlayers.length}/{players.length}</span>
            </div>
            <button className="inventory-collapse" onClick={() => setShowInv(false)} aria-label="Collapse inventory">Hide</button>
          </div>

          <div className="inventory-controls">
            <div className="inventory-role-list">
              {roles.map((role) => (
                <button
                  key={role}
                  className={`inventory-role-chip ${selectedRole === role ? 'active' : ''}`}
                  onClick={() => setSelectedRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="inventory-grid">

            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className={`inventory-player-card inventory-player ${type}`}
                draggable={true}
                onTouchStart={(event) => {
                  const dataWithType = { ...player, type };
                  handleTouchStartCustom(event, dataWithType);
                }}
                onDragStart={(event) => {
                  const dataWithType = { ...player, type };
                  event.dataTransfer.setData('application/json', JSON.stringify(dataWithType));
                }}
              >
                <div className="inventory-player-image-slot" aria-hidden="true" />
                <div className="inventory-player-meta">
                  <span className="inventory-player-overall">{getOverall(player)} OVR - <span className="inventory-player-role">{player.role}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button className="show-inv" onClick={() => setShowInv(true)}>Show Inventory</button>
      )}
    </div>
  );
};

export default PlayerInventory;
