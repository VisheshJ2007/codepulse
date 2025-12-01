const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://visheshj207_db_user:3RiC2vv4SuA4APv3@cluster0.rwm1n2z.mongodb.net/?tls=true&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.log('Failed to connect to MongoDB', err);
});

// MongoDB schema for code
const codeSchema = new mongoose.Schema({
  content: { type: String, required: true }
});
const Code = mongoose.model('Code', codeSchema);

// Helper to get or create the shared code document
async function getOrCreateCodeDoc() {
  let doc = await Code.findOne();
  if (!doc) {
    doc = await Code.create({ content: 'print("Welcome to CodeSync")\nprint("Try running this code!")' });
  }
  return doc;
}

// Socket.io for real-time collaboration
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Send latest code to new user
  const doc = await getOrCreateCodeDoc();
  socket.emit('code-update', doc.content);

  socket.on('code-change', async (code) => {
    // Save code to DB (create if missing)
    await Code.updateOne({}, { content: code }, { upsert: true });
    socket.broadcast.emit('code-update', code);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Code execution endpoint
app.post('/api/execute', async (req, res) => {
  const { language, code, input } = req.body;

  // Map language to Judge0 language IDs
  const languageMap = {
    'python': 71,
    'javascript': 63,
    'java': 62,
    'c': 50,
    'cpp': 54,
    'csharp': 51,
    'php': 68,
    'ruby': 72,
    'go': 60,
    'rust': 73
  };

  const languageId = languageMap[language] || 71;

  try {
    console.log('Executing code...');
    
    // Submit code to Judge0
    const submission = await axios.post('https://ce.judge0.com/submissions', {
      source_code: code,
      language_id: languageId,
      stdin: input || '',
      redirect_stderr_to_stdout: true
    }, {
      params: {
        base64_encoded: false,
        wait: true
      }
    });

    // Get the result
    const result = await axios.get(`https://ce.judge0.com/submissions/${submission.data.token}`, {
      params: {
        base64_encoded: false
      }
    });

    console.log('Execution result:', result.data);

    res.json({
      output: result.data.stdout || result.data.stderr || 'No output',
      error: result.data.stderr
    });

  } catch (error) {
    console.error('Execution error:', error.message);
    res.status(500).json({ 
      error: 'Execution failed: ' + error.message 
    });
  }
});

// AI assistant endpoint (OpenAI if key present, else fallback to local Ollama)
app.post('/api/ai', async (req, res) => {
  try {
    const { prompt, code, language, persona } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    const system = "You are CodeSync's helpful coding assistant. Provide clear, concise, actionable answers with code examples where relevant. Prefer correctness and minimal changes.";
    const personaLine = persona ? `\nPersona: ${persona}` : '';
    const user = `Language: ${language || 'unknown'}\n${personaLine}\n\nCode:\n${(code || '').slice(0, 12000)}\n\nTask: ${prompt || 'Explain this code.'}`;

    if (apiKey) {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0.2,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const text = response.data?.choices?.[0]?.message?.content || '';
      return res.json({ text, provider: 'openai' });
    }

    // Fallback to local Ollama
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
    const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    const oresp = await axios.post(ollamaUrl, {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      stream: false
    });
    const text = oresp.data?.message?.content || oresp.data?.response || '';
    return res.json({ text, provider: 'ollama', model });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ error: 'AI request failed', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Judge0 execution API ready');
});

// Inline code completion endpoint
app.post('/api/ai/complete', async (req, res) => {
  try {
    const { language, code, cursorOffset, prompt } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;

    const prefix = typeof cursorOffset === 'number' ? (code || '').slice(0, cursorOffset) : (code || '');
    const suffix = typeof cursorOffset === 'number' ? (code || '').slice(cursorOffset) : '';

    const system = `You are a careful code completion engine. Only return the raw code to insert, no explanations. Respect the language syntax (${language || 'unknown'}). Keep indentation consistent.`;
    const user = `Continue this code at the cursor.
---
PREFIX START
${prefix.slice(-4000)}
PREFIX END
SUFFIX START
${suffix.slice(0, 2000)}
SUFFIX END
${prompt ? `Instruction: ${prompt}` : ''}`;

    if (apiKey) {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          temperature: 0.2,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const text = response.data?.choices?.[0]?.message?.content || '';
      return res.json({ completion: text, provider: 'openai' });
    }

    // Fallback to local Ollama
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
    const model = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    const oresp = await axios.post(ollamaUrl, {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      stream: false
    });
    const text = oresp.data?.message?.content || oresp.data?.response || '';
    return res.json({ completion: text, provider: 'ollama', model });
  } catch (err) {
    console.error('AI complete error:', err.message);
    res.status(500).json({ error: 'AI completion failed', details: err.message });
  }
});