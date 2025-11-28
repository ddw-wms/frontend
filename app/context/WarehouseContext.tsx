'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WarehouseContextType {
  activeWarehouse: any;
  setActiveWarehouse: (warehouse: any) => void;
  warehouseId: number | null;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export const WarehouseProvider = ({ children }: { children: ReactNode }) => {
  const [activeWarehouse, setActiveWarehouse] = useState<any>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('activeWarehouse');
    if (stored) {
      const warehouse = JSON.parse(stored);
      setActiveWarehouse(warehouse);
      setWarehouseId(warehouse.id);
    }
  }, []);

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
