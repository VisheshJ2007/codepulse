
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});


// MongoDB Atlas setup
const MONGO_URL = 'mongodb+srv://visheshj207_db_user:3RiC2vv4SuA4APv3@cluster0.rwm1n2z.mongodb.net/?appName=Cluster0';
const DB_NAME = 'codesync';
const COLLECTION = 'code';
const DOC_ID = 'shared_code';

// Judge0 API configuration
// (already declared above)

// Code execution function
async function executeCode(language, code, input = '') {
  try {
    const languageId = LANGUAGE_MAP[language] || 71;
    const submission = await axios.post(`${JUDGE0_URL}/submissions`, {
      source_code: code,
      language_id: languageId,
      stdin: input,
      cpu_time_limit: 5,
      memory_limit: 128000,
    }, {
      params: {
        base64_encoded: 'false',
        wait: 'true'
      }
    });
    const submissionId = submission.data.token;
    const result = await axios.get(`${JUDGE0_URL}/submissions/${submissionId}`, {
      params: {
        base64_encoded: 'false'
      }
    });
    return {
      output: result.data.stdout || result.data.stderr || 'No output',
      status: result.data.status?.description || 'Unknown',
      time: result.data.time || '0',
      memory: result.data.memory || '0'
    };
  } catch (error) {
    return {
      output: `Execution error: ${error.message}`,
      status: 'Error',
      time: '0',
      memory: '0'
    };
  }
}

// Add execution endpoint
app.post('/api/execute', async (req, res) => {
  const { language, code, input } = req.body;
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }
  try {
    const result = await executeCode(language, code, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Execution failed' });
  }
});

let db, codeCollection;

// Judge0 API configuration - ADD THIS SECTION
// (removed duplicate JUDGE0_URL and LANGUAGE_MAP)

// Code execution function - ADD THIS FUNCTION
async function executeCode(language, code, input = '') {
  try {
    const languageId = LANGUAGE_MAP[language] || 71;
    
    console.log(`Executing ${language} code...`);
    
    const submission = await axios.post(`${JUDGE0_URL}/submissions`, {
      source_code: code,
      language_id: languageId,
      stdin: input,
      cpu_time_limit: 5,
      memory_limit: 128000,
    }, {
      params: {
        base64_encoded: 'false',
        wait: 'true'
      }
    });

    const submissionId = submission.data.token;
    
    const result = await axios.get(`${JUDGE0_URL}/submissions/${submissionId}`, {
      params: {
        base64_encoded: 'false'
      }
    });

    console.log('Execution completed');
    return {
      output: result.data.stdout || result.data.stderr || 'No output',
      status: result.data.status?.description || 'Unknown',
      time: result.data.time || '0',
      memory: result.data.memory || '0'
    };
    
  } catch (error) {
    console.error('Execution error:', error.message);
    return {
      output: `Execution error: ${error.message}`,
      status: 'Error',
      time: '0',
      memory: '0'
    };
  }
}

// Add execution endpoint - ADD THIS ROUTE
app.post('/api/execute', async (req, res) => {
  const { language, code, input } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }

  try {
    const result = await executeCode(language, code, input);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Execution failed' });
  }
});

MongoClient.connect(MONGO_URL, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(DB_NAME);
    codeCollection = db.collection(COLLECTION);
    server.listen(3001, () => {
      console.log('Server running on http://localhost:3001');
      console.log('Connected to MongoDB');
      console.log('Judge0 execution API ready'); // ADD THIS LINE
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

async function loadCode() {
  const doc = await codeCollection.findOne({ _id: DOC_ID });
  return doc && doc.code ? doc.code : "print('Welcome to CodeSync')\nprint('Try running this code!')";
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