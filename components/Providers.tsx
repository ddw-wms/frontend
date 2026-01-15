// File Path = warehouse-frontend\components\Providers.tsx
'use client';

import { WarehouseProvider } from '@/app/context/WarehouseContext';
import { PermissionProvider } from '@/app/context/PermissionContext';
import { BulkUploadProvider } from '@/app/context/BulkUploadContext';
import { AppearanceProvider } from '@/app/context/AppearanceContext';
import ThemeRegistry from './ThemeRegistry';
import OnboardingWrapper from './OnboardingWrapper';
import ErrorBoundary from './ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <ErrorBoundary>
        <AppearanceProvider>
          <PermissionProvider>
            <WarehouseProvider>
              <BulkUploadProvider>
                <OnboardingWrapper>
                  {children}
                </OnboardingWrapper>
              </BulkUploadProvider>
            </WarehouseProvider>
          </PermissionProvider>
        </AppearanceProvider>
      </ErrorBoundary>
    </ThemeRegistry>
  );
}

