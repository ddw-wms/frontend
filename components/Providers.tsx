// File Path = warehouse-frontend\components\Providers.tsx
'use client';

import { WarehouseProvider } from '@/app/context/WarehouseContext';
import { PermissionProvider } from '@/app/context/PermissionContext';
import ThemeRegistry from './ThemeRegistry';
import OnboardingWrapper from './OnboardingWrapper';
import ErrorBoundary from './ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <ErrorBoundary>
        <PermissionProvider>
          <WarehouseProvider>
            <OnboardingWrapper>
              {children}
            </OnboardingWrapper>
          </WarehouseProvider>
        </PermissionProvider>
      </ErrorBoundary>
    </ThemeRegistry>
  );
}

