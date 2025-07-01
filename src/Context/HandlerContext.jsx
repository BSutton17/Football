import React, { createContext, useContext, useRef, useEffect } from 'react';
import { useAppContext } from './AppContext';

const HandlerContext = createContext();

export const HandlerProvider = ({ children }) => {
  const touchedPlayerRef = useRef(null);
  const {
    setPlayers,
    draggingId,
    setDraggingId,
    fieldRef,
    setSelectedPlayerId,
    fieldSize,
    isOffense,
    setSelectedZoneId,
    setInventory,
    socket,
    roomId,
    preSnapPlayers
  } = useAppContext();

  const placePlayers = (initialX, initialY, rect) => {
    if (!draggingId) return;

    // Calculate drop position relative to the field's bounding rect
    const dropX = initialX - rect.left;
    const dropY = initialY - rect.top;

    // Normalize drop position (relative to field width/height)
    const normalizedX = dropX / rect.width;
    const normalizedY = dropY / rect.height;

    const half = rect.height / 2;

    // Enforce team side boundaries
    if (draggingId.startsWith("O") && dropY < half) return;
    if (draggingId.startsWith("D") && dropY > half) return;

    let updatedPlayer = null;
    let updatedZone = null;
    let updatedZoneEmit = null;

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
        normalizedX: normalizedX,
        normalizedY: normalizedY,
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
    e.preventDefault();
    setDraggingId(id);
    setSelectedPlayerId(null);
    setSelectedZoneId(null);
    console.log("draggingId: " + draggingId)
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

      if (!isExistingPlayer) {
        handleDropOnFieldTouch(
          touchedPlayerRef.current,
          x - rect.left,
          y - rect.top
        );
      }
    }

    touchedPlayerRef.current = null;
    setDraggingId(null);
  };

  const handleTouchStart = (e, id) => {
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

    let newY;

    switch (role) {
      case "WR":
        newY = y / 32;
        break;
      case "RB":
        newY = y / 6;
        break;
      case "TE":
        newY = y / 20;
        break;
      case "LB":
      case "CB":
      case "S":
        newY = yValue;
        break;
      default:
        newY = y / 10;
    }

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

  const handleDropOnFieldTouch = (playerData, x, y) => {
    const role = playerData.role;

    const normalizedX = x / fieldSize.width;

    let newY;

    switch (role) {
      case "WR":
        newY = y / 20;
        break;
      case "RB":
        newY = y / 4;
        break;
      case "TE":
        newY = y / 10;
        break;
      case "LB":
      case "CB":
        newY = y / 2.5;
        break;
      case "S":
        newY = y / 5.5;
        break;
      default:
        newY = y / 10;
    }

    const normalizedY = newY / fieldSize.height;

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



  let animationFrameId;

  const startAnimation = () => {
    animationFrameId = requestAnimationFrame(animate);
  };

  const stopAnimation = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
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
        startAnimation,
        stopAnimation,
        handleDragOver,
        handleDrop,
        handleTouchStartCustom,
      }}
    >
      {children}
    </HandlerContext.Provider>
  );
};

export const useHandlerContext = () => useContext(HandlerContext);
