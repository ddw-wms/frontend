// File Path = warehouse-frontend/app/context/WarehouseContext.tsx
//File Path= warehouse-frontend\app\context\WarehouseContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WarehouseContextType {
  activeWarehouse: any;
  setActiveWarehouse: (warehouse: any) => void;
  warehouseId: number | null;
}

export const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider = ({ children }: { children: ReactNode }) => {
  const [activeWarehouse, setActiveWarehouse] = useState<any>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('activeWarehouse') : null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [warehouseId, setWarehouseId] = useState<number | null>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('activeWarehouse') : null;
      return stored ? (JSON.parse(stored).id ?? null) : null;
    } catch {
      return null;
    }
  });

  // initial state is read synchronously from localStorage to avoid UI flash while mounting.

  // Check if user has access to a warehouse
  const canAccessWarehouse = (warehouseId: number): boolean => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // Admin/super_admin can access all
        if (user.role === 'admin' || user.role === 'super_admin') {
          return true;
        }
      }

      const storedWarehouses = localStorage.getItem('warehouses');
      if (storedWarehouses) {
        const userWarehouses = JSON.parse(storedWarehouses);
        if (userWarehouses && userWarehouses.length > 0) {
          // User has restricted access - check if warehouse is in their list
          return userWarehouses.some((w: any) => w.warehouse_id === warehouseId);
        }
      }
      // No restrictions = can access all
      return true;
    } catch {
      return true; // On error, allow (fail-open for now)
    }
  };

  // Save to localStorage when changes
  const handleSetWarehouse = (warehouse: any) => {
    // Validate access before setting
    if (warehouse && !canAccessWarehouse(warehouse.id)) {
      console.warn(`User tried to access warehouse ${warehouse.id} without permission`);
      return; // Silently reject unauthorized warehouse change
    }

    setActiveWarehouse(warehouse);
    setWarehouseId(warehouse?.id || null);
    if (warehouse) {
      localStorage.setItem('activeWarehouse', JSON.stringify(warehouse));
    } else {
      localStorage.removeItem('activeWarehouse');
    }
  };

  return (
    <WarehouseContext.Provider value={{ activeWarehouse, setActiveWarehouse: handleSetWarehouse, warehouseId }}>
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within WarehouseProvider');
  }
  return context;
};
