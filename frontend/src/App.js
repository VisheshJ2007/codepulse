import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';

// Reusable style for AI prompt chips
const chipStyle = {
  padding: '4px 10px',
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '16px',
  cursor: 'pointer'
};

function App() {
  const [code, setCode] = useState('print("Welcome to CodeSync")\nprint("Try running this code!")');
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState('');
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('Explain the selected code');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState('');
  const [persona, setPersona] = useState('Default');
  const [lastJudge0, setLastJudge0] = useState(null);
  const [inlineLoading, setInlineLoading] = useState(false);
  const codeRef = useRef(code);
  const socketRef = useRef();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

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

  // Monaco Editor onChange provides the updated value directly (not an event)
  const handleCodeChange = (value) => {
    const newCode = value ?? '';
    setCode(newCode);
    setIsSynced(false);
    if (socketRef.current) {
      socketRef.current.emit('code-change', newCode);
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Optional: simple snippet completions to give a unique feel
    const snippets = {
      python: [
        { label: 'for-range', insertText: 'for i in range(0, 10):\n    print(i)' },
        { label: 'main-guard', insertText: "if __name__ == '__main__':\n    main()" }
      ],
      javascript: [
        { label: 'log', insertText: "console.log('Hello, World!');" },
        { label: 'async-func', insertText: 'async function main() {\n  try {\n    \n  } catch (e) {\n    console.error(e);\n  }\n}\nmain();' }
      ],
      c: [
        { label: 'printf', insertText: 'printf("%s\\n", "Hello, World!");' }
      ],
      cpp: [
        { label: 'cout', insertText: 'std::cout << "Hello, World!" << std::endl;' }
      ],
      java: [
        { label: 'println', insertText: 'System.out.println("Hello, World!");' }
      ]
    };

    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: () => {
        const items = (snippets[language] || []).map(s => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.insertText
        }));
        return { suggestions: items };
      }
    });
  };

  const insertAtCursor = (text) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    editor.executeEdits('ai-inline', [{ range: selection, text, forceMoveMarkers: true }]);
    editor.focus();
    // propagate change to collaborators
    const newCode = editor.getValue();
    setCode(newCode);
    setIsSynced(false);
    if (socketRef.current) socketRef.current.emit('code-change', newCode);
  };

  const requestInlineSuggest = async () => {
    try {
      setInlineLoading(true);
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      const pos = editor.getPosition();
      const offset = model.getOffsetAt(pos);
      const resp = await fetch('http://localhost:3001/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code: model.getValue(), cursorOffset: offset, prompt: 'Continue the code.' })
      });
      const data = await resp.json();
      const completion = data.completion || '';
      if (completion.trim()) insertAtCursor(completion);
    } catch (e) {
      console.error('Inline suggest failed:', e);
    } finally {
      setInlineLoading(false);
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
  setLastJudge0(result);
      // Show all possible outputs from Judge0
      let fullOutput = '';
      if (result.output) fullOutput += result.output;
      if (result.error) fullOutput += '\n[stderr]\n' + result.error;
      if (result.compile_output) fullOutput += '\n[compile_output]\n' + result.compile_output;
      if (result.message) fullOutput += '\n[message]\n' + result.message;
      if (!fullOutput.trim()) fullOutput = 'No output';
      setOutput(fullOutput);
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
          onClick={() => setOutput('')}
          style={{ 
            padding: '5px 10px', 
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Clear Output
        </button>

        <button 
          onClick={requestInlineSuggest}
          disabled={inlineLoading}
          style={{ 
            padding: '5px 10px', 
            backgroundColor: inlineLoading ? '#ccc' : '#22a06b',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: inlineLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {inlineLoading ? 'Suggesting…' : 'Inline Suggest'}
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
          <Editor
            height="400px"
            language={language}
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorMount}
            theme="vs-light"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible'
              }
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
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <label>Output: </label>
              {lastJudge0 && (lastJudge0.stderr || lastJudge0.compile_output) && (
                <button 
                  onClick={async () => {
                    try {
                      setAiLoading(true);
                      setAiResponse('Thinking...');
                      const errText = (lastJudge0.stderr || '') + '\n' + (lastJudge0.compile_output || '');
                      const payload = {
                        prompt: `The program failed with the following error. Explain the cause and propose a minimal fix. Then show corrected code.\n\nError:\n${errText}`,
                        language,
                        code
                      };
                      const resp = await fetch('http://localhost:3001/api/ai', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      const data = await resp.json();
                      setAiResponse(data.text || data.error || 'No response');
                      setAiProvider(data.provider || '');
                    } catch (e) {
                      setAiResponse('AI request failed: ' + (e?.message || 'Unknown error'));
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                  style={{ 
                    padding: '4px 8px', 
                    backgroundColor: '#f59e0b',
                    color: '#111827',
                    border: '1px solid #d97706',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Fix with AI
                </button>
              )}
            </div>
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

          {/* AI Assistant */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
              <label>AI Assistant</label>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'12px', color:'#6b7280' }}>Persona:</span>
                <select value={persona} onChange={(e)=>setPersona(e.target.value)} style={{ padding:'4px 6px', border:'1px solid #ccc', borderRadius:'4px' }}>
                  <option>Default</option>
                  <option>Strict Reviewer</option>
                  <option>Speedy Pair</option>
                  <option>Teacher</option>
                </select>
                {aiProvider && <span style={{ fontSize:'12px', color:'#6b7280' }}>Provider: {aiProvider}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => setAiPrompt('Explain the selected code')} style={chipStyle}>Explain</button>
              <button onClick={() => setAiPrompt('Find bugs in the selected code and suggest a fix')} style={chipStyle}>Find bug</button>
              <button onClick={() => setAiPrompt('Suggest performance improvements for the selected code')} style={chipStyle}>Improve</button>
              <button onClick={() => setAiPrompt('Refactor the selected code for readability without changing behavior')} style={chipStyle}>Refactor</button>
              <button onClick={() => setAiPrompt('Generate unit tests for this code')} style={chipStyle}>Tests</button>
              <button onClick={() => setAiPrompt('Write docstrings or documentation comments for this code')} style={chipStyle}>Docs</button>
            </div>
            <textarea 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ask anything about your code..."
              style={{ 
                width: '100%',
                height: '70px',
                fontFamily: 'inherit',
                fontSize: '14px',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                resize: 'vertical'
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <button 
                onClick={async () => {
                  try {
                    setAiLoading(true);
                    setAiResponse('Thinking...');
                    const selected = (() => {
                      const ed = editorRef.current;
                      if (!ed) return '';
                      const sel = ed.getModel()?.getValueInRange(ed.getSelection());
                      return sel || '';
                    })();
                    // Simple slash-commands
                    let promptText = aiPrompt;
                    if (aiPrompt.startsWith('/tests')) promptText = 'Generate unit tests for the code.';
                    if (aiPrompt.startsWith('/doc') || aiPrompt.startsWith('/docs')) promptText = 'Write documentation comments and explain usage.';
                    if (aiPrompt.startsWith('/explain')) promptText = 'Explain the code like a teacher with examples.';
                    const payload = {
                      prompt: promptText,
                      language,
                      persona,
                      code: selected && selected.length > 0 ? selected : code
                    };
                    const resp = await fetch('http://localhost:3001/api/ai', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    const data = await resp.json();
                    setAiResponse(data.text || data.error || 'No response');
                    setAiProvider(data.provider || '');
                  } catch (e) {
                    setAiResponse('AI request failed: ' + (e?.message || 'Unknown error'));
                  } finally {
                    setAiLoading(false);
                  }
                }}
                disabled={aiLoading}
                style={{ 
                  padding: '6px 12px', 
                  backgroundColor: aiLoading ? '#ccc' : '#0b5fff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: aiLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {aiLoading ? 'Asking…' : 'Ask AI'}
              </button>
            </div>
            <pre style={{ 
              width: '100%',
              minHeight: '120px',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              padding: '10px',
              borderRadius: '5px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              marginTop: '10px',
              fontSize: '14px',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
            }}>
              {aiResponse}
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