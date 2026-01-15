// File Path = warehouse-frontend\components\AppLayout.tsx

'use client';
import { ReactNode, useState, useEffect } from 'react';
import { Box, CssBaseline, useTheme, useMediaQuery, IconButton, Fab } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';
import RouteGuard from './RouteGuard';

interface AppLayoutProps {
  children: ReactNode;
  requiredPermission?: string;
  skipRouteGuard?: boolean;
}

export default function AppLayout({ children, requiredPermission, skipRouteGuard = false }: AppLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Listen for theme changes
  useEffect(() => {
    const checkTheme = () => {
      const stored = localStorage.getItem('app_appearance_settings');
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          if (settings.theme === 'dark') {
            setIsDarkMode(true);
          } else if (settings.theme === 'auto') {
            setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
          } else {
            setIsDarkMode(false);
          }
        } catch (e) {
          setIsDarkMode(false);
        }
      }
    };
    checkTheme();

    const handleThemeChange = () => checkTheme();
    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('appearanceSettingsChanged', handleThemeChange);
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('appearanceSettingsChanged', handleThemeChange);
    };
  }, []);

  const content = (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa',
      transition: 'background-color 0.3s ease',
    }}>
      <CssBaseline />

      {/* Mobile Menu Button - Floating Action Button Style */}
      {isMobile && (
        <Fab
          size="medium"
          onClick={() => {
            // Immediate haptic-like feedback
            setMobileOpen(true);
          }}
          onTouchStart={(e) => {
            // Prevent delay on touch devices
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            setMobileOpen(true);
          }}
          sx={{
            position: 'fixed',
            top: { xs: 8, sm: 14 },
            left: { xs: 8, sm: 14 },
            zIndex: 1100,
            bgcolor: '#1e40af',
            color: 'white',
            width: { xs: 40, sm: 44 },
            height: { xs: 40, sm: 44 },
            minHeight: 'auto',
            boxShadow: '0 4px 14px rgba(30, 64, 175, 0.4)',
            display: mobileOpen ? 'none' : 'flex',
            transition: 'transform 0.1s ease, opacity 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            '&:hover': {
              bgcolor: '#1e3a8a',
            },
            '&:active': {
              transform: 'scale(0.95)',
              bgcolor: '#1e3a8a',
            },
          }}
        >
          <MenuIcon sx={{ fontSize: { xs: 22, sm: 24 } }} />
        </Fab>
      )}

      {/* Sidebar */}
      <Box sx={{
        height: '100vh',
        flexShrink: 0,
        position: 'relative',
        zIndex: 1
      }}>
        <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: isDarkMode ? '#0f172a' : '#f5f7fa',
          transition: 'background-color 0.3s ease',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          // Smooth scrolling
          scrollBehavior: 'smooth',
          // Custom scrollbar
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            borderRadius: '4px',
            '&:hover': {
              background: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );

  // Skip route guard if specified or wrap with protection
  if (skipRouteGuard) {
    return content;
  }

  return (
    <RouteGuard requiredPermission={requiredPermission}>
      {content}
    </RouteGuard>
  );
}

