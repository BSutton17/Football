import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
const AppContext = createContext({});
import teamData from '../Teams.json'

export const Provider = ({ children }) => {
    const [players, setPlayers] = useState([]);
      const [draggingId, setDraggingId] = useState(null);
      const fieldRef = useRef(null);
      const [selectedPlayerId, setSelectedPlayerId] = useState(null);
      const [selectedZoneId, setSelectedZoneId] = useState(null);
      const [fieldSize, setFieldSize] = useState({ width: 0, height: 0, area: 0 });
      const [routeProgress, setRouteProgress] = useState({});
      const [routeStarted, setRouteStarted] = useState(false);
      const [openess, setOpeness] = useState("");
      const [paused, setPaused] = useState(false);
      const [sackTimeRemaining, setSackTimeRemaining] = useState(0);
      const sackTimerRef = useRef(null);
      const outcomeRef = useRef("");
      const preSnapRef = useRef([]);
      const [kickoffActive, setKickoffActive] = useState(false)
      const [kickoffResult, setKickoffResult] = useState()
      const [completedYards, setCompletedYards] = useState(0)
      const [liveCountdown, setLiveCountdown] = useState(null);
      const [down, setDown] = useState(1)
      const [distance, setDistance] = useState(10)
      const [yardLine, setYardLine] = useState(25)
      const [qbPenalty, setQbPenalty] = useState(0)
      const [socket, setSocket] = useState()
      const [readyToCatchIds, setReadyToCatchIds] = useState(new Set());
      const [roomId, setRoomId] = useState()
      const [isOffense, setIsOffense] = useState(true);
      const [isPlayerOne, setIsPlayerOne] = useState(null);
      const [offenseName, setOffenseName] = useState("TeamOne")
      const [defenseName, setDffenseName] = useState("TeamTwo")
      const [outcome, setOutcome] = useState("")
      const [gameClock, setGameClock] = useState(300000); // 5 minutes in ms
      const [quarter, setQuarter] = useState(1);
      const gameClockRef = useRef(gameClock);
      const gameIntervalRef = useRef(null);
      const [isGoalToGo, setIsGoalToGo] = useState(false);
      const [setButtonEnabled, setSetButtonEnabled] = useState(false);
      const [postSetCountdown, setPostSetCountdown] = useState(null); // 10s countdown after Set
      const [isSetClicked, setIsSetClicked] = useState(false);
      const [thrownBallLine, setThrownBallLine] = useState(null);
      const [firstDownStartY, setFirstDownStartY] = useState(0); 
      const [preSnapPlayers, setPreSnapPlayers] = useState([]);
      const [currentYards, setCurrentYards] = useState(0); 
      const [score, setScore] = useState(0);
      const [moreRoutes, setMoreRoutes] = useState(false);
      const [isRunPlay, setIsRunPlay] = useState(false)
      const [activePlayId, setActivePlayId] = useState(null)
      const [otherScore, setOtherScore] = useState(0);
      const buildInventoryForSide = (userTeamName, opponentTeamName, userOnOffense) => {
        const offenseTeamOnField = userOnOffense ? userTeamName : opponentTeamName;
        const defenseTeamOnField = userOnOffense ? opponentTeamName : userTeamName;
        return {
          offense: teamData[offenseTeamOnField].offensivePlayers,
          defense: teamData[defenseTeamOnField].defensivePlayers,
          offensiveLine: teamData[offenseTeamOnField].offensiveLine ?? [],
          defensiveLine: teamData[defenseTeamOnField].defensiveLine ?? [],
          OLine: teamData[offenseTeamOnField].OLine,
          DLine: teamData[defenseTeamOnField].DLine,
          Qb: teamData[offenseTeamOnField].Qb
        };
      };

      const [inventory, setInventory] = useState({
        offense: teamData[offenseName].offensivePlayers,
        defense: teamData[defenseName].defensivePlayers,
        offensiveLine: teamData[offenseName].offensiveLine ?? [],
        defensiveLine: teamData[defenseName].defensiveLine ?? [],
        OLine: teamData[offenseName].OLine,
        DLine: teamData[defenseName].DLine,
        Qb: teamData[offenseName].Qb
      });
      
      // Update inventory automatically when offenseName changes
      useEffect(() => {
        if (offenseName) {
          setInventory(buildInventoryForSide(offenseName, defenseName, isOffense));
        }
      }, [defenseName, offenseName, isOffense]);
      
      // Score updates based on outcome
      useEffect(() => {
        if (outcome === "Touchdown!") {
          if(isOffense){
            setScore(prev => prev + 7);
          }
          else{
            setOtherScore(prev => prev + 7);
          }
        }
      }, [outcome, isOffense]);
      
      // Switch sides function — swap offense and defense teams & reset field state
      const switchSides = (outcome, yardLine, height) => {
        const oldUserTeamName = offenseName;
        const oldOpponentTeamName = defenseName;
        const oldRoleLabel = isOffense ? 'offense' : 'defense';
        const nextIsOffense = !isOffense;
        const nextRoleLabel = nextIsOffense ? 'offense' : 'defense';
        const fieldWidth = 800;
        const fieldHeight = 600;
        const anchoredTrenchById = {
          QB: { x: fieldWidth / 2, y: fieldHeight / 6 },
          'O-L1': { x: fieldWidth / 2 - (fieldWidth / 7), y: fieldHeight * 0.0417 },
          'O-L2': { x: fieldWidth / 2 - (fieldWidth / 14), y: fieldHeight * 0.0333 },
          'O-L3': { x: fieldWidth / 2, y: fieldHeight * 0.025 },
          'O-L4': { x: fieldWidth / 2 + (fieldWidth / 14), y: fieldHeight * 0.0333 },
          'O-L5': { x: fieldWidth / 2 + (fieldWidth / 7), y: fieldHeight * 0.0417 },
          'D-L1': { x: fieldWidth * 0.5 - (fieldWidth * 0.125), y: fieldHeight * 0.5 - (fieldHeight * 0.02) },
          'D-L2': { x: fieldWidth * 0.5 - (fieldWidth * 0.044), y: fieldHeight * 0.5 - (fieldHeight * 0.02) },
          'D-L3': { x: fieldWidth * 0.5 + (fieldWidth * 0.044), y: fieldHeight * 0.5 - (fieldHeight * 0.02) },
          'D-L4': { x: fieldWidth * 0.5 + (fieldWidth * 0.125), y: fieldHeight * 0.5 - (fieldHeight * 0.02) },
        };
        let switchedBoardPlayers = [];

        setPlayers((prevPlayers) => {
          const previousById = new Map(prevPlayers.map((player) => [player.id, player]));
          const coreFormation = [
            { id: 'QB', role: 'qb', isOffense: true },
            { id: 'O-L1', role: 'offensive-lineman', isOffense: true },
            { id: 'O-L2', role: 'offensive-lineman', isOffense: true },
            { id: 'O-L3', role: 'offensive-lineman', isOffense: true },
            { id: 'O-L4', role: 'offensive-lineman', isOffense: true },
            { id: 'O-L5', role: 'offensive-lineman', isOffense: true },
            { id: 'D-L1', role: 'defensive-lineman', isOffense: false },
            { id: 'D-L2', role: 'defensive-lineman', isOffense: false },
            { id: 'D-L3', role: 'defensive-lineman', isOffense: false },
            { id: 'D-L4', role: 'defensive-lineman', isOffense: false },
          ];

          const trimmedPlayers = coreFormation.map(({ id, role, isOffense: isCoreOffense }) => {
            const previous = previousById.get(id) ?? {};
            const anchored = anchoredTrenchById[id] ?? { x: fieldWidth / 2, y: fieldHeight / 2 };
            return {
              ...previous,
              id,
              role,
              isOffense: isCoreOffense,
              position: { x: anchored.x, y: anchored.y },
              route: null,
              moveTarget: null,
              waypoints: null,
              currentWaypointIndex: null,
              currentSpeed: 0,
              lastUpdateTime: null,
              heading: null,
            };
          });
          switchedBoardPlayers = trimmedPlayers;
          preSnapRef.current = trimmedPlayers;
          setPreSnapPlayers(trimmedPlayers);
          return trimmedPlayers;
        });

        setRouteStarted(false);
        setOutcome('');
        setIsRunPlay(false);
        setActivePlayId(null);
        setSelectedPlayerId(null);
        setSelectedZoneId(null);
        setDraggingId(null);

        setIsOffense(prev => !prev);

        setInventory(buildInventoryForSide(oldUserTeamName, oldOpponentTeamName, nextIsOffense));

        if (outcome === "Intercepted") {
          setTimeout(() => {
            const flippedYardLine = 100 - yardLine;
            setYardLine(flippedYardLine);
          }, 50);
        } else if (outcome === "Touchdown!") {
          setKickoffActive(true);
        } else if (outcome === "Safety") {
          setYardLine(35);
        }

        setTimeout(() => {
          setDown(1);
          setDistance(10);
          setFirstDownStartY(height / 4);
        }, 100);
      };

   return (
    <AppContext.Provider value={{ 
        players, setPlayers, 
        draggingId, setDraggingId, 
        fieldRef,   
        selectedPlayerId, setSelectedPlayerId, 
        selectedZoneId, setSelectedZoneId,
        fieldSize, setFieldSize, 
        routeProgress, setRouteProgress, 
        routeStarted, setRouteStarted, 
        openess, setOpeness,
        paused, setPaused,
        inventory, setInventory,
        sackTimeRemaining, setSackTimeRemaining,
        sackTimerRef,
        outcome, setOutcome,
        liveCountdown, setLiveCountdown,
        offenseName, setOffenseName,
        defenseName, setDffenseName,
        completedYards, setCompletedYards,
        down, setDown,
        distance, setDistance,
        yardLine, setYardLine,
        switchSides,
        qbPenalty, setQbPenalty,
        roomId, setRoomId,
        isPlayerOne, setIsPlayerOne,
        isOffense, setIsOffense,
        socket, setSocket,
        readyToCatchIds, setReadyToCatchIds,
        outcomeRef,
        currentYards, setCurrentYards,
        firstDownStartY, setFirstDownStartY,
        thrownBallLine, setThrownBallLine,
        preSnapPlayers, setPreSnapPlayers,
        preSnapRef,
        score, setScore,
        otherScore, setOtherScore,
        gameClockRef,
        gameIntervalRef,
        gameClock, setGameClock,
        quarter, setQuarter,
        setButtonEnabled, setSetButtonEnabled,
        postSetCountdown, setPostSetCountdown,
        isSetClicked, setIsSetClicked,
        isGoalToGo, setIsGoalToGo,
        isRunPlay, setIsRunPlay,
        activePlayId, setActivePlayId,
        moreRoutes, setMoreRoutes,
        kickoffResult, setKickoffResult,
        kickoffActive, setKickoffActive
      }}>
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);