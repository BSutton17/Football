// ReceiverRoutes.jsx
import React from 'react';

const ReceiverRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize, moreRoutes }) => {
  return (
    <div className="route-buttons">
      {!moreRoutes ? (
      <>
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
        id="smaller"
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
      </>
      ) : (
      <>
      <button
        className="route-btn"
        id="smaller"
        onClick={() => assignRoute(player.id, 'speed out')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y - offsetY,
        }}
      >
        Speed Out
      </button>
      <button
        className="route-btn"
        id="smaller"
        onClick={() => assignRoute(player.id, 'Double Move')}
        style={{
          left: player.position.x,
          top: player.position.y - offsetY,
        }}
      >
        Double Move
      </button>
      <button
        className="route-btn"
        id="smaller"
        onClick={() => assignRoute(player.id, 'Deep Cross')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y - offsetY,
        }}
      >
        Deep Cross
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'drag')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y,
        }}
      >
        Drag
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'return')}
        style={{
          left:
            player.position.x > fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Return
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'fade')}
        style={{
          left: player.position.x,
          top: player.position.y + offsetY,
        }}
      >
        Fade
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'flat')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y + offsetY,
        }}
      >
        Flat
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'zig')}
        style={{
          left:
            player.position.x < fieldSize.width / 2
              ? player.position.x - offsetX
              : player.position.x + offsetX,
          top: player.position.y,
        }}
      >
        Zig
      </button>
      </>
      )}
    </div>
  );
};

export default ReceiverRoutes;
