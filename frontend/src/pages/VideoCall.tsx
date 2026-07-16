import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Box, Typography, Card, IconButton, Tooltip, Avatar, Chip,
  Button, Divider, TextField, Badge,
} from '@mui/material';
import {
  Mic as MicIcon, MicOff as MicOffIcon,
  Videocam as VideocamIcon, VideocamOff as VideocamOffIcon,
  ScreenShare as ScreenShareIcon, StopScreenShare as StopScreenShareIcon,
  CallEnd as CallEndIcon, Chat as ChatIcon,
  Code as CodeIcon, People as PeopleIcon,
  Send as SendIcon, PlayArrow as RunIcon,
  FiberManualRecord as RecordIcon,
} from '@mui/icons-material';
import { runCode } from '../services/api';

interface ChatMessage {
  id: number;
  sender: string;
  text: string;
  time: string;
}

const VideoCall: React.FC = () => {
  const [searchParams] = useSearchParams();
  const interviewTitle = searchParams.get('title') || 'Technical Interview';
  const candidateName = searchParams.get('candidate') || 'Candidate';
  const interviewerName = searchParams.get('interviewer') || 'Interviewer';

  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCode, setShowCode] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [code, setCode] = useState(`# Collaborative Code Editor\n# Both interviewer and candidate can edit here\n\ndef solution():\n    """Write your solution here"""\n    pass\n\n# Run your code to see output\nprint("Hello from InterviewHub!")\n`);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, sender: interviewerName, text: 'Welcome to the interview! Let\'s start with a quick introduction.', time: '00:00' },
    { id: 2, sender: candidateName, text: 'Thank you! Excited to be here.', time: '00:15' },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    const newMsg: ChatMessage = {
      id: messages.length + 1,
      sender: 'You',
      text: chatMessage,
      time: formatDuration(callDuration),
    };
    setMessages([...messages, newMsg]);
    setChatMessage('');
  };

  const handleRunCode = async () => {
    setRunning(true);
    try {
      const res = await runCode('python', code);
      setOutput(res.data.output || res.data.error || '');
    } catch (err) {
      setOutput('Error executing code');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box sx={{ height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Top Bar */}
      <Card sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={<RecordIcon sx={{ fontSize: 12, color: '#ef4444 !important', animation: 'pulse 1.5s infinite' }} />}
            label="LIVE"
            size="small"
            sx={{ bgcolor: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: '0.7rem' }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {interviewTitle}
          </Typography>
          <Chip
            label={formatDuration(callDuration)}
            size="small"
            sx={{ bgcolor: '#f1f5f9', fontWeight: 600, fontFamily: 'monospace' }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={showCode ? 'Hide Code Editor' : 'Show Code Editor'}>
            <IconButton onClick={() => setShowCode(!showCode)} sx={{
              bgcolor: showCode ? '#eff6ff' : 'transparent',
              color: showCode ? '#3b82f6' : '#64748b',
            }}>
              <CodeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={showChat ? 'Hide Chat' : 'Show Chat'}>
            <IconButton onClick={() => setShowChat(!showChat)} sx={{
              bgcolor: showChat ? '#eff6ff' : 'transparent',
              color: showChat ? '#3b82f6' : '#64748b',
            }}>
              <Badge badgeContent={0} color="error">
                <ChatIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>
      </Card>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', gap: 1.5, minHeight: 0 }}>
        {/* Video Area */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: showCode ? (showChat ? '30%' : '35%') : (showChat ? '70%' : '100%'), transition: 'width 0.3s ease' }}>
          {/* Main Video */}
          <Card sx={{
            flex: 1,
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.1), transparent 70%)',
            }} />
            {videoOn ? (
              <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <Avatar sx={{
                  width: 120, height: 120, fontSize: '3rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  mb: 2, mx: 'auto',
                  border: '4px solid rgba(255,255,255,0.2)',
                }}>
                  {candidateName.split(' ').map(n => n[0]).join('')}
                </Avatar>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                  {candidateName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                  Candidate
                </Typography>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <VideocamOffIcon sx={{ fontSize: 64, color: '#475569' }} />
                <Typography variant="body2" sx={{ color: '#94a3b8', mt: 1 }}>
                  Camera is off
                </Typography>
              </Box>
            )}

            {/* Self-view PIP */}
            <Card sx={{
              position: 'absolute', bottom: 16, right: 16,
              width: 160, height: 120,
              background: 'linear-gradient(135deg, #1e293b, #334155)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.1)',
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar sx={{
                  width: 48, height: 48, fontSize: '1.2rem',
                  background: 'linear-gradient(135deg, #ec4899, #f472b6)',
                  mx: 'auto', mb: 0.5,
                }}>
                  {interviewerName.split(' ').map(n => n[0]).join('')}
                </Avatar>
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: '0.65rem' }}>
                  You
                </Typography>
              </Box>
            </Card>

            {/* Participant count */}
            <Chip
              icon={<PeopleIcon sx={{ fontSize: 14, color: '#fff !important' }} />}
              label="2"
              size="small"
              sx={{
                position: 'absolute', top: 12, left: 12,
                bgcolor: 'rgba(0,0,0,0.5)', color: '#fff',
                fontWeight: 600, fontSize: '0.7rem',
              }}
            />
          </Card>

          {/* Call Controls */}
          <Card sx={{ p: 1.5, display: 'flex', justifyContent: 'center', gap: 1.5 }}>
            <Tooltip title={micOn ? 'Mute' : 'Unmute'}>
              <IconButton
                onClick={() => setMicOn(!micOn)}
                sx={{
                  bgcolor: micOn ? '#f1f5f9' : '#ef4444',
                  color: micOn ? '#1e293b' : '#fff',
                  width: 48, height: 48,
                  '&:hover': { bgcolor: micOn ? '#e2e8f0' : '#dc2626' },
                }}
              >
                {micOn ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={videoOn ? 'Turn off camera' : 'Turn on camera'}>
              <IconButton
                onClick={() => setVideoOn(!videoOn)}
                sx={{
                  bgcolor: videoOn ? '#f1f5f9' : '#ef4444',
                  color: videoOn ? '#1e293b' : '#fff',
                  width: 48, height: 48,
                  '&:hover': { bgcolor: videoOn ? '#e2e8f0' : '#dc2626' },
                }}
              >
                {videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title={screenSharing ? 'Stop sharing' : 'Share screen'}>
              <IconButton
                onClick={() => setScreenSharing(!screenSharing)}
                sx={{
                  bgcolor: screenSharing ? '#3b82f6' : '#f1f5f9',
                  color: screenSharing ? '#fff' : '#1e293b',
                  width: 48, height: 48,
                  '&:hover': { bgcolor: screenSharing ? '#2563eb' : '#e2e8f0' },
                }}
              >
                {screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="End Call">
              <IconButton
                sx={{
                  bgcolor: '#ef4444', color: '#fff',
                  width: 56, height: 48, borderRadius: 3,
                  '&:hover': { bgcolor: '#dc2626' },
                }}
              >
                <CallEndIcon />
              </IconButton>
            </Tooltip>
          </Card>
        </Box>

        {/* Code Editor Panel */}
        {showCode && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
            <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Code Header */}
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider',
                bgcolor: '#1e1e1e',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CodeIcon sx={{ fontSize: 18, color: '#818cf8' }} />
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                    Collaborative Editor
                  </Typography>
                  <Chip label="Python" size="small" sx={{
                    bgcolor: '#2d2d2d', color: '#a78bfa', fontWeight: 600, fontSize: '0.7rem', height: 22,
                  }} />
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={running ? undefined : <RunIcon />}
                  onClick={handleRunCode}
                  disabled={running}
                  sx={{
                    bgcolor: '#10b981', fontSize: '0.75rem', px: 2, py: 0.5,
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  {running ? 'Running...' : 'Run Code'}
                </Button>
              </Box>
              {/* Editor */}
              <Box sx={{ flex: 1 }}>
                <Editor
                  height="100%"
                  language="python"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineHeight: 22,
                    padding: { top: 12 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </Box>
              {/* Output */}
              <Box sx={{
                borderTop: '1px solid #333', bgcolor: '#0d1117',
                p: 1.5, maxHeight: 150, overflow: 'auto',
              }}>
                <Typography variant="caption" sx={{ color: '#8b949e', fontWeight: 600, display: 'block', mb: 0.5 }}>
                  OUTPUT
                </Typography>
                <Typography variant="body2" sx={{
                  color: output ? '#c9d1d9' : '#484f58',
                  fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap',
                }}>
                  {output || 'Run code to see output...'}
                </Typography>
              </Box>
            </Card>
          </Box>
        )}

        {/* Chat Panel */}
        {showChat && (
          <Card sx={{ width: 300, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Interview Chat
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {messages.map((msg) => (
                <Box key={msg.id} sx={{
                  alignSelf: msg.sender === 'You' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.3 }}>
                    {msg.sender} · {msg.time}
                  </Typography>
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: msg.sender === 'You' ? '#6366f1' : '#f1f5f9',
                    color: msg.sender === 'You' ? '#fff' : '#1e293b',
                  }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {msg.text}
                    </Typography>
                  </Box>
                </Box>
              ))}
              <div ref={chatEndRef} />
            </Box>
            <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
              <TextField
                fullWidth size="small" placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <IconButton onClick={handleSendMessage} sx={{ color: '#6366f1' }}>
                <SendIcon />
              </IconButton>
            </Box>
          </Card>
        )}
      </Box>

      {/* Pulse animation for recording indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </Box>
  );
};

export default VideoCall;
