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
import { ReactNode } from 'react';
import { Box, CssBaseline, useTheme, useMediaQuery } from '@mui/material';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />

      {/* Sidebar */}
      <Sidebar />

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
          // Add proper spacing for mobile menu button
          pl: isMobile ? 0 : 0,
          pt: isMobile ? 0 : 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

