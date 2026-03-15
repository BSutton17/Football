import { useEffect, useState } from 'react';
import './App.css';
import io from "socket.io-client";
import Field from './Components/Field';
import { useAppContext } from './Context/AppContext';

const getSocketBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isNetlifyHost = host.endsWith('netlify.app');

    if (isNetlifyHost) {
      return 'https://football-server-63f55d8fa79f.herokuapp.com';
    }

    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }

    return `http://${host}:3001`;
  }

  return 'http://localhost:3001';
};

const socket = io.connect(getSocketBaseUrl(), {
  withCredentials: true,
  timeout: 12000,
});
function App() {
  const [room, setRoom] = useState("");      
  const [isJoining, setIsJoining] = useState(false); 

  const {
    setRoomId = () => {},
    setIsPlayerOne = () => {},
    setOffenseName = () => {},
    setDffenseName = () => {},
    setIsOffense = () => {},
    setSocket = () => {},
  } = useAppContext() || {};


  useEffect(() => {
    const handleConnect = () => {
      console.log('[SOCKET] connected', { id: socket.id, url: getSocketBaseUrl() });
    };

    const handleConnectError = (error) => {
      console.error('[SOCKET] connect_error', {
        message: error?.message,
        description: error?.description,
        context: error?.context,
        url: getSocketBaseUrl(),
      });
    };

    const handleDisconnect = (reason) => {
      console.warn('[SOCKET] disconnected', { reason });
    };

    socket.on("assigned_player", (playerNumber) => {
      const amPlayerOne = playerNumber === 1;
      setIsOffense(playerNumber === 1);
      setIsPlayerOne(amPlayerOne);

      const offenseTeamName = amPlayerOne ? "TeamOne" : "TeamTwo";
      const defenseTeamName = amPlayerOne ? "TeamTwo" : "TeamOne";

      setOffenseName(offenseTeamName);
      setDffenseName(defenseTeamName);
      setSocket(socket);
    });

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off("assigned_player");
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
    };
  }, [setIsPlayerOne, setOffenseName, setDffenseName, setIsOffense, setSocket]);

  const joinRoom = () => {
    if (room !== "" ) {
      socket.emit("join_room", room, "Player"); 
      setIsJoining(true);
      setRoomId(room);
    } else {
      alert("Please enter a valid room and name.");
    }
  };

  // Start a new room (this can just be for regular players, no admin logic)
  const startRoom = () => {
    // Generate random 4-digit room ID
    const newRoom = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
    const strRoom = String(newRoom);
    setRoomId(strRoom)

    // Simulate typing room ID character by character
    setRoom("");
    setTimeout(() => setRoom(strRoom.substring(0, 3)), 30);
    setTimeout(() => setRoom(strRoom), 60);

    setTimeout(() => {
      socket.emit("join_room", strRoom, "Player");
      setIsJoining(true);
    }, 20);
  };

return (
  <div>
    {!isJoining ? (
      <div className="case">
        <h1 id="title">Electric Football</h1>
        <div className="name_input">
          <input
            placeholder="Room Id..."
            type="number"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
          <button onClick={startRoom}>Start Room</button>
        </div>
      </div>
    ) : (
      <Field socket={socket} room={room} />
    )}
  </div>
);

}

export default App;
