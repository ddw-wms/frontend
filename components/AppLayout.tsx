// File Path = warehouse-frontend\components\AppLayout.tsx

'use client';
import { ReactNode, useState } from 'react';
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

  const content = (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      bgcolor: '#f5f7fa',
    }}>
      <CssBaseline />

      {/* Mobile Menu Button - Floating Action Button Style */}
      {isMobile && (
        <Fab
          size="medium"
          onClick={() => setMobileOpen(true)}
          sx={{
            position: 'fixed',
            top: { xs: 12, sm: 14 },
            left: { xs: 12, sm: 14 },
            zIndex: 1100,
            bgcolor: '#1e40af',
            color: 'white',
            width: { xs: 40, sm: 44 },
            height: { xs: 40, sm: 44 },
            minHeight: 'auto',
            boxShadow: '0 4px 14px rgba(30, 64, 175, 0.4)',
            display: mobileOpen ? 'none' : 'flex',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: '#1e3a8a',
              transform: 'scale(1.05)',
            },
            '&:active': {
              transform: 'scale(0.98)',
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
          bgcolor: '#f5f7fa',
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
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0,0,0,0.15)',
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

