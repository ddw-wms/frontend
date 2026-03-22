// File Path = warehouse-frontend\app\login\page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Link,
} from '@mui/material';

import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Warehouse as WarehouseIcon,
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';
import { login } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';


export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState(''); // Default for demo
  const [password, setPassword] = useState(''); // Default for demo
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved username on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);




  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return false;
    }

    setLoading(true);

    // Timer: If login takes longer than 3 seconds → show wake-up message
    const wakeUpTimer = setTimeout(() => {
      toast.loading('⏳ Server is waking up... please wait (30-60 seconds)', {
        id: 'wake-msg',
        duration: 120000, // Keep showing for 2 minutes
      });
    }, 3000); // 3 seconds

    try {
      await login(username, password);

      clearTimeout(wakeUpTimer);
      toast.dismiss('wake-msg');

      // Save username if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      toast.success('✓ Login successful!', {
        icon: '🎉',
        duration: 1500,
      });

      // Redirect to intended page (from middleware redirect param) or dashboard
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      setTimeout(() => {
        router.push(redirectTo);
      }, 500);

    } catch (error: any) {
      clearTimeout(wakeUpTimer);
      toast.dismiss('wake-msg');

      // Better error messages based on error type
      const status = error.response?.status;
      const serverMessage = error.response?.data?.error || error.response?.data?.message;
      const attemptsLeft = error.response?.data?.attemptsLeft;
      const lockedUntil = error.response?.data?.lockedUntil;

      let errorMsg: string;
      let toastType: 'error' | 'warning' = 'error';

      if (status === 503) {
        errorMsg = 'Server is still starting up. Please wait a minute and try again.';
      } else if (status === 504) {
        errorMsg = 'Request timed out. Please try again.';
      } else if (status === 429) {
        // Rate limited
        const retryAfter = error.response?.data?.retryAfter || 60;
        errorMsg = `⏳ Too many requests. Please wait ${retryAfter} seconds before trying again.`;
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMsg = 'Cannot connect to server. Please check your internet connection or try again in a minute.';
      } else if (error.code === 'ECONNABORTED') {
        errorMsg = 'Connection timed out. Please try again.';
      } else if (status === 423) {
        // Account locked
        if (lockedUntil) {
          const lockTime = new Date(lockedUntil);
          const minutesLeft = Math.ceil((lockTime.getTime() - Date.now()) / 60000);
          errorMsg = `🔒 Account locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`;
        } else {
          errorMsg = serverMessage || 'Account temporarily locked. Please try again later.';
        }
        toastType = 'error';
      } else if (status === 401) {
        // Invalid credentials with attempts tracking
        if (attemptsLeft !== undefined && attemptsLeft !== null) {
          if (attemptsLeft <= 2 && attemptsLeft > 0) {
            errorMsg = `⚠️ ${serverMessage || 'Invalid credentials'}`;
            toastType = 'warning';
          } else if (attemptsLeft === 0) {
            errorMsg = `🔒 ${serverMessage || 'Account locked due to too many failed attempts'}`;
          } else {
            errorMsg = serverMessage || 'Invalid username or password';
          }
        } else {
          errorMsg = serverMessage || 'Invalid username or password';
        }
      } else {
        errorMsg = serverMessage || 'Login failed. Please try again.';
      }

      // Use appropriate toast based on severity
      if (toastType === 'warning') {
        toast.error(errorMsg, {
          style: {
            background: '#ff9800',
            color: '#000',
            fontWeight: 500,
          },
          duration: 4000,
        });
      } else {
        toast.error('✗ ' + errorMsg, { duration: 4000 });
      }

    } finally {
      setLoading(false);
    }
  };



  return (
    <>
      <Toaster position="top-center" />

      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e3a8a 100%)',
          padding: { xs: 2, sm: 3 },
          paddingTop: { xs: 'env(safe-area-inset-top)', sm: 3 },
          paddingBottom: { xs: 'env(safe-area-inset-bottom)', sm: 3 },
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            animation: 'pulse 8s ease-in-out infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: `
              radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
              radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            backgroundPosition: '0 0, 30px 30px',
            opacity: 0.4,
            animation: 'drift 25s linear infinite',
          },
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.7 },
          },
          '@keyframes drift': {
            '0%': { transform: 'translate(0, 0)' },
            '100%': { transform: 'translate(60px, 60px)' },
          },
          '@keyframes slideUp': {
            from: { opacity: 0, transform: 'translateY(30px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          '@keyframes float': {
            '0%, 100%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-8px)' },
          },
          '@keyframes shimmer': {
            '0%': { backgroundPosition: '-1000px 0' },
            '100%': { backgroundPosition: '1000px 0' },
          },
          '@keyframes glow': {
            '0%, 100%': { boxShadow: '0 0 20px rgba(30, 64, 175, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)' },
            '50%': { boxShadow: '0 0 40px rgba(30, 64, 175, 0.6), 0 0 80px rgba(59, 130, 246, 0.3)' },
          },
        }}
      >
        <Container maxWidth="sm" sx={{
          animation: 'slideUp 0.6s ease-out',
          position: 'relative',
          zIndex: 1,
          px: { xs: 1, sm: 2, md: 3 },
        }}>
          {/* Decorative Floating Shapes - Hidden on mobile for performance */}
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              top: -40,
              left: -40,
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
              borderRadius: '50%',
              animation: 'float 6s ease-in-out infinite',
              filter: 'blur(1px)',
            }}
          />
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              bottom: -30,
              right: -30,
              width: 60,
              height: 60,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
              borderRadius: '50%',
              animation: 'float 8s ease-in-out infinite',
              animationDelay: '1s',
              filter: 'blur(1px)',
            }}
          />

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: { xs: 3, sm: 4 },
              background: 'rgba(255, 255, 255, 0.97)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.12), 0 0 80px rgba(30, 64, 175, 0.15)',
              transition: 'all 0.3s ease',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: { xs: 3, sm: 4 },
                padding: '2px',
                background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.2), rgba(59, 130, 246, 0.2))',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: { xs: 'none', md: 'glow 3s ease-in-out infinite' },
              },
              '&:hover': {
                boxShadow: { xs: '0 8px 32px 0 rgba(0, 0, 0, 0.12)', md: '0 12px 48px 0 rgba(0, 0, 0, 0.18), 0 0 100px rgba(30, 64, 175, 0.2)' },
                transform: { xs: 'none', md: 'translateY(-5px)' },
              },
            }}
          >
            {/* Logo & Title */}
            <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 }, animation: 'fadeIn 0.8s ease-out' }}>
              <WarehouseIcon
                sx={{
                  fontSize: { xs: 52, sm: 64 },
                  color: 'primary.main',
                  mb: 2,
                  animation: { xs: 'none', md: 'float 3s ease-in-out infinite' },
                  filter: 'drop-shadow(0 4px 8px rgba(30, 64, 175, 0.25))',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.1) rotate(5deg)',
                    filter: 'drop-shadow(0 8px 16px rgba(30, 64, 175, 0.4))',
                  },
                }}
              />
              <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                gutterBottom
                sx={{
                  fontSize: { xs: '1.5rem', sm: '2rem' },
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'fadeIn 1s ease-out 0.2s backwards',
                }}
              >
                Divine WMS
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  animation: 'fadeIn 1s ease-out 0.4s backwards',
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                }}
              >
                Multi-Warehouse Inventory System
              </Typography>
            </Box>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <Box sx={{ mb: { xs: 2.5, sm: 3 }, animation: 'fadeIn 1s ease-out 0.6s backwards' }}>
                <TextField
                  fullWidth
                  label="Username"
                  variant="outlined"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoFocus
                  placeholder="Enter your username"
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      height: { xs: 52, sm: 56 },
                      transition: 'all 0.3s ease',
                      borderRadius: 2.5,
                      bgcolor: '#f8fafc',
                      '&:hover': {
                        bgcolor: '#f1f5f9',
                        boxShadow: '0 2px 8px rgba(30, 64, 175, 0.1)',
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white',
                        boxShadow: '0 4px 16px rgba(30, 64, 175, 0.15)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                          borderWidth: 2,
                        },
                      },
                      '& input:-webkit-autofill': {
                        WebkitBoxShadow: '0 0 0 1000px white inset',
                        WebkitTextFillColor: '#000',
                      },
                      '& input:-webkit-autofill:focus': {
                        WebkitBoxShadow: '0 0 0 1000px white inset',
                        WebkitTextFillColor: '#000',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontWeight: 500,
                    },
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  variant="outlined"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Enter your password"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: { xs: 52, sm: 56 },
                      transition: 'all 0.3s ease',
                      borderRadius: 2.5,
                      bgcolor: '#f8fafc',
                      '&:hover': {
                        bgcolor: '#f1f5f9',
                        boxShadow: '0 2px 8px rgba(30, 64, 175, 0.1)',
                      },
                      '&.Mui-focused': {
                        bgcolor: 'white',
                        boxShadow: '0 4px 16px rgba(30, 64, 175, 0.15)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main',
                          borderWidth: 2,
                        },
                      },
                      '& input:-webkit-autofill': {
                        WebkitBoxShadow: '0 0 0 1000px white inset',
                        WebkitTextFillColor: '#000',
                      },
                      '& input:-webkit-autofill:focus': {
                        WebkitBoxShadow: '0 0 0 1000px white inset',
                        WebkitTextFillColor: '#000',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontWeight: 500,
                    },
                  }}
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{
                            width: 44,
                            height: 44,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(30, 64, 175, 0.08)',
                            },
                          }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              {/* Remember Me & Forgot Password */}
              <Box sx={{
                mb: { xs: 2.5, sm: 3 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animation: 'fadeIn 1s ease-out 0.8s backwards',
                flexWrap: 'wrap',
                gap: 1,
              }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                      size="small"
                      sx={{
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      Remember me
                    </Typography>
                  }
                />
                <Link
                  href="#"
                  underline="hover"
                  variant="body2"
                  sx={{
                    color: 'primary.main',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    fontWeight: 500,
                    '&:hover': {
                      color: 'primary.dark',
                      transform: 'translateX(3px)',
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    toast('Contact admin to reset password', { icon: '🔐' });
                  }}
                >
                  Forgot password?
                </Link>
              </Box>
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <LoginIcon />}
                sx={{
                  py: { xs: 1.5, sm: 1.75 },
                  fontSize: { xs: '0.95rem', sm: '1rem' },
                  fontWeight: 600,
                  borderRadius: 2.5,
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  backgroundSize: '200% auto',
                  boxShadow: '0 4px 16px rgba(30, 64, 175, 0.35)',
                  transition: 'all 0.3s ease',
                  animation: 'fadeIn 1s ease-out 1s backwards',
                  minHeight: { xs: 52, sm: 56 },
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                    backgroundSize: '200% auto',
                    boxShadow: '0 6px 24px rgba(30, 64, 175, 0.45)',
                    transform: { xs: 'none', md: 'translateY(-2px)' },
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  '&:disabled': {
                    background: 'rgba(0,0,0,0.12)',
                    boxShadow: 'none',
                  },
                }}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            {/* Footer */}
            <Typography
              variant="caption"
              color="text.secondary"
              align="center"
              display="block"
              mt={{ xs: 2.5, sm: 3 }}
              sx={{
                animation: 'fadeIn 1s ease-out 1.2s backwards',
                opacity: 0.6,
                transition: 'opacity 0.3s ease',
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              Divine WMS ©  {new Date().getFullYear()} | Devolped by Sr@n
            </Typography>
          </Paper>
        </Container>
      </Box>
    </>
  );
}
