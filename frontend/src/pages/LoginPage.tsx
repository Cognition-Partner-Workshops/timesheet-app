import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

type LoginStep = 'email' | 'otp';

const LoginPage: React.FC = () => {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { requestOtp, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await requestOtp(email);
      setStep('otp');
      setInfo('A 6-digit verification code has been sent to your email.');
      setResendCooldown(30);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste of full OTP
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtpDigits = [...otpDigits];
      digits.forEach((d, i) => {
        if (index + i < 6) {
          newOtpDigits[index + i] = d;
        }
      });
      setOtpDigits(newOtpDigits);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = value;
    setOtpDigits(newOtpDigits);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setError('');
    setInfo('');
    setIsLoading(true);

    try {
      await verifyOtp(email, code);
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Verification failed. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setIsLoading(true);

    try {
      await resendOtp(email);
      setInfo('A new verification code has been sent to your email.');
      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setError('');
    setInfo('');
    setOtpDigits(['', '', '', '', '', '']);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          px: 2,
        }}
      >
        <Paper elevation={3} sx={{ padding: 3, width: '100%', maxWidth: 500 }}>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
            Time Tracker
          </Typography>

          {step === 'email' ? (
            <>
              <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
                Enter your email to receive a verification code
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleEmailSubmit}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 2, mb: 1 }}
                  disabled={isLoading || !email}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Send Verification Code'}
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 1 }}>
                Enter the 6-digit code sent to
              </Typography>
              <Typography variant="body1" align="center" fontWeight="bold" sx={{ mb: 2 }}>
                {email}
              </Typography>

              {info && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {info}
                </Alert>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleOtpSubmit}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 1,
                    mb: 3,
                    mt: 2,
                  }}
                >
                  {otpDigits.map((digit, index) => (
                    <TextField
                      key={index}
                      inputRef={(el) => { otpInputRefs.current[index] = el; }}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      disabled={isLoading}
                      slotProps={{
                        htmlInput: {
                          maxLength: 6,
                          style: {
                            textAlign: 'center',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            padding: '12px 0',
                            width: '48px',
                          },
                        },
                      }}
                      variant="outlined"
                    />
                  ))}
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mb: 2 }}
                  disabled={isLoading || otpDigits.join('').length !== 6}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Verify & Log In'}
                </Button>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={handleBackToEmail}
                    sx={{ cursor: 'pointer' }}
                  >
                    Use a different email
                  </Link>
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleResend}
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;
