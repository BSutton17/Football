import React, { createContext, useContext, useRef } from 'react';
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
    selectedZoneId,
    setSelectedZoneId,
    setInventory,
    socket,
    roomId
  } = useAppContext();

  const placePlayers = (initialX, initialY, rect) => {
    if (!draggingId) return; // safety check

    const dropX = initialX - rect.left;
    let dropY = initialY - rect.top;
    const half = fieldSize.height / 2;

    // Enforce team side boundaries
    if (draggingId.startsWith('O') && dropY < half) return;
    if (draggingId.startsWith('D') && dropY > half) return;

    let updatedPlayer = null;
    let updatedZone = null;

    setPlayers((prev) =>
      prev.map((p) => {
        // Move the dragged player only
        if (p.id === draggingId) {
          let newPosition;

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

        // Handle zone circle drag only if the dragged id matches the zoneCircle.id
        if (p.zoneCircle && p.zoneCircle.id === draggingId) {
          const bottom = half;
          const flatThreshold = bottom * (2 / 3);
          const midThreshold = bottom * (1 / 3);
          const leftBound = fieldSize.width / 3;
          const rightBound = (fieldSize.width / 3) * 2;

          let newZone = p.zone;

          if (dropY > flatThreshold) {
            const middleFlat = dropX >= leftBound && dropX <= rightBound;
            newZone = middleFlat ? 'hook' : 'flat';
          } else if (dropY > midThreshold) {
            newZone = dropX < leftBound || dropX > rightBound ? 'cloud' : 'hook';
          } else {
            newZone = 'deep';
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

          return {
            ...p,
            zone: newZone,
            zoneCircle: updatedZone.zoneCircle,
          };
        }

        return p;
      })
    );

    // Emit socket updates after state changes
    if (updatedPlayer) {
      socket.emit("update_character_position", {
        playerId: updatedPlayer.id,
        position: updatedPlayer.position,
        room: roomId,
      });
    }

    if (updatedZone) {
      socket.emit("zone_area_assigned", {
        playerId: updatedZone.playerId,
        zoneType: updatedZone.zoneType,
        zoneCircle: updatedZone.zoneCircle,
        room: roomId,
      });
    }
  };


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

      touchedPlayerRef.current = null;
    }

    if (draggingId !== null) {
      setSelectedPlayerId(draggingId);
    }

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


  // const handleTouchEnd = () => {
  //   if (touchedPlayerRef.current && touchedPlayerRef.current.lastTouch) {
  //     const { x, y } = touchedPlayerRef.current.lastTouch;
  //     const rect = fieldRef.current.getBoundingClientRect();

  //     // Check if this was a NEW player (not on field yet)
  //     const isExistingPlayer = players.some(p => p.id === touchedPlayerRef.current.id);

  //     if (!isExistingPlayer) {
  //       handleDropOnFieldTouch(
  //         touchedPlayerRef.current,
  //         x - rect.left,
  //         y - rect.top
  //       );
  //     }

  //     touchedPlayerRef.current = null;
  //   }

  //   if (draggingId !== null) {
  //     setSelectedPlayerId(draggingId);
  //   }

  //   setDraggingId(null);
  // };

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
    handleDropOnField(playerData, x, height);
  };

    const handleDropOnField = (playerData, x, y) => {
      console.log("Y: " + y + ", height: " + fieldSize.height)
      const role = playerData.role;
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
          newY = y / 2.5;
          break;
        case "S":
          newY = y / 6;
          break;
        default:
          newY = y / 10;
      }

      const isOffense = playerData.type == "offense"

      const newPlayer = {
        ...playerData,
        position: { x, y: newY },
        isOffense,
        route: null,
        hasCut: false,
      }
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

      if (isOffense) {
        socket.emit("place_character", {
          ...playerData,
          position: { x, y: newY },
          isOffense,
          room: roomId,
        });
      } else {
        socket.emit("place_character", {
          ...playerData,
          position: { x, y: newY},
          isOffense: false,
          zone: null,
          assignedOffensiveId: null,
          room: roomId,
        });
      }


    };

const handleDropOnFieldTouch = (playerData, x, y) => {
  const role = playerData.role;
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
    default:
      newY = y / 10;
  }

  const isOffense = playerData.type === "offense";

  setPlayers((prev) => {
    const playerExists = prev.find((p) => p.id === playerData.id);
    if (playerExists) {
      // Update existing player immutably with new position object
      return prev.map((p) =>
        p.id === playerData.id
          ? {
              ...p,
              position: isOffense ? { x, y: newY } : { x, y },
              // Keep other props intact or update if needed
              route: null,
              hasCut: false,
              zone: isOffense ? p.zone : null,
              assignedOffensiveId: isOffense ? p.assignedOffensiveId : null,
            }
          : p
      );
    } else {
      // Add new player with fresh position object
      const newPlayer = isOffense
        ? {
            ...playerData,
            position: { x, y: newY },
            isOffense,
            route: null,
            hasCut: false,
          }
        : {
            ...playerData,
            position: { x, y: newY },
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
    [playerData.type]: prev[playerData.type].filter((p) => p.id !== playerData.id),
  }));

  // Emit socket event with fresh position object
  if (isOffense) {
    socket.emit("place_character", {
      ...playerData,
      position: { x, y: newY },
      isOffense,
      room: roomId,
    });
  } else {
    socket.emit("place_character", {
      ...playerData,
      position: { x, y: newY },
      isOffense: false,
      zone: null,
      assignedOffensiveId: null,
      room: roomId,
    });
  }
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
