const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // ← ADDED

// Connect to MongoDB (USE YOUR ACTUAL CONNECTION STRING)
const MONGODB_URI = 'mongodb+srv://visheshj207_db_user:3RiC2vv4SuA4APv3@cluster0.xxxxx.mongodb.net/codepulse?retryWrites=true&w=majority';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Create a simple document schema
const documentSchema = new mongoose.Schema({
  content: String,
  lastUpdated: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', documentSchema);

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

// Load document from database on startup
async function loadDocument() {
  try {
    let doc = await Document.findOne();
    if (!doc) {
      // Create first document
      doc = new Document({ content: sharedCode });
      await doc.save();
    }
    sharedCode = doc.content;
    console.log('📄 Loaded document from database');
  } catch (error) {
    console.log('❌ Error loading document:', error);
  }
}

loadDocument();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  // Send current code to new user
  socket.emit('code-update', sharedCode);
  
  // Listen for code changes
  socket.on('code-change', async (newCode) => {
    console.log('📝 Received change from', socket.id);
    sharedCode = newCode;
    
    // Save to database
    try {
      await Document.findOneAndUpdate(
        {}, 
        { content: newCode, lastUpdated: new Date() },
        { upsert: true }
      );
      console.log('💾 Saved to database');
    } catch (error) {
      console.log('❌ Database save error:', error);
    }
    
    // Send to other users
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