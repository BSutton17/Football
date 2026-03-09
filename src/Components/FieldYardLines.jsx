import React from 'react';

function FieldYardLines({ oneYardInPixels, yardLine }) {
  return Array.from({ length: 41 }).flatMap((_, i) => {
    const top = i * oneYardInPixels;
    const offset = yardLine % 5;
    const isFiveYardLine = i % 5 - offset === 0;

    const yardNumber = yardLine - i + 20;
    const newYardNumber = yardNumber <= 50 ? yardLine - i + 20 : 100 - (yardLine - i + 20);
    const isTenYardLine = newYardNumber % 10 === 0 && newYardNumber !== 0;

    const lines = [];

    if (isFiveYardLine) {
      lines.push(
        <div
          key={`yard-line-full-${i}`}
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: 0,
            width: '100%',
            height: '2px',
            backgroundColor: 'white',
            zIndex: 1,
          }}
        />
      );
    } else {
      lines.push(
        <div
          key={`yard-line-tick-left-edge-${i}`}
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: '0%',
            width: '3%',
            height: '2px',
            backgroundColor: 'white',
            zIndex: 1,
          }}
        />,
        <div
          key={`yard-line-tick-right-edge-${i}`}
          style={{
            position: 'absolute',
            top: `${top}px`,
            right: '0%',
            width: '3%',
            height: '2px',
            backgroundColor: 'white',
            zIndex: 1,
          }}
        />,
        <div
          key={`yard-line-tick-left-inner-${i}`}
          style={{
            position: 'absolute',
            top: `${top}px`,
            left: '30%',
            width: '3%',
            height: '2px',
            backgroundColor: 'white',
            zIndex: 1,
          }}
        />,
        <div
          key={`yard-line-tick-right-inner-${i}`}
          style={{
            position: 'absolute',
            top: `${top}px`,
            right: '30%',
            width: '3%',
            height: '2px',
            backgroundColor: 'white',
            zIndex: 1,
          }}
        />
      );
    }

    if (isTenYardLine) {
      lines.push(
        <div
          key={`yard-line-number-left-${i}`}
          style={{
            position: 'absolute',
            top: `calc(${top}px - 2.5vh)`,
            left: '5px',
            color: 'white',
            fontSize: '150%',
            fontWeight: 'bold',
            userSelect: 'none',
            rotate: '90deg',
            zIndex: 2,
          }}
        >
          {newYardNumber}
        </div>,
        <div
          key={`yard-line-number-right-${i}`}
          style={{
            position: 'absolute',
            top: `calc(${top}px - 2.5vh)`,
            right: '5px',
            color: 'white',
            fontSize: '150%',
            fontWeight: 'bold',
            userSelect: 'none',
            rotate: '-90deg',
            zIndex: 2,
          }}
        >
          {newYardNumber}
        </div>
      );
    }

    return lines;
  });
}

export default FieldYardLines;
