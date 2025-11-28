'use client';

import { WarehouseProvider } from '@/app/context/WarehouseContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <WarehouseProvider>{children}</WarehouseProvider>;
}
