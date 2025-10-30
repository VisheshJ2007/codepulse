import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [code, setCode] = useState('// Welcome to CodePulse! Start coding together...\n');
  const isTyping = useRef(false);

  useEffect(() => {
    console.log('🔄 Setting up socket listeners...');
    
    // Listen for code updates from other users
    socket.on('code-update', (newCode) => {
      console.log('📨 Received update from server:', newCode.length, 'chars');
      if (!isTyping.current) {
        setCode(newCode);
      }
    });

    socket.on('connect', () => {
      console.log('✅ Connected to backend!');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCodeChange = (event) => {
    const newCode = event.target.value;
    
    // Update local state immediately
    setCode(newCode);
    
    // Send to other users
    isTyping.current = true;
    socket.emit('code-change', newCode);
    
    // Reset typing flag after a short delay
    setTimeout(() => {
      isTyping.current = false;
    }, 100);
  };

  return (
    <div className="App" style={{ padding: '20px' }}>
      <h1>CodePulse 🚀</h1>
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
        💡 Open this page in another browser tab to test real-time collaboration!
      </div>
    </div>
  );
}

export default App;