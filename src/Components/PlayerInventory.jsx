import React from 'react';
import { useAppContext } from '../Context/AppContext';
import teamData from '../Teams.json'
import { useHandlerContext } from '../Context/HandlerContext';
import { useState } from 'react';

const PlayerInventory = ({ players, type }) => {
    const { handleTouchStartCustom } = useHandlerContext()
    const [showInv, setShowInv] = useState(true);

  return (
      <div className="inventory-container">
    {showInv ? (
      <div className={type + "-inventory"}>
        <div className='inventory-menu'>
        <h4 className="x-out" onClick={() => setShowInv(!showInv)}>X</h4>
        </div>
        {players.map((player) => (
          <div
            key={player.id}
            className={`inventory-player ${type}`}
            draggable={true}
            onTouchStart={(e) => {
              const dataWithType = { ...player, type };
              handleTouchStartCustom(e, dataWithType);
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
    ) : (
      <>
      <button className='show-inv' onClick={() => setShowInv(!showInv)}>Show Inventory</button>
      </>
    )}
  </div>

  );
};

export default PlayerInventory;
