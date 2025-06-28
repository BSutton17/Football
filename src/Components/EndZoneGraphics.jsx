// EndZoneGraphics.jsx
import React from 'react';

const EndZoneGraphics = ({ oneYardInPixels, yardLine}) => {
    
  const offsetFromTop = yardLine <= 90 ? 0 : (yardLine - 90) * oneYardInPixels;
  const offsetFromBottom = yardLine >= 10 ? 0 : (10 - yardLine) * oneYardInPixels;
  const yardsPast80 = Math.max(0, yardLine - 80);
  const visibleYards = Math.min(10, yardsPast80);
  const visibleEndZoneHeightTop = visibleYards * oneYardInPixels;
  const yardsBefore20 = Math.max(0, 20 - yardLine);         // How deep into your end zone
  const visibleBottomYards = Math.min(10, yardsBefore20);   // Max 10 yards visible
  const visibleEndZoneHeightBottom = visibleBottomYards * oneYardInPixels;
  return (
    <>
      {yardLine > 80 && (
        <div
          className="end-zone"
          style={{
            borderBottom: '2px solid white',
            position: 'absolute',
            top: `${offsetFromTop}px`,
            height: `${visibleEndZoneHeightTop}px`,
            width: '100%',
            backgroundColor: '#28aa28',
            zIndex: 2,
          }}
        />
      )}
      {yardLine > 90 && (
        <div
          className="behind-end-zone"
          style={{
            position: 'absolute',
            top: `-3px`,
            height: `${offsetFromTop + 3}px`,
            width: '101%',
            left: `-3px`,
            backgroundColor: 'black',
            zIndex: 2,
          }}
        />
      )}
      {yardLine < 20 && (
        <div
          className="end-zone"
          style={{
            borderTop: '2px solid white',
            position: 'absolute',
            bottom: `${offsetFromBottom}px`,
            height: `${visibleEndZoneHeightBottom}px`,
            width: '100%',
            backgroundColor: '#28aa28',
            zIndex: 2,
          }}
        />
      )}
      {yardLine < 10 && (
        <div
          className="behind-end-zone"
          style={{
            position: 'absolute',
            bottom: `-5px`,
            height: `${offsetFromBottom + 5}px`,
            width: '101%',
            left: `-3px`,
            backgroundColor: 'black',
            zIndex: 2,
          }}
        />
      )}
    </>
  );
};

export default EndZoneGraphics;
