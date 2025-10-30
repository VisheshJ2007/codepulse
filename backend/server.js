const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

let sharedCode = "// Welcome to CodePulse! Start coding together...\n";

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  // Send current code to new user
  socket.emit('code-update', sharedCode);
  
  // Listen for code changes
  socket.on('code-change', (newCode) => {
    console.log('📝 Received change from', socket.id);
    sharedCode = newCode;
    // Send to ALL other users (including sender for testing)
    socket.broadcast.emit('code-update', newCode);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});