const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});


// MongoDB Atlas setup
// Replace <db_password> with your actual password or use an environment variable for security
const MONGO_URL = 'mongodb+srv://visheshj207_db_user:3RiC2vv4SuA4APv3@cluster0.rwm1n2z.mongodb.net/?appName=Cluster0';
const DB_NAME = 'codesync';
const COLLECTION = 'code';
const DOC_ID = 'shared_code';

let db, codeCollection;

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(DB_NAME);
    codeCollection = db.collection(COLLECTION);
    server.listen(3001, () => {
      console.log('Server running on http://localhost:3001');
      console.log('Connected to MongoDB');
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

async function loadCode() {
  const doc = await codeCollection.findOne({ _id: DOC_ID });
  return doc && doc.code ? doc.code : "// Welcome to CodeSync! Start coding together...\n";
}

async function saveCode(code) {
  await codeCollection.updateOne(
    { _id: DOC_ID },
    { $set: { code } },
    { upsert: true }
  );
}


io.on('connection', async (socket) => {
  // Send current code to new user
  const currentCode = await loadCode();
  socket.emit('code-update', currentCode);

  // Listen for code changes
  socket.on('code-change', async (newCode) => {
    await saveCode(newCode);
    // Emit to all clients, including sender, for full sync
    io.emit('code-update', newCode);
  });

  socket.on('disconnect', () => {
    // User disconnected
  });
});