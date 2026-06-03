'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import * as monaco from 'monaco-editor';

interface ContractEditorProps {
  contractName: string;
  onContentChange: (content: string) => void;
  onCompile: () => void;
  onClose: () => void;
}

export default function ContractEditor({ 
  contractName, 
  onContentChange, 
  onCompile,
  onClose 
}: ContractEditorProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compileLogs, setCompileLogs] = useState('');
  const [compileSuccess, setCompileSuccess] = useState(false);
  const [monacoEditor, setMonacoEditor] = useState<any>(null);
  const editorRef = useRef<any>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    setMonacoEditor(monaco);
  }, []);

  // Thème Solidity
  useEffect(() => {
    if (!monacoEditor) return;
    const currentTheme = theme === 'dark' ? 'solidity-dark' : 'solidity-light';
    
    monacoEditor.editor.defineTheme('solidity-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment.solidity', foreground: '6B7280' },
        { token: 'keyword.main', foreground: 'F59E0B', fontStyle: 'bold' },
        { token: 'keyword.flow', foreground: '8B5CF6' },
        { token: 'type.base', foreground: '06B6D4' },
        { token: 'type.modifier', foreground: '10B981' },
        { token: 'builtin', foreground: 'F59E0B' },
        { token: 'string.solidity', foreground: 'EF4444' },
        { token: 'number', foreground: '10B981' },
        { token: 'number.hex', foreground: '3B82F6' },
      ],
      colors: {
        'editor.background': '#111827',
        'editor.foreground': '#F3F4F6',
        'editorCursor.foreground': '#3B82F6',
        'editor.lineHighlightBackground': '#1F2937',
      }
    });
    monacoEditor.editor.setTheme(currentTheme);
  }, [monacoEditor, theme]);

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;
    const value = editorRef.current.getValue();
    try {
      const res = await fetch('/api/contracts/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contractName, content: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      setContent(value);
      onContentChange(value);
      setError('');
    } catch (err: any) {
      setError('Erreur sauvegarde');
    }
  }, [contractName, onContentChange]);

  const handleCompileHardhat = useCallback(async () => {
    if (!editorRef.current) return;
    
    setCompileLogs('🔄 Nettoyage cache...\n');
    setCompileSuccess(false);
    setError('');
    
    const value = editorRef.current.getValue();
    try {
      const res = await fetch('/api/contracts/compile-hardhat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contractName, content: value }),
      });

      const result = await res.json();
      
      // Logs détaillés
      let logs = `📝 Compilation ${contractName}.sol\n`;
      logs += `─────────────────────────────\n`;
      
      if (result.success) {
        logs += `✅ SUCCÈS\n`;
        logs += `📁 Artifact: ${result.artifactPath || 'Généré'}\n`;
        setCompileSuccess(true);
      } else {
        logs += `❌ ÉCHEC\n`;
      }
      
      logs += `─────────────────────────────\n`;
      logs += `STDOUT:\n${result.stdout || 'Aucun'}\n`;
      logs += `STDERR:\n${result.stderr || 'Aucun'}\n`;
      
      setCompileLogs(logs);
      console.log('✅ Hardhat compilation:', result);
      onCompile();
      
      // Scroll auto vers les logs
      logsRef.current?.scrollIntoView({ behavior: 'smooth' });
      
    } catch (err: any) {
      const logs = `💥 ERREUR Hardhat\n─────────────────────────────\n${err.message}\n`;
      setCompileLogs(logs);
      setError(`Hardhat: ${err.message}`);
      console.error('Hardhat error:', err);
    }
  }, [contractName, onCompile]);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/contracts/read?name=${contractName}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setContent(data.content);
        onContentChange(data.content);
      })
      .catch(err => {
        const fallback = `// Fallback contract\npragma solidity ^0.8.24;\n\ncontract ${contractName} {}`;
        setContent(fallback);
        onContentChange(fallback);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [contractName, onContentChange]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-zinc-300 font-medium">Chargement {contractName}.sol...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900/95 border-b border-zinc-800 p-4 flex items-center gap-4 sticky top-0 z-10">
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
          title="Fermer"
        >
          ←
        </button>
        <h3 className="font-mono text-xl font-semibold text-zinc-200 truncate flex-1">
          {contractName}.sol
        </h3>
        {error && (
          <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/50 text-red-300 text-xs rounded-lg font-mono">
            ⚠️ {error}
          </div>
        )}
        <div className="flex gap-2">
          <button 
            onClick={handleSave}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-sm font-mono rounded-lg transition-colors whitespace-nowrap"
          >
            Save
          </button>
          <button 
            onClick={handleCompileHardhat}
            className="px-4 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-500/50 text-sm font-mono font-semibold rounded-lg transition-all hover:scale-[1.02] whitespace-nowrap"
            title="Compiler avec Hardhat"
          >
            Compile (Hardhat)
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 bg-zinc-900 border-t border-zinc-800 overflow-hidden">
        <Editor 
          height="100%" 
          language="solidity" 
          theme={theme === 'dark' ? 'solidity-dark' : 'solidity-light'}
          value={content}
          onChange={(value) => {
            setContent(value || '');
            onContentChange(value || '');
          }}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            bracketPairColorization: { enabled: true },
          }}
          beforeMount={(monaco) => {
            monaco.languages.register({ id: 'solidity' });
            monaco.languages.setMonarchTokensProvider('solidity', {
              tokenizer: {
                root: [
                  [/@.*$/, 'comment.solidity'],
                  [/\b(pragma|contract|function|constructor|event|struct|enum|interface|library|modifier|fallback|receive)\b/, 'keyword.main'],
                  [/\b(if|else|for|while|do|return|emit|import|using|try|catch|assembly|break|continue)\b/, 'keyword.flow'],
                  [/\b(uint|int|uint8|int8|uint16|int16|uint256|int256|bytes|bytes32|address|string|bool|mapping|array)\b/, 'type.base'],
                  [/\b(public|private|internal|external|view|pure|payable|virtual|override|constant|immutable|memory|storage|calldata|indexed)\b/, 'type.modifier'],
                  [/\b(require|assert|revert|selfdestruct|gasleft|block|msg|tx|abi|keccak256)\b/, 'builtin'],
                  [/"([^"\\]|\\.)*"/, 'string.solidity'],
                  [/0x[0-9a-fA-F]+/, 'number.hex'],
                  [/[0-9]+/, 'number'],
                  [/[a-zA-Z_$][a-zA-Z0-9_$]*/, 'identifier'],
                  [/[+\-*/=<>!&|.%^~]+/, 'operator'],
                  [/[{}[\.,;]+/, 'delimiter'],
                ]
              }
            });
          }}
        />
      </div>

      {/* 🔥 BOX LOGS COMPILATION */}
      {compileLogs && (
        <div 
          ref={logsRef}
          className="h-48 bg-zinc-950/90 border-t border-zinc-700 p-4 font-mono text-xs overflow-y-auto"
        >
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
            compileSuccess 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
              : 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
          }`}>
            📊 Logs Compilation {compileSuccess ? '✅' : '⚠️'}
          </div>
          <pre className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {compileLogs}
          </pre>
          <div className="text-zinc-500 text-[10px] mt-2 opacity-75">
            Clique Compile pour rafraîchir
          </div>
        </div>
      )}
    </div>
  );
}
