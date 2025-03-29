const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());

app.use(express.static(path.join(__dirname, '../public')));

const connectedClients = new Map();
const playerData = new Map();
const chatHistory = [];
const MAX_CHAT_HISTORY = 50;

wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`New client connected: ${clientId}`);
    
    connectedClients.set(clientId, ws);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            if (data.type === 'join') {
                const playerName = data.name || 'Player';
                playerData.set(clientId, {
                    name: playerName,
                    position: { x: 0, y: 0.5, z: 0 }
                });
                
                ws.send(JSON.stringify({
                    type: 'init',
                    id: clientId,
                    players: Object.fromEntries(Array.from(playerData.entries()).map(([id, data]) => [id, data])),
                    chatHistory: chatHistory
                }));
                
                broadcastPlayerJoined(clientId);
                
                const joinMessage = {
                    sender: 'System',
                    content: `${playerName} has joined the game`,
                    timestamp: Date.now()
                };
                addChatMessage(joinMessage);
                broadcastChatMessage(joinMessage);
            }
            else if (data.type === 'position') {
                if (playerData.has(clientId)) {
                    const player = playerData.get(clientId);
                    player.position = data.position;
                    broadcastPositions();
                }
            }
            else if (data.type === 'chat') {
                if (playerData.has(clientId) && data.content && data.content.trim()) {
                    const playerName = playerData.get(clientId).name;
                    const chatMessage = {
                        sender: playerName,
                        content: data.content.trim(),
                        timestamp: Date.now(),
                        playerId: clientId
                    };
                    
                    addChatMessage(chatMessage);
                    broadcastChatMessage(chatMessage);
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        
        if (playerData.has(clientId)) {
            const playerName = playerData.get(clientId).name;
            const leaveMessage = {
                sender: 'System',
                content: `${playerName} has left the game`,
                timestamp: Date.now()
            };
            addChatMessage(leaveMessage);
            broadcastChatMessage(leaveMessage);
        }
        
        handleDisconnect(clientId);
    });
});

function addChatMessage(message) {
    chatHistory.push(message);
    if (chatHistory.length > MAX_CHAT_HISTORY) {
        chatHistory.shift();
    }
}

function handleDisconnect(clientId) {
    connectedClients.delete(clientId);
    playerData.delete(clientId);
    broadcastPlayerLeft(clientId);
    console.log(`Current player count: ${connectedClients.size}`);
}

function broadcastPositions() {
    const message = {
        type: 'positions',
        players: Object.fromEntries(Array.from(playerData.entries()).map(([id, data]) => [id, data]))
    };
    broadcast(message);
}

function broadcastPlayerJoined(clientId) {
    const player = playerData.get(clientId);
    const message = {
        type: 'player_joined',
        id: clientId,
        name: player.name,
        position: player.position
    };
    broadcast(message);
    console.log(`Player joined broadcast sent. Current player count: ${connectedClients.size}`);
}

function broadcastPlayerLeft(clientId) {
    const message = {
        type: 'player_left',
        id: clientId
    };
    broadcast(message);
}

function broadcastChatMessage(chatMessage) {
    const message = {
        type: 'chat_message',
        message: chatMessage
    };
    broadcast(message);
}

function broadcast(message) {
    const messageStr = JSON.stringify(message);
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 