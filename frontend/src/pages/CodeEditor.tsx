import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Box, Typography, Card, Button, MenuItem,
  Select, FormControl, IconButton, Tooltip,
  Chip, CircularProgress, Tab, Tabs,
} from '@mui/material';
import {
  PlayArrow as RunIcon, ContentCopy as CopyIcon,
  RestartAlt as ResetIcon,
  Code as CodeIcon, Terminal as TerminalIcon,
  LightMode as LightModeIcon, DarkMode as DarkModeIcon,
} from '@mui/icons-material';
import { runCode } from '../services/api';

const defaultCode: Record<string, string> = {
  python: `# Welcome to InterviewHub Code Editor
# Write your solution below

def solution():
    """Your solution here"""
    # Example: Two Sum
    nums = [2, 7, 11, 15]
    target = 9
    
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Run your solution
result = solution()
print(f"Result: {result}")
`,
  javascript: `// Welcome to InterviewHub Code Editor
// Write your solution below

function solution() {
    // Example: Two Sum
    const nums = [2, 7, 11, 15];
    const target = 9;
    
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (seen.has(complement)) {
            return [seen.get(complement), i];
        }
        seen.set(nums[i], i);
    }
    return [];
}

// Run your solution
const result = solution();
console.log(\`Result: \${JSON.stringify(result)}\`);
`,
};

const CodeEditor: React.FC = () => {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(defaultCode.python);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [activeOutputTab, setActiveOutputTab] = useState(0);
  const editorRef = useRef<any>(null);

  const handleRun = async () => {
    setRunning(true);
    setOutput('');
    setError('');
    try {
      const res = await runCode(language, code);
      setOutput(res.data.output || '');
      setError(res.data.error || '');
    } catch (err: any) {
      setError(err.message || 'Failed to execute code');
    } finally {
      setRunning(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(defaultCode[lang] || '');
    setOutput('');
    setError('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  const handleReset = () => {
    setCode(defaultCode[language] || '');
    setOutput('');
    setError('');
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <Box sx={{ height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Code Editor
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Write, run, and test code in real-time
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Toggle Theme">
            <IconButton
              onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
              sx={{
                bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
              }}
            >
              {editorTheme === 'vs-dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Main Editor Area */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, minHeight: 0 }}>
        {/* Editor Panel */}
        <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 2,
            px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider',
            bgcolor: editorTheme === 'vs-dark' ? '#1e1e1e' : '#fff',
          }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                sx={{
                  bgcolor: editorTheme === 'vs-dark' ? '#2d2d2d' : '#f1f5f9',
                  color: editorTheme === 'vs-dark' ? '#fff' : '#1e293b',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                <MenuItem value="python">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon sx={{ fontSize: 18 }} /> Python
                  </Box>
                </MenuItem>
                <MenuItem value="javascript">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon sx={{ fontSize: 18 }} /> JavaScript
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ flex: 1 }} />

            <Tooltip title="Copy Code">
              <IconButton size="small" onClick={handleCopy}
                sx={{ color: editorTheme === 'vs-dark' ? '#94a3b8' : '#64748b' }}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset">
              <IconButton size="small" onClick={handleReset}
                sx={{ color: editorTheme === 'vs-dark' ? '#94a3b8' : '#64748b' }}>
                <ResetIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={running ? <CircularProgress size={16} color="inherit" /> : <RunIcon />}
              onClick={handleRun}
              disabled={running}
              size="small"
              sx={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
                px: 3, fontWeight: 700,
              }}
            >
              {running ? 'Running...' : 'Run Code'}
            </Button>
          </Box>

          {/* Monaco Editor */}
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              height="100%"
              language={language}
              value={code}
              theme={editorTheme}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                renderLineHighlight: 'all',
                bracketPairColorization: { enabled: true },
                fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                fontLigatures: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordWrap: 'on',
              }}
            />
          </Box>
        </Card>

        {/* Output Panel */}
        <Card sx={{ width: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{
            px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider',
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <Tabs value={activeOutputTab} onChange={(_, v) => setActiveOutputTab(v)}
              sx={{ '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8rem' } }}>
              <Tab icon={<TerminalIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Output" />
            </Tabs>
            {running && (
              <Chip label="Running..." size="small" color="success" variant="outlined"
                sx={{ ml: 'auto', animation: 'pulse 1s infinite' }} />
            )}
          </Box>

          <Box sx={{
            flex: 1, p: 2, overflow: 'auto',
            bgcolor: '#1e1e1e', fontFamily: 'monospace',
          }}>
            {output && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  OUTPUT
                </Typography>
                <pre style={{
                  color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem', lineHeight: 1.6,
                }}>
                  {output}
                </pre>
              </Box>
            )}
            {error && (
              <Box>
                <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  ERRORS
                </Typography>
                <pre style={{
                  color: '#f87171', margin: 0, whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem', lineHeight: 1.6,
                }}>
                  {error}
                </pre>
              </Box>
            )}
            {!output && !error && !running && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <TerminalIcon sx={{ fontSize: 48, color: '#475569', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#94a3b8', textAlign: 'center' }}>
                  Click "Run Code" to see output here
                </Typography>
              </Box>
            )}
          </Box>
        </Card>
      </Box>
    </Box>
  );
};

export default CodeEditor;
