import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, Paper, Alert, Link,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import {
  Visibility, VisibilityOff, Email as EmailIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { login } from '../services/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@interviewhub.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify({ email }));
      navigate('/');
    } catch (err: any) {
      if (err.response) {
        setError(err.response.data?.detail || 'Invalid credentials. Please try again.');
      } else if (err.request) {
        setError('Cannot connect to the backend server. Make sure the backend is running on http://localhost:8000');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4338ca 60%, #6366f1 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative elements */}
      <Box sx={{
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3), transparent 70%)',
      }} />
      <Box sx={{
        position: 'absolute', bottom: -150, left: -150,
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)',
      }} />

      {/* Left Side - Branding */}
      <Box sx={{
        flex: 1, display: { xs: 'none', md: 'flex' },
        flexDirection: 'column', justifyContent: 'center',
        px: 8, position: 'relative', zIndex: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: 3,
            background: 'linear-gradient(135deg, #818cf8, #c084fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.5rem', color: '#fff',
          }}>
            IH
          </Box>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 800 }}>
            InterviewHub
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ color: '#c7d2fe', fontWeight: 400, mb: 3, lineHeight: 1.5 }}>
          The modern technical interview platform for teams that hire the best.
        </Typography>
        <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
          {[
            { label: 'Interviews Conducted', value: '50K+' },
            { label: 'Companies Trust Us', value: '200+' },
            { label: 'Avg. Time Saved', value: '60%' },
          ].map((stat) => (
            <Box key={stat.label}>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 800 }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" sx={{ color: '#a5b4fc' }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right Side - Login Form */}
      <Box sx={{
        flex: { xs: 1, md: 0 },
        width: { md: 520 },
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: 4, position: 'relative', zIndex: 1,
      }}>
        <Paper
          elevation={0}
          sx={{
            p: 5, width: '100%', maxWidth: 440,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#1e293b' }}>
            Welcome back
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
            Sign in to your InterviewHub account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              variant="outlined"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              variant="outlined"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 1 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <Link href="#" underline="hover" sx={{ fontSize: '0.85rem', color: '#6366f1' }}>
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Don't have an account?{' '}
              <Link href="#" underline="hover" sx={{ color: '#6366f1', fontWeight: 600 }}>
                Request Access
              </Link>
            </Typography>
          </Box>

          {/* Demo Credentials */}
          <Box sx={{
            mt: 3, p: 2, borderRadius: 2,
            bgcolor: '#f0f0ff', border: '1px solid #e0e0ff',
          }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#4f46e5', display: 'block', mb: 0.5 }}>
              Demo Credentials
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
              Email: admin@interviewhub.com
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Password: admin123
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Login;
