import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
const AppContext = createContext();
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
      const [firstDownStartY, setFirstDownStartY] = useState(null); 
      const [preSnapPlayers, setPreSnapPlayers] = useState([]);
      const [currentYards, setCurrentYards] = useState(0); 
      const [score, setScore] = useState(0);
      const [moreRoutes, setMoreRoutes] = useState(false);
      const [isRunPlay, setIsRunPlay] = useState(false)
      const [otherScore, setOtherScore] = useState(0);
          const [inventory, setInventory] = useState({
        offense: teamData[offenseName].offensivePlayers,
        defense: teamData[defenseName].defensivePlayers,
        OLine: teamData[offenseName].OLine,
        DLine: teamData[defenseName].DLine,
        Qb: teamData[offenseName].Qb
      });
      
      // Update inventory automatically when offenseName changes
      useEffect(() => {
        if (offenseName) {
          setInventory({
            offense: teamData[offenseName].offensivePlayers,
            defense: teamData[offenseName].defensivePlayers,
            OLine: teamData[offenseName].OLine,
            DLine: teamData[offenseName].DLine,
            Qb: teamData[offenseName].Qb
          });
        }
      }, [offenseName]);
      
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
      }, [outcome]);
      // Switch sides function — swap offense and defense teams & reset field state
      const switchSides = (outcome, yardLine, height) => {
        setTimeout(() => {
          preSnapRef.current = players.filter(p =>
              p.role === 'qb' ||
              p.role === 'offensive-lineman' ||
              p.role === 'defensive-lineman'
            )
        }, 50);

        const newOffenseName = defenseName;
        const newDefenseName = offenseName;

        setOffenseName(newOffenseName);
        setDffenseName(newDefenseName);

        setIsOffense(prev => !prev);
        setInventory({
          offense: teamData[newOffenseName].offensivePlayers,
          defense: teamData[newDefenseName].defensivePlayers, // Both from same team after switch
          OLine: teamData[newOffenseName].OLine,
          DLine: teamData[newOffenseName].DLine,
          Qb: teamData[newOffenseName].Qb
        });
        if(outcome == "Intercepted" || outcome == "Turnover on Downs"){
          setTimeout(()=>{
            setYardLine(100 - yardLine);
          }, 50)
        }
        else if(outcome == "Touchdown!"){
          setYardLine(25);
        }
        else if(outcome == "Safety"){
          setYardLine(35);
        }
        
        setTimeout(()=>{
        setDown(1);
        setDistance(10);
        setFirstDownStartY(height/4)
        }, 100)
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
        moreRoutes, setMoreRoutes
      }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);