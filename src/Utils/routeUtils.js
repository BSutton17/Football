// routeUtils.js

  export function getRouteWaypoints(fieldSize, startPos, route, player) {
    const direction = fieldSize.width / 2;
    const centerX = fieldSize.width;
    const forwardDist = fieldSize.height / 4;

    switch (route) {
      // WR routes
      case "corner":
        return [
          { x: startPos.x, y: startPos.y - forwardDist },
          {
            x: startPos.x > direction ? centerX : 0,
            y: startPos.y - forwardDist * 1.5,
          },
        ];
      case "go":
        return [{ x: startPos.x, y: startPos.y - fieldSize.height / 2 }];
      case "post":
        return [
          { x: startPos.x, y: startPos.y - forwardDist },
          {
            x: startPos.x < direction ? centerX : 0,
            y: startPos.y - forwardDist * 4,
          },
        ];
      case "slant":
        return [
          { x: startPos.x, y: startPos.y - forwardDist / 2.5 },
          {
            x: startPos.x < direction ? centerX : 0,
            y: startPos.y - (forwardDist / 2 + forwardDist / 2),
          },
        ];
      case "curl":
        return [
          { x: startPos.x, y: startPos.y - forwardDist },
          {
            x:
              startPos.x < direction
                ? startPos.x + centerX / 35
                : startPos.x - centerX / 35,
            y: startPos.y - forwardDist / 1.2,
          },
        ];
      case "in":
        return [
          { x: startPos.x, y: startPos.y - forwardDist },
          { x: startPos.x < direction ? centerX : 0, y: startPos.y - forwardDist },
        ];
      case "comeback":
        return [
          { x: startPos.x, y: startPos.y - forwardDist * 1.25 },
          {
            x:
              startPos.x > direction
                ? startPos.x + centerX / 5
                : startPos.x - centerX / 5,
            y: startPos.y - forwardDist / 1.5,
          },
        ];
      case "out":
        return [
          { x: startPos.x, y: startPos.y - forwardDist },
          {
            x: startPos.x > direction ? centerX : 0,
            y: startPos.y - forwardDist,
          },
        ];

      // TE routes
      case "shallow":
         return [
          {
            x:
              startPos.x < direction
                ? startPos.x + centerX / 10
                : startPos.x - centerX / 10,
             y: startPos.y - (forwardDist / 1.75),
          },
          { x: startPos.x < direction ? centerX : 0, y: startPos.y - (forwardDist / 1.5) },
        ];
      case "curl inside":
          return [
          {
            x:
              startPos.x < direction
                ? startPos.x + centerX / 6.5
                : startPos.x - centerX / 6.5,
             y: startPos.y - (forwardDist / 1.2),
          },
          { x:
              startPos.x < direction
                ? startPos.x + centerX / 6
                : startPos.x - centerX / 6,
            y: startPos.y - forwardDist * 0.6,
          },
        ];
      case "flat":
       return [
          { x: startPos.x, y: startPos.y - forwardDist / 2 },
          {
            x: startPos.x > direction ? centerX : 0,
            y: startPos.y - forwardDist / 2,
          },
        ];
      case "curl outside":
        return [
          {
            x:
              startPos.x > direction
                ? startPos.x + centerX / 6.5
                : startPos.x - centerX / 6.5,
             y: startPos.y - (forwardDist / 1.2),
          },
          { x:
              startPos.x > direction
                ? startPos.x + centerX / 11
                : startPos.x - centerX / 11,
            y: startPos.y - forwardDist * 0.8,
          },
        ];
      
        // RB
        case "texas": 
          return [
          {
            x:
              startPos.x > direction
                ? startPos.x + centerX / 6.5
                : startPos.x - centerX / 6.5,
             y: startPos.y - (forwardDist / 1.4),
          },
          { x:
              startPos.x > direction
                ? 0
                : centerX,
            y: startPos.y - forwardDist * 2.5
          },
        ];

        case "swing":
          return [{ x: startPos.x > direction ? (centerX / 2) * 1.9 : centerX / 15, y: startPos.y }];
        
        case "rb flat":
           return [
          {
            x:
              startPos.x > direction? startPos.x + centerX / 12: startPos.x - centerX / 5,
             y: startPos.y - (forwardDist / 1.3),
          },
          { x: startPos.x > direction ? centerX : 0, y: startPos.y - (forwardDist / 1.2) },
        ];

        case "wheel":
          return [
          {
            x:
              startPos.x > direction? startPos.x + centerX / 12: startPos.x - centerX / 5,
             y: startPos.y - (forwardDist / 1.3),
          },
          { x: startPos.x > direction ? (centerX / 2) * 1.75 : centerX / 12, y: startPos.y - (forwardDist / 1.2) },
          { x: startPos.x > direction ? (centerX / 2) * 1.75 : centerX / 12, y: startPos.y - (forwardDist / 1.2) - (fieldSize.height / 2) },
        ];
        case "run": {
          const angleDeg = player.runAngle ?? 90; 
          const angleRad = (angleDeg * Math.PI) / 180;

          const runDistance = fieldSize.height / 4; 
          const dx = Math.sin(angleRad) * runDistance;
          const dy = Math.cos(angleRad) * runDistance;

          const targetX = startPos.x + dx;
          const targetY = startPos.y - dy;
          console.log(`Run target: (${targetX}, ${targetY})`);

          return [{ x: targetX, y: targetY }];
        }


      default:
        return [startPos];
    }
  }

  // Generate SVG path string for route visualization
  export function getRoutePath(fieldSize, x, y, route, offsetX, offsetY, progress = 100) {
    const pct = Math.min(progress / 100, 1);
    const forwardDist = fieldSize.height / 4;
    const direction = fieldSize.width / 2
    const centerX = fieldSize.width ; // full size

    const startX = x;
    const startY = y - 10; // offset for visual alignment

    switch (route) {
      //wr
      case "corner": {
        const forwardY = y - forwardDist;
        const horizontalX = x < direction ? x - 75 : x + 75;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY - 50}`;
      }
      case "go": {
        const endY = y - offsetY - 200;
        const interpY = startY + (endY - startY) * pct;
        return `M${startX},${startY} L${startX},${interpY}`;
      }
      case "post": {
        const forwardY = y - forwardDist;
        const horizontalX = x > direction ? x - 75 : x + 75;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY - 50}`;
      }
      case "slant": {
        const verticalY = y - forwardDist / 2.5;

        // Target full diagonal endpoint (as before)
        const fullX = x < direction ? centerX : 0;
        const fullY = y - forwardDist;

        // Now scale the diagonal part to half its length
        const dx = fullX - x;
        const dy = fullY - verticalY;

        const diagonalX = x + dx * 0.25;
        const diagonalY = verticalY + dy * 0.25;

        return `M${x},${startY} L${x},${verticalY} L${diagonalX},${diagonalY}`;
      }
      case "curl": {
        const forwardY = y - forwardDist;
        const horizontalX = x > direction ? x - 25 : x + 25;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY + 25}`;
      }
      case "in": {
        const forwardY = y - forwardDist;
        const horizontalX = x < direction ? x + 100 : x - 100;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY}`;
      }
      case "comeback": {
        const forwardY = y - forwardDist * 1.25;
        const horizontalX = x < direction ? x - 75 : x + 75;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY + 75}`;
      }
      case "out": {
        const forwardY = y - forwardDist;
        const horizontalX = x < direction ? x - 75 : x + 75;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY}`;
      }

      //TE
      case "shallow": {
        const firstx = x < direction? x + centerX / 10: x - centerX / 10
        const firsty = y - (forwardDist / 1.75)
        const forwardY = y - (forwardDist / 1.5);
        const horizontalX = x < direction ? (centerX / 2) * 1.37 : centerX / 3;
        return `M${x},${startY} L${firstx},${firsty} L${horizontalX},${forwardY}`
      }
      case "curl inside": {
        const firstx = x < direction ? x + centerX / 6.5 : x - centerX / 6.5
        const firsty = y - (forwardDist / 1.2)
        const secondx = x < direction ? x + centerX / 6 : x - centerX / 6
        const secondy = y - forwardDist * 0.6
        return `M${x},${startY} L${firstx},${firsty} L${secondx},${secondy}`
      }
      case "flat": {
        const forwardY = y - forwardDist / 2;
        const horizontalX = x < direction ? x - 75 : x + 75;
        return `M${x},${startY} L${x},${forwardY} L${horizontalX},${forwardY}`
      }

      case "curl outside": {
        const firstx = x > direction ? x + centerX / 6.5 : x - centerX / 6.5
        const firsty = y - (forwardDist / 1.2)
        const secondx = x > direction ? x + centerX / 11 : x - centerX / 11
        const secondy = y - forwardDist * 0.8
        return `M${x},${startY} L${firstx},${firsty} L${secondx},${secondy}`
      }
      case "block": {
        // Upside-down T: horizontal top, vertical stem
        const topY = y + 25;
        const bottomY = y + 10;
        const leftX = x - 10;
        const rightX = x + 10;

        // Represented as two lines: horizontal then vertical
        return `M${leftX},${topY} L${rightX},${topY} M${x},${topY} L${x},${bottomY}`;
      }

      //RB
      case "texas": {
        const firstx = x > direction ? x + centerX / 6.5 : x - centerX / 6.5
        const firsty = y - (forwardDist / 1.4)
        const secondx = x > direction ? x - centerX / 35 : x + centerX / 35
        const secondy = y - forwardDist * 1.2
        return `M${x},${startY} L${firstx},${firsty} L${secondx},${secondy}`
      }

      case "swing": {
         const initialx = x > direction ? x + 16 : x - 16
         const firstx = x > direction ? (centerX / 2) * 1.75 : centerX / 5;
        return `M${initialx},${y} L${firstx},${y}`
      }

      case "rb flat": {
        const firstx = x > direction? x + centerX / 12: x - centerX / 5
        const firsty = y - (forwardDist / 1.3)
        const forwardY = y - (forwardDist / 1.2);
        const horizontalX = x > direction ? (centerX / 2) * 1.75 : centerX / 12;
        return `M${x},${startY} L${firstx},${firsty} L${horizontalX},${forwardY}`
      }

      case "wheel": {
         const firstx = x > direction? x + centerX / 12: x - centerX / 5
         const firsty = y - (forwardDist / 1.3)
         const secondx = x > direction ? (centerX / 2) * 1.75 : centerX / 12
         const secondy = y - (forwardDist / 1.2) 
         const thirdx = x > direction ? (centerX / 2) * 1.75 : centerX / 12
         const thirdy = y - (forwardDist / 1.2) * 2.5 
          return `M${x},${startY} L${firstx},${firsty} L${secondx},${secondy} L${thirdx},${thirdy}`
      }

      case "run" :{
        const endY = y - offsetY - 10;
        const interpY = startY + (endY - startY) * pct;
        return `M${startX},${startY} L${startX},${interpY}`;
      }
      default:
        
        return "";
    }
  }
