# Three.js Multiplayer Game

A simple multiplayer browser game built with Three.js and Node.js.

## Features

- Real-time multiplayer movement
- 3D environment with basic lighting
- Player count display
- WASD movement controls

## Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:8000
```

## Controls

- W: Move forward
- S: Move backward
- A: Move left
- D: Move right

## How it Works

The game uses WebSocket for real-time communication between the server and clients. Each player is represented by a colored cube (green for local player, red for other players). The server maintains the state of all connected players and broadcasts position updates to all clients. 