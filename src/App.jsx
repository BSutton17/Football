import { useEffect, useState } from 'react';
import './App.css';
import io from "socket.io-client";
import Field from './Components/Field';
import { useAppContext } from './Context/AppContext';

const socket = io.connect("https://football-server-63f55d8fa79f.herokuapp.com/")
//const socket = io.connect("http://localhost:3001/");
function App() {
  const [room, setRoom] = useState("");      
  const [isJoining, setIsJoining] = useState(false); 
  const { setRoomId, setIsPlayerOne, setOffenseName, setDffenseName, setIsOffense, setSocket } = useAppContext()

  useEffect(() => {
    socket.on("assigned_player", (playerNumber) => {
      const amPlayerOne = playerNumber === 1;
      setIsOffense(playerNumber == 1);
      setIsPlayerOne(amPlayerOne);

      // Each player’s team name:
      const teamName = amPlayerOne ? "TeamOne" : "TeamTwo";

      // Set offenseName and defenseName both to that player's team:
      setOffenseName(teamName);
      setDffenseName(teamName);
      setSocket(socket)
    });

    return () => {
      socket.off("assigned_player");
    };
  }, [setIsPlayerOne, setOffenseName, setDffenseName]);

  const joinRoom = () => {
    if (room !== "" ) {
      socket.emit("join_room", room, name); 
      setIsJoining(true);
      setRoomId(room)
      console.log(room)
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
      socket.emit("join_room", strRoom, name); // No admin status needed
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
        <div>
          <Field socket={socket} room={room} />
          {/* <button onClick={logout}>Leave Game</button> */}
        </div>
      )}
    </div>
  );
}

export default App;
