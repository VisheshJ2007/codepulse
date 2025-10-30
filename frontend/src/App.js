import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

function App() {
  const [code, setCode] = useState('print("Welcome to CodeSync")\nprint("Try running this code!")');
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState('');
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const codeRef = useRef(code);
  const socketRef = useRef();

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('code-update', (newCode) => {
      setCode(newCode);
      codeRef.current = newCode;
      setIsSynced(true);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const handleCodeChange = (event) => {
    const newCode = event.target.value;
    setCode(newCode);
    setIsSynced(false);
    if (socketRef.current) {
      socketRef.current.emit('code-change', newCode);
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
  };

  const executeCode = async () => {
    setIsRunning(true);
    setOutput('Running...');

    try {
      const response = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, input })
      });
      
      const result = await response.json();
      setOutput(result.output || 'No output');
    } catch (error) {
      setOutput('Execution failed: ' + error.message);
    }
    
    setIsRunning(false);
  };

  const getLanguageTemplate = (lang) => {
    const templates = {
      python: "print('Hello, World!')",
      javascript: "console.log('Hello, World!');",
      java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}",
      c: "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\");\n    return 0;\n}",
      cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << \"Hello, World!\" << endl;\n    return 0;\n}"
    };
    return templates[lang] || "// Write your code here";
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>CodeSync</h1>
      <p>Real-time collaborative code editor with execution</p>

      {/* Controls */}
      <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div>
          <label style={{ marginRight: '5px' }}>Language: </label>
          <select 
            value={language} 
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="csharp">C#</option>
            <option value="php">PHP</option>
            <option value="ruby">Ruby</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </div>
        
        <button 
          onClick={executeCode} 
          disabled={isRunning}
          style={{ 
            padding: '5px 15px', 
            backgroundColor: isRunning ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Running...' : 'Run Code'}
        </button>

        <button 
          onClick={() => {
            const template = getLanguageTemplate(language);
            setCode(template);
            if (socketRef.current) {
              socketRef.current.emit('code-change', template);
            }
          }}
          style={{ 
            padding: '5px 10px', 
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Reset Template
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Code Editor */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '5px' }}>
            <label>Code Editor: </label>
            <span style={{ fontSize: '12px', color: isSynced ? 'green' : 'orange', marginLeft: '10px' }}>
              {isSynced ? 'Synced' : 'Syncing...'}
            </span>
          </div>
          <textarea
            value={code}
            onChange={handleCodeChange}
            style={{
              width: '100%',
              height: '400px',
              fontFamily: '"Courier New", monospace',
              fontSize: '14px',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '5px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Input/Output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label>Input: </label>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ 
                width: '100%',
                height: '80px',
                fontFamily: 'monospace',
                fontSize: '14px',
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                resize: 'vertical'
              }}
              placeholder="Program input (if needed)"
            />
          </div>

          <div>
            <label>Output: </label>
            <pre style={{ 
              width: '100%',
              height: '300px',
              backgroundColor: '#f8f8f8',
              border: '1px solid #ddd',
              padding: '10px',
              borderRadius: '5px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              margin: 0,
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              {output}
            </pre>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        Open multiple browser tabs to test real-time collaboration. Code automatically saves and syncs across all users.
      </div>
    </div>
  );
}

export default App;