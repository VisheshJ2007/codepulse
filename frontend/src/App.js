import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// Connect to backend
const socket = io('http://localhost:3001');

function App() {
  const [code, setCode] = useState('// Welcome to CodePulse! Start coding together...\n');

  // Setup real-time listeners
  useEffect(() => {
    // Listen for code updates from other users
    socket.on('code-update', (newCode) => {
      setCode(newCode);
    });

    // Cleanup on component unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Handle typing in editor
  const handleCodeChange = (event) => {
    const newCode = event.target.value;
    setCode(newCode);
    // Send changes to all other users
    socket.emit('code-change', newCode);
  };

  return (
    <div className="App" style={{ padding: '20px' }}>
      <h1>CodePulse</h1>
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
        placeholder="Start coding with others in real-time..."
      />
      
      <div style={{ marginTop: '10px', color: '#666' }}>
        💡 Open this page in another browser tab to test real-time collaboration!
      </div>
    </div>
  );
}

export default App;