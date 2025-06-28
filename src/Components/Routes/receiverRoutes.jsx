// ReceiverRoutes.jsx
import React from 'react';

const ReceiverRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize }) => {
  return (
    <div className="route-buttons">
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'corner')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y - offsetY,
        }}
      >
        Corner
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'go')}
        style={{
          left: player.position.x,
          top: player.position.y - offsetY,
        }}
      >
        Go
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'post')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y - offsetY,
        }}
      >
        Post
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'in')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y,
        }}
      >
        In
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'curl')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Curl
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'slant')}
        style={{
          left: player.position.x,
          top: player.position.y + offsetY,
        }}
      >
        Slant
      </button>
      <button
        className="route-btn"
        id="comeback"
        onClick={() => assignRoute(player.id, 'comeback')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Comeback
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'out')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y,
        }}
      >
        Out
      </button>
    </div>
  );
};

export default ReceiverRoutes;
