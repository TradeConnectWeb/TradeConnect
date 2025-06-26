require('dotenv').config(); // Load .env first

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app); // HTTP server for Express + WebSocket
const wss = new WebSocket.Server({ server }); // WebSocket attached to HTTP server

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// HTTP endpoint to get Firebase config
app.get('/firebase-config', (req, res) => {
  res.json(firebaseConfig);
});

// Sample root route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// WebSocket connection handler
wss.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('message', (message) => {
    console.log('Received:', message);
    // Broadcast message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start server on PORT or 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP & WebSocket server running on port ${PORT}`);
});
