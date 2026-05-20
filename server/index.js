const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config({ path: '../backend/.env' }); // Load keys from backend .env

const handleRoomSocket = require('./sockets/roomSocket');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'online', service: 'InterviewOS Collaborative Room Server' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Mount the /room namespace
handleRoomSocket(io);

const PORT = process.env.SOCKET_PORT || 8080;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process!`);
    console.error(`💡 To resolve this on Windows, run the following command in PowerShell to free up the port:`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Collaborative WebRTC Signaling Server online!`);
  console.log(`🎙️ Port: ${PORT}`);
  console.log(`====================================================`);
});
