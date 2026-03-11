// ReceiverRoutes.jsx
import React from 'react';

const ReceiverRoutes = ({ player, assignRoute, offsetX, offsetY, fieldSize, moreRoutes }) => {
  const screenX = (player.position.x / 800) * fieldSize.width;
  const screenY = (player.position.y / 600) * fieldSize.height;
  const isLeftAligned = player.position.x < 400;

  return (
    <div className="route-buttons">
      {!moreRoutes ? (
      <>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'corner')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY - offsetY,
        }}
      >
        Corner
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'go')}
        style={{
          left: screenX,
          top: screenY - offsetY,
        }}
      >
        Go
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'post')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY - offsetY,
        }}
      >
        Post
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'in')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY,
        }}
      >
        In
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'curl')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Curl
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'slant')}
        style={{
          left: screenX,
          top: screenY + offsetY,
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
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Comeback
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'out')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY,
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
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY - offsetY,
        }}
      >
        Speed Out
      </button>
      <button
        className="route-btn"
        id="smaller"
        onClick={() => assignRoute(player.id, 'Double Move')}
        style={{
          left: screenX,
          top: screenY - offsetY,
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
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY - offsetY,
        }}
      >
        Deep Cross
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'drag')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY,
        }}
      >
        Drag
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'return')}
        style={{
          left:
            !isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Return
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'fade')}
        style={{
          left: screenX,
          top: screenY + offsetY,
        }}
      >
        Fade
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'flat')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY + offsetY,
        }}
      >
        Flat
      </button>
      <button
        className="route-btn"
        onClick={() => assignRoute(player.id, 'zig')}
        style={{
          left:
            isLeftAligned
              ? screenX - offsetX
              : screenX + offsetX,
          top: screenY,
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
