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
  const dropX = initialX - rect.left;
  let dropY = initialY - rect.top;
  const half = fieldSize.height / 2;

  if (draggingId?.startsWith('O') && dropY < half) return;
  if (draggingId?.startsWith('D') && dropY > half) return;

  let updatedPlayer = null;
  let updatedZone = null;

  setPlayers((prev) =>
    prev.map((p) => {
      // Handle player movement
      if (p.id === draggingId) {
        let newPosition = {};

        if (draggingId.startsWith('O')) {
          newPosition = { x: dropX, y: dropY - (half - half / 15) };
        } else if (draggingId.startsWith('D')) {
          newPosition = { x: dropX, y: dropY - half / 15 };
        }

        updatedPlayer = { ...p, position: newPosition };
        return updatedPlayer;
      }

      // Handle zone circle movement
      if (p.zoneCircle && p.zoneCircle.id === draggingId) {
        let newZone = p.zone;
        const bottom = fieldSize.height / 2;
        const flatThreshold = bottom * (2 / 3);
        const midThreshold = bottom * (1 / 3);
        const leftBound = fieldSize.width / 3;
        const rightBound = (fieldSize.width / 3) * 2;

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

  const handleTouchStart = (e, id) => {
    e.preventDefault();
    setDraggingId(id);
    setSelectedPlayerId(null);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!draggingId || !fieldRef.current) return;

    const touch = e.touches[0];
    const rect = fieldRef.current.getBoundingClientRect();

    // Track for drop later
    if (touchedPlayerRef.current) {
      touchedPlayerRef.current.lastTouch = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    placePlayers(touch.clientX, touch.clientY, rect);
  };

  const handleTouchEnd = () => {
    if (touchedPlayerRef.current && touchedPlayerRef.current.lastTouch) {
      const { x, y } = touchedPlayerRef.current.lastTouch;
      const rect = fieldRef.current.getBoundingClientRect();

      handleDropOnFieldTouch(
        touchedPlayerRef.current,
        x - rect.left,
        y - rect.top
      );

      touchedPlayerRef.current = null;
    }

    if (draggingId !== null) {
      setSelectedPlayerId(draggingId);
    }

    setDraggingId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleTouchStartCustom = (e, data) => {
    e.preventDefault();
    setDraggingId(data.id);
    setSelectedPlayerId(null);
    touchedPlayerRef.current = { ...data };
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
          newY = y / 3;
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
        position: { x, y: newY },
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
          position: { x, y: newY },
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
        case "S":
          newY = y;
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
        position: { x, y: newY },
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
