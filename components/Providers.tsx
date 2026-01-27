// File Path = warehouse-frontend\components\Providers.tsx
'use client';

import { WarehouseProvider } from '@/app/context/WarehouseContext';
import { PermissionProvider } from '@/app/context/PermissionContext';
import { BulkUploadProvider } from '@/app/context/BulkUploadContext';
import { AppearanceProvider } from '@/app/context/AppearanceContext';
import { ConnectionProvider } from '@/app/context/ConnectionContext';
import ThemeRegistry from './ThemeRegistry';
import OnboardingWrapper from './OnboardingWrapper';
import ErrorBoundary from './ErrorBoundary';
import ConnectionStatusBanner from './ConnectionStatusBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <ErrorBoundary>
        <ConnectionProvider>
          <ConnectionStatusBanner variant="fixed" />
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
        </ConnectionProvider>
      </ErrorBoundary>
    </ThemeRegistry>
  );
}

