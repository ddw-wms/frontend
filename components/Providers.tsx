// File Path = warehouse-frontend\components\Providers.tsx
'use client';

import { WarehouseProvider } from '@/app/context/WarehouseContext';
import { PermissionProvider } from '@/app/context/PermissionContext';
import ThemeRegistry from './ThemeRegistry';
import OnboardingWrapper from './OnboardingWrapper';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <PermissionProvider>
        <WarehouseProvider>
          <OnboardingWrapper>
            {children}
          </OnboardingWrapper>
        </WarehouseProvider>
      </PermissionProvider>
    </ThemeRegistry>
  );
}

