'use client';

import { useState } from 'react';
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
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);



  // const handleLogin = async (e: React.FormEvent) => {
  //   e.preventDefault();

  //   if (!username.trim() || !password.trim()) {
  //     toast.error('Please enter username and password');
  //     return;
  //   }

  //   setLoading(true);
  //   try {
  //     await login(username, password);
  //     toast.success('✓ Login successful!', {
  //       icon: '🎉',
  //       duration: 2000,
  //     });
      
  //     setTimeout(() => {
  //       router.push('/dashboard');
  //     }, 500);
  //   } catch (error: any) {
  //     const errorMsg = error.response?.data?.error || 'Login failed';
  //     toast.error('✗ ' + errorMsg);
  //     console.error('Login error:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

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
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={24}
            sx={{
              p: 4,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Logo & Title */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <WarehouseIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
                Warehouse Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Multi-Warehouse Inventory System
              </Typography>
            </Box>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Username"
                  variant="outlined"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoFocus
                  placeholder="Enter your username"
                  sx={{ mb: 2 }}
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
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #5568d3 30%, #65408b 90%)',
                  },
                }}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            {/* Demo Credentials */}
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="caption" display="block" fontWeight="bold" mb={0.5}>
                📝 Demo Credentials
              </Typography>
              <Typography variant="caption" display="block">
                <strong>Username:</strong> admin
              </Typography>
              <Typography variant="caption" display="block">
                <strong>Password:</strong> admin123
              </Typography>
            </Alert>

            {/* Footer */}
            <Typography
              variant="caption"
              color="text.secondary"
              align="center"
              display="block"
              mt={3}
            >
              Warehouse Management System v1.0.0
            </Typography>
          </Paper>
        </Container>
      </Box>
    </>
  );
}
