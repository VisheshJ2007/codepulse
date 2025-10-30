const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const DATA_FILE = 'saved-code.txt';

function loadCode() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return fs.readFileSync(DATA_FILE, 'utf8');
    }
  } catch (error) {
    console.log('Error loading file:', error);
  }
  return "// Welcome to CodeSync! Start coding together...\n";
}

function saveCode(code) {
  try {
    fs.writeFileSync(DATA_FILE, code);
    // Optionally, you can add a timestamp or log here
  } catch (error) {
    console.log('Error saving file:', error);
  }
}

let sharedCode = loadCode();

io.on('connection', (socket) => {
  // Send current code to new user
  socket.emit('code-update', sharedCode);

  // Listen for code changes
  socket.on('code-change', (newCode) => {
    sharedCode = newCode;
    saveCode(newCode);
    socket.broadcast.emit('code-update', newCode);
  });

  socket.on('disconnect', () => {
    // User disconnected
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:3001`);
  console.log(`Using file storage: ${DATA_FILE}`);
});