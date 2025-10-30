import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';


function App() {
  const [code, setCode] = useState('// Welcome to CodeSync! Start coding together...\n');
  const [isSynced, setIsSynced] = useState(true);
  const codeRef = useRef(code);
  const socketRef = useRef();

  useEffect(() => {
    // Create socket only once
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

  return (
    <div className="App" style={{ padding: '20px' }}>
      <h1>CodeSync</h1>
      <p>Real-time collaborative code editor</p>
      <textarea
        value={code}
        onChange={handleCodeChange}
        style={{
          width: '90%',
          height: '500px',
          fontFamily: 'monospace',
          fontSize: '14px',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '5px'
        }}
      />
      <div style={{ marginTop: '10px', color: '#666' }}>
        {isSynced ? "All changes are synced." : "Syncing changes..."}
      </div>
      <div style={{ marginTop: '10px', color: '#888' }}>
        Open this page in another browser tab or device to test real-time collaboration.
      </div>
    </div>
  );
}

export default App;