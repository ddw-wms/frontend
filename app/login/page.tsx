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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin'); // Default for demo
  const [password, setPassword] = useState('admin123'); // Default for demo
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

    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);

    // Timer: If login takes longer than 4 seconds → show wake-up message
    const wakeUpTimer = setTimeout(() => {
      toast.loading('⏳ Waking up the server... Render free plan may take 20–40 seconds', {
        id: 'wake-msg',
      });
    }, 4000); // 4 seconds

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

      setTimeout(() => {
        router.push('/dashboard');
      }, 500);

    } catch (error: any) {
      clearTimeout(wakeUpTimer);
      toast.dismiss('wake-msg');

      const errorMsg = error.response?.data?.error || 'Login failed';
      toast.error('✗ ' + errorMsg);
      console.error('Login error:', error);

    } finally {
      setLoading(false);
    }
  };



  return (
    <>
      <Toaster position="top-center" />

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)',
            animation: 'pulse 8s ease-in-out infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: `
              radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
              radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            backgroundPosition: '0 0, 25px 25px',
            opacity: 0.3,
            animation: 'drift 20s linear infinite',
          },
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.8 },
          },
          '@keyframes drift': {
            '0%': { transform: 'translate(0, 0)' },
            '100%': { transform: 'translate(50px, 50px)' },
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
            '50%': { transform: 'translateY(-10px)' },
          },
          '@keyframes shimmer': {
            '0%': { backgroundPosition: '-1000px 0' },
            '100%': { backgroundPosition: '1000px 0' },
          },
          '@keyframes glow': {
            '0%, 100%': { boxShadow: '0 0 20px rgba(102, 126, 234, 0.5), 0 0 40px rgba(118, 75, 162, 0.3)' },
            '50%': { boxShadow: '0 0 40px rgba(102, 126, 234, 0.8), 0 0 80px rgba(118, 75, 162, 0.5)' },
          },
        }}
      >
        <Container maxWidth="sm" sx={{ animation: 'slideUp 0.6s ease-out', position: 'relative', zIndex: 1 }}>
          {/* Decorative Floating Shapes */}
          <Box
            sx={{
              position: 'absolute',
              top: -40,
              left: -40,
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              borderRadius: '50%',
              animation: 'float 6s ease-in-out infinite',
              filter: 'blur(1px)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -30,
              right: -30,
              width: 60,
              height: 60,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
              borderRadius: '50%',
              animation: 'float 8s ease-in-out infinite',
              animationDelay: '1s',
              filter: 'blur(1px)',
            }}
          />

          <Paper
            elevation={24}
            sx={{
              p: 4,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37), 0 0 80px rgba(102, 126, 234, 0.2)',
              transition: 'all 0.3s ease',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 3,
                padding: '2px',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3))',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: 'glow 3s ease-in-out infinite',
              },
              '&:hover': {
                boxShadow: '0 12px 48px 0 rgba(31, 38, 135, 0.45), 0 0 100px rgba(102, 126, 234, 0.3)',
                transform: 'translateY(-5px)',
              },
            }}
          >
            {/* Logo & Title */}
            <Box sx={{ textAlign: 'center', mb: 4, animation: 'fadeIn 0.8s ease-out' }}>
              <WarehouseIcon
                sx={{
                  fontSize: 64,
                  color: 'primary.main',
                  mb: 2,
                  animation: 'float 3s ease-in-out infinite',
                  filter: 'drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3))',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.1) rotate(5deg)',
                    filter: 'drop-shadow(0 8px 16px rgba(102, 126, 234, 0.5))',
                  },
                }}
              />
              <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                gutterBottom
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'fadeIn 1s ease-out 0.2s backwards',
                }}
              >
                Warehouse Management
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ animation: 'fadeIn 1s ease-out 0.4s backwards' }}
              >
                Multi-Warehouse Inventory System
              </Typography>
            </Box>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <Box sx={{ mb: 3, animation: 'fadeIn 1s ease-out 0.6s backwards' }}>
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
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.2), transparent)',
                        transition: 'left 0.5s',
                      },
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                        transform: 'translateY(-2px)',
                      },
                      '&.Mui-focused': {
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.25)',
                        transform: 'translateY(-2px)',
                        '&::before': {
                          left: '100%',
                        },
                      },
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
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.2), transparent)',
                        transition: 'left 0.5s',
                      },
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                        transform: 'translateY(-2px)',
                      },
                      '&.Mui-focused': {
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.25)',
                        transform: 'translateY(-2px)',
                        '&::before': {
                          left: '100%',
                        },
                      },
                    },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(102, 126, 234, 0.1)',
                              transform: 'scale(1.1)',
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
              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 1s ease-out 0.8s backwards' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" color="text.secondary">
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
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                  backgroundSize: '200% auto',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s ease',
                  animation: 'fadeIn 1s ease-out 1s backwards',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: 0,
                    height: 0,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.3)',
                    transform: 'translate(-50%, -50%)',
                    transition: 'width 0.6s, height 0.6s',
                  },
                  '&:hover': {
                    background: 'linear-gradient(45deg, #5568d3 30%, #65408b 90%)',
                    backgroundSize: '200% auto',
                    boxShadow: '0 6px 30px rgba(102, 126, 234, 0.6)',
                    transform: 'translateY(-3px)',
                    '&::before': {
                      width: '300px',
                      height: '300px',
                    },
                  },
                  '&:active': {
                    transform: 'translateY(-1px)',
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
              mt={3}
              sx={{
                animation: 'fadeIn 1s ease-out 1.2s backwards',
                opacity: 0.7,
                transition: 'opacity 0.3s ease',
                '&:hover': {
                  opacity: 1,
                },
              }}
            >
              Warehouse Management System v1.0.0
            </Typography>
          </Paper>
        </Container>
      </Box>
    </>
  );
}
