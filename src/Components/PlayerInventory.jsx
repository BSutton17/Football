import React from 'react';
import { useAppContext } from '../Context/AppContext';
import teamData from '../Teams.json'
import { useHandlerContext } from '../Context/HandlerContext';

const PlayerInventory = ({ players, type }) => {
    const { handleTouchStartCustom } = useHandlerContext()

  return (
    <div className={type + "-inventory"}>
      {players.map((player) => (
        <div
          key={player.id}
          className={`inventory-player ${type}`}
          draggable={true}
          onTouchStart={(e) => {
            const dataWithType = { ...player, type };
            handleTouchStartCustom(e, dataWithType); // pass full event
            }}

          onDragStart={(e) => {
            const dataWithType = { ...player, type };
            e.dataTransfer.setData('application/json', JSON.stringify(dataWithType));
          }}
        >
          {player.speed} ({player.id})
        </div>
      ))}
    </div>
  );
};

export default PlayerInventory;
