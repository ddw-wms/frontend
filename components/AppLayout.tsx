// // File Path = warehouse-frontend\components\AppLayout.tsx
// 'use client';

// import { ReactNode } from 'react';
// import { Box, CssBaseline } from '@mui/material';
// import Sidebar from './Sidebar';

// interface AppLayoutProps {
//   children: ReactNode;
// }

// export default function AppLayout({ children }: AppLayoutProps) {
//   return (
//     <Box
//       sx={{
//         position: 'absolute',
//         inset: 0,
//         display: 'flex',
//         flexDirection: 'row',
//         overflow: 'hidden',
//       }}
//     >
//       <CssBaseline />

//       {/* Sidebar */}
//       <Box sx={{ height: '100%', flexShrink: 0 }}>
//         <Sidebar />
//       </Box>

//       {/* Main Content */}
//       <Box
//         component="main"
//         sx={{
//           flex: 1,
//           height: '100%',
//           bgcolor: '#f5f5f5',
//           overflowY: 'auto',
//           overflowX: 'hidden',
//           WebkitOverflowScrolling: 'touch',
//         }}
//       >
//         {children}
//       </Box>
//     </Box>
//   );
// }

// File Path = warehouse-frontend\components\AppLayout.tsx

'use client';
import { ReactNode, useState } from 'react';
import { Box, CssBaseline, useTheme, useMediaQuery, IconButton } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <CssBaseline />

      {/* Mobile Menu Button */}
      {isMobile && (
        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{
            position: 'fixed',
            top: 10,
            left: 10,
            zIndex: 10000,
            bgcolor: '#052457',
            color: 'white',
            width: 36,
            height: 36,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            border: '1.5px solid rgba(255,255,255,0.25)',
            display: mobileOpen ? 'none' : 'flex',
            '&:hover': {
              bgcolor: '#063272',
            },
          }}
        >
          <MenuIcon sx={{ fontSize: 22 }} />
        </IconButton>
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
          bgcolor: 'background.default',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          pl: isMobile ? 0 : 0,
          pt: isMobile ? 0 : 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

