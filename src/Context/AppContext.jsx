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
      const [thrownBallLine, setThrownBallLine] = useState(null);
      const [firstDownStartY, setFirstDownStartY] = useState(null); 
      const [preSnapPlayers, setPreSnapPlayers] = useState([]);
      const [currentYards, setCurrentYards] = useState(0); 
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
      
      // Switch sides function — swap offense and defense teams & reset field state
      const switchSides = (outcome, yardLine, height) => {
        const newOffenseName = defenseName;
        const newDefenseName = offenseName;

        setOffenseName(newOffenseName);
        setDffenseName(newDefenseName);
        setIsOffense(prev => !prev);
        setInventory({
          offense: teamData[newOffenseName].offensivePlayers,
          defense: teamData[newOffenseName].defensivePlayers, // Both from same team after switch
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
        preSnapRef
      }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);