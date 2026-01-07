// File Path = warehouse-frontend\components\Providers.tsx
'use client';

import { WarehouseProvider } from '@/app/context/WarehouseContext';
import { PermissionsProvider } from '@/app/context/PermissionsContext';
import ThemeRegistry from './ThemeRegistry';
import OnboardingWrapper from './OnboardingWrapper';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <WarehouseProvider>
        <PermissionsProvider>
          <OnboardingWrapper>
            {children}
          </OnboardingWrapper>
        </PermissionsProvider>
      </WarehouseProvider>
    </ThemeRegistry>
  );
}
