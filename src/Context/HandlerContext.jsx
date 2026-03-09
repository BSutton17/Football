import React, { createContext, useContext, useRef } from 'react';
import { useAppContext } from './AppContext';

const noop = () => {};

const defaultHandlerContextValue = {
  handleMouseDown: noop,
  handleMouseMove: noop,
  handleMouseUp: noop,
  handleTouchStart: noop,
  handleTouchMove: noop,
  handleTouchEnd: noop,
  handleDragOver: noop,
  handleDrop: noop,
  handleTouchStartCustom: noop,
};

const HandlerContext = createContext(defaultHandlerContextValue);

export const HandlerProvider = ({ children }) => {
  const touchedPlayerRef = useRef(null);
  const {
    setPlayers,
    draggingId,
    setDraggingId,
    fieldRef,
    setSelectedPlayerId,
    isOffense,
    setSelectedZoneId,
    setInventory,
    socket,
    roomId,
    players,
    isSetClicked
  } = useAppContext();

  const getRoleDropY = (role, dropY, yValue) => {
    switch (role) {
      case 'WR':
        return dropY / 32;
      case 'RB':
        return dropY / 6;
      case 'TE':
        return dropY / 20;
      case 'LB':
      case 'CB':
      case 'S':
        return yValue;
      default:
        return dropY / 10;
    }
  };

  const placePlayers = (initialX, initialY, rect) => {
    if (!draggingId) return;

    // Calculate drop position relative to the field's bounding rect
    const dropX = initialX - rect.left;
    const dropY = initialY - rect.top;

    const half = rect.height / 2;

    // Enforce team side boundaries
    if (draggingId.startsWith("O") && dropY < half) return;
    if (draggingId.startsWith("D") && dropY > half) return;

    let updatedPlayer = null;
    let emittedPlayerPosition = null;
    let updatedZone = null;
    let updatedZoneEmit = null;

    if (!draggingId?.startsWith('DZ')) {
      if (draggingId.startsWith('O')) {
        emittedPlayerPosition = { x: dropX, y: dropY - (half - half / 15) };
      } else if (draggingId.startsWith('D')) {
        emittedPlayerPosition = { x: dropX, y: dropY - half / 15 };
      } else {
        emittedPlayerPosition = { x: dropX, y: dropY };
      }
    }

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === draggingId) {
          let newPosition;
          // Update player position with normalized coords
          if (draggingId.startsWith('O')) {
            newPosition = { x: dropX, y: dropY - (half - half / 15) };
          } else if (draggingId.startsWith('D')) {
            newPosition = { x: dropX, y: dropY - half / 15 };
          } else {
            newPosition = { x: dropX, y: dropY };
          }

          updatedPlayer = { ...p, position: newPosition };
          return updatedPlayer;
        }

        if (p.zoneCircle && p.zoneCircle.id === draggingId) {
          const bottom = half;
          const flatThreshold = bottom * (2 / 3);
          const midThreshold = bottom * (1 / 3);
          const leftBound = rect.width / 3;
          const rightBound = (rect.width / 3) * 2;

          let newZone = p.zone;

          if (dropY > flatThreshold) {
            const middleFlat = dropX >= leftBound && dropX <= rightBound;
            newZone = middleFlat ? "hook" : "flat";
          } else if (dropY > midThreshold) {
            newZone = dropX < leftBound || dropX > rightBound ? "cloud" : "hook";
          } else {
            newZone = "deep";
          }

          updatedZone = {
            playerId: p.id,
            zoneType: newZone,
            zoneCircle: {
              ...p.zoneCircle,
              x: dropX,
              y: dropY,
            },
          };

          updatedZoneEmit = {
            playerId: p.id,
            zoneType: newZone,
            zoneCircle: {
              ...p.zoneCircle,
              x: dropX / rect.width,
              y: dropY / rect.height,
            },
          };

          return {
            ...p,
            zone: newZone,
            zoneCircle: updatedZone.zoneCircle,
          };
        }

        return p;
      })
    );

    // Emit updated player position
    if (updatedPlayer) {
      socket.emit("update_character_position", {
        playerId: updatedPlayer.id,
        normalizedX: (emittedPlayerPosition?.x ?? updatedPlayer.position.x) / rect.width,
        normalizedY: (emittedPlayerPosition?.y ?? updatedPlayer.position.y) / rect.height,
        isOffense: isOffense,
        room: roomId,
      });
    }

    // Emit updated zone info
    if (updatedZoneEmit) {
      socket.emit("zone_area_assigned", {
        playerId: updatedZoneEmit.playerId,
        zoneType: updatedZoneEmit.zoneType,
        zoneCircle: updatedZoneEmit.zoneCircle,
        room: roomId,
      });
    }
  }

  const handleMouseDown = (e, id) => {
    if (isOffense && isSetClicked) return; // disable drag
    e.preventDefault();
    setDraggingId(id);
    setSelectedPlayerId(null);
    setSelectedZoneId(null);
  };

  const handleMouseMove = (e) => {
    if (!draggingId || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    placePlayers(e.clientX, e.clientY, rect);
  };

  const handleMouseUp = () => {
    if (draggingId?.startsWith('D-') || draggingId?.startsWith('O')) {
      setSelectedPlayerId(draggingId);
    } else if (draggingId?.startsWith('DZ')) {
      setSelectedZoneId(draggingId);
    }
    setDraggingId(null);
  };

  const handleTouchEnd = () => {
    if (draggingId?.startsWith('D-') || draggingId?.startsWith('O')) {
      setSelectedPlayerId(draggingId);
    } else if (draggingId?.startsWith('DZ')) {
      setSelectedZoneId(draggingId);
    }

    if (touchedPlayerRef.current && touchedPlayerRef.current.lastTouch) {
      const { x, y } = touchedPlayerRef.current.lastTouch;
      const rect = fieldRef.current.getBoundingClientRect();

      // Check if this was a NEW player (not on field yet)
      const isExistingPlayer = players.some(p => p.id === touchedPlayerRef.current.id);

      if (!isExistingPlayer && !draggingId?.startsWith('DZ')) {
        const dropX = x - rect.left;
        const dropY = y - rect.top;
        handleDropOnFieldTouch(
          touchedPlayerRef.current,
          dropX,
          dropY,
          dropY,
          rect
        );
      }
    }

    touchedPlayerRef.current = null;
    setDraggingId(null);
  };

  const handleTouchStart = (e, id) => {
    if (isOffense && isSetClicked) return; // disable drag
    e.preventDefault();
    setDraggingId(id);
    setSelectedPlayerId(null);
    touchedPlayerRef.current = {
      id,
      startTouch: null,
      lastTouch: null,
      wasDragged: false,
    };
  };


  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!draggingId || !fieldRef.current) return;


    const touch = e.touches[0];
    const rect = fieldRef.current.getBoundingClientRect();

    const currentTouch = {
      x: touch.clientX,
      y: touch.clientY,
    };

    // Store lastTouch and also detect actual movement
    if (touchedPlayerRef.current) {
      const start = touchedPlayerRef.current.startTouch;
      if (!start) {
        touchedPlayerRef.current.startTouch = currentTouch;
      } else {
        const dx = currentTouch.x - start.x;
        const dy = currentTouch.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        touchedPlayerRef.current.wasDragged = distance > 5; // 5px threshold
      }

      touchedPlayerRef.current.lastTouch = currentTouch;
    }

    placePlayers(touch.clientX, touch.clientY, rect);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleTouchStartCustom = (e, data) => {
    e.preventDefault();
    setDraggingId(data.id);
    setSelectedPlayerId(null);
    touchedPlayerRef.current = {
      ...data,
      startTouch: null,
      lastTouch: null,
      wasDragged: false,
    };
  };

  const handleDrop = (e, height) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    const rect = fieldRef.current.getBoundingClientRect();
    const playerData = JSON.parse(data);
    const x = e.clientX - rect.left;
    const yValue = e.clientY - rect.top;
    handleDropOnField(playerData, x, height, yValue, rect);
  };

  const handleDropOnField = (playerData, x, y, yValue, rect) => {
    const role = playerData.role;

    const normalizedX = x / rect.width;
    const newY = getRoleDropY(role, y, yValue);

    const normalizedY = newY / rect.height;

    const isOffense = playerData.type === "offense";

    const normalizedPosition = { x: normalizedX, y: normalizedY };

    const newPlayer = {
      ...playerData,
      position: { x, y: newY},
      isOffense,
      route: null,
      hasCut: false,
    };

    const newDPlayer = {
      ...playerData,
      zone: null,
      isOffense,
      route: null,
      assignedOffensiveId: null,
      hasCut: false,
      position: { x, y: newY},
    };

    setPlayers((prev) => [...prev, isOffense ? newPlayer : newDPlayer]);

    setInventory((prev) => ({
      ...prev,
      [playerData.type]: prev[playerData.type].filter(
        (p) => p.id !== playerData.id
      ),
    }));

    socket.emit("place_character", {
      ...playerData,
      position: normalizedPosition,
      isOffense,
      zone: isOffense ? undefined : null,
      assignedOffensiveId: isOffense ? undefined : null,
      room: roomId,
    });
  };

  const handleDropOnFieldTouch = (playerData, x, y, yValue, rect) => {
    const role = playerData.role;

    const normalizedX = x / rect.width;
    const newY = getRoleDropY(role, y, yValue);

    const normalizedY = newY / rect.height;

    const isOffense = playerData.type === "offense";

    const normalizedPosition = { x: normalizedX, y: normalizedY };

    setPlayers((prev) => {
      const playerExists = prev.find((p) => p.id === playerData.id);
      if (playerExists) {
        return prev.map((p) =>
          p.id === playerData.id
            ? {
                ...p,
                position: { x, y: newY},
                route: null,
                hasCut: false,
                zone: isOffense ? p.zone : null,
                assignedOffensiveId: isOffense ? p.assignedOffensiveId : null,
              }
            : p
        );
      } else {
        const newPlayer = isOffense
          ? {
              ...playerData,
              position: { x, y: newY},
              isOffense,
              route: null,
              hasCut: false,
            }
          : {
              ...playerData,
              position: { x, y: newY},
              zone: null,
              isOffense,
              route: null,
              assignedOffensiveId: null,
              hasCut: false,
            };

        return [...prev, newPlayer];
      }
    });
    if(!draggingId?.startsWith('DZ')){
    setInventory((prev) => ({
      ...prev,
      [playerData.type]: prev[playerData.type].filter(
        (p) => p.id !== playerData.id
      ),
    }));
  }
    socket.emit("place_character", {
      ...playerData,
      position: normalizedPosition,
      isOffense,
      zone: isOffense ? undefined : null,
      assignedOffensiveId: isOffense ? undefined : null,
      room: roomId,
    });
  };

  return (
    <HandlerContext.Provider
      value={{
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleDragOver,
        handleDrop,
        handleTouchStartCustom,
      }}
    >
      {children}
    </HandlerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useHandlerContext = () => useContext(HandlerContext) || defaultHandlerContextValue;
