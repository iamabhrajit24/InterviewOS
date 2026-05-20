"use client";

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import { Play, CheckCircle2, Terminal } from 'lucide-react';
import { useInterviewStore } from '@/store/interviewStore';

export function CodeEditor() {
  const { sendMessage, setSubmittedCode } = useInterviewStore();
  const [code, setCode] = useState('// Write your solution here\n\nfunction solution() {\n  \n}\n');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRunCode = () => {
    setIsRunning(true);
    setOutput('Running code...');
    
    // Simulate execution
    setTimeout(() => {
      setOutput('Execution completed.\nOutput: [Simulated result]\n\nTime: 42ms\nMemory: 32MB');
      setIsRunning(false);
    }, 1200);
  };

  const handleSubmitSolution = () => {
    sendMessage(`[CODE_SUBMISSION] Language: ${language}\n\n${code}`);
    setSubmittedCode(code);
    setOutput('Solution submitted to interviewer. I will evaluate this and the complete detailed code review will be compiled in your final report after the session concludes!');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] border-x border-zinc-800">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <select 
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-zinc-800 text-xs text-zinc-300 border border-zinc-700 rounded-md px-2 py-1 outline-none focus:border-blue-500"
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-md transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
          <button 
            onClick={handleSubmitSolution}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Submit
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={(val) => setCode(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
          }}
        />
      </div>

      {/* Terminal Output */}
      <div className="h-48 bg-zinc-950 border-t border-zinc-800 flex flex-col">
        <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400">Terminal Output</span>
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-zinc-300 whitespace-pre-wrap">
          {output || 'Ready.'}
        </div>
      </div>
    </div>
  );
}
