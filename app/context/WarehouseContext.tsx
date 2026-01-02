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

  // Save to localStorage when changes
  const handleSetWarehouse = (warehouse: any) => {
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
