// File Path = warehouse-frontend\lib\auth.ts
import { authAPI, withRetry, parseApiError, wakeUpServer } from './api';

export interface Permission {
  can_access: boolean;
  is_visible: boolean;
}

export interface WarehouseAccess {
  warehouse_id: number;
  warehouse_name: string;
  warehouse_code: string;
  is_default: boolean;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  warehouseId?: number;
  permissions?: Record<string, Permission>;
  warehouses?: WarehouseAccess[];
  defaultWarehouseId?: number;
}

export interface AuthToken {
  token: string;
  user: User;
}

// Login with automatic retry for server cold start (503 errors)
export const login = async (username: string, password: string): Promise<AuthToken> => {
  // Try to login with retry for 503 errors (server starting up)
  const response = await withRetry(
    () => authAPI.login(username, password),
    {
      maxRetries: 5, // More retries for login since server cold start can take 30-60s
      retryDelay: 3000, // Start with 3 second delay
      retryCondition: (error) => {
        // Only retry on 503 (Service Unavailable) or network errors
        const status = error.response?.status;
        const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
        const isServerStarting = status === 503;
        const isTimeout = error.code === 'ECONNABORTED';

        if (isServerStarting || isNetworkError || isTimeout) {
          console.log('Server starting up or network issue, retrying login...');
          return true;
        }
        return false;
      },
    }
  );

  const { token, user } = response.data;

  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Store permissions separately for quick access
    if (user.permissions) {
      localStorage.setItem('permissions', JSON.stringify(user.permissions));
    }
    if (user.warehouses) {
      localStorage.setItem('warehouses', JSON.stringify(user.warehouses));
    }

    // Dispatch custom event to notify PermissionContext of login
    window.dispatchEvent(new CustomEvent('user-login'));
  }

  return { token, user };
};

export const logout = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    localStorage.removeItem('warehouses');
  }
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!getStoredToken();
};

export const getStoredPermissions = (): Record<string, Permission> | null => {
  if (typeof window === 'undefined') return null;
  const permissions = localStorage.getItem('permissions');
  return permissions ? JSON.parse(permissions) : null;
};

export const getStoredWarehouses = (): WarehouseAccess[] | null => {
  if (typeof window === 'undefined') return null;
  const warehouses = localStorage.getItem('warehouses');
  return warehouses ? JSON.parse(warehouses) : null;
};

/**
 * Check if user has a specific permission
 */
export const hasPermission = (permissionCode: string): boolean => {
  const user = getStoredUser();

  // Super admin has all permissions
  if (user?.role === 'super_admin') {
    return true;
  }

  const permissions = getStoredPermissions() || user?.permissions;
  if (!permissions) return false;

  return permissions[permissionCode]?.can_access === true;
};

/**
 * Check if permission is visible (for UI rendering)
 */
export const isPermissionVisible = (permissionCode: string): boolean => {
  const user = getStoredUser();

  // Super admin sees everything
  if (user?.role === 'super_admin') {
    return true;
  }

  const permissions = getStoredPermissions() || user?.permissions;
  if (!permissions) return false;

  return permissions[permissionCode]?.is_visible === true;
};

/**
 * Check if user can access a page
 */
export const canAccessPage = (pageName: string): boolean => {
  return hasPermission(`page:${pageName}`);
};

/**
 * Check if user can access a feature
 */
export const canAccessFeature = (resource: string, action: string): boolean => {
  return hasPermission(`feature:${resource}:${action}`);
};

/**
 * Check if user can perform an action
 */
export const canPerformAction = (actionCode: string): boolean => {
  return hasPermission(`action:${actionCode}`);
};

/**
 * Check if user can access a warehouse
 */
export const canAccessWarehouse = (warehouseId: number): boolean => {
  const user = getStoredUser();

  // Super admin can access all warehouses
  if (user?.role === 'super_admin') {
    return true;
  }

  const warehouses = getStoredWarehouses() || user?.warehouses;
  if (!warehouses) return false;

  return warehouses.some(w => w.warehouse_id === warehouseId);
};

/**
 * Get user's accessible warehouse IDs
 */
export const getAccessibleWarehouseIds = (): number[] => {
  const user = getStoredUser();
  const warehouses = getStoredWarehouses() || user?.warehouses;

  if (!warehouses) {
    // Fallback to legacy single warehouse
    return user?.warehouseId ? [user.warehouseId] : [];
  }

  return warehouses.map(w => w.warehouse_id);
};

/**
 * Refresh permissions from API
 */
export const refreshPermissions = async (): Promise<void> => {
  try {
    const { permissionsAPI } = await import('./api');
    const response = await permissionsAPI.getMyPermissions();
    const { permissions, warehouses } = response.data;

    if (typeof window !== 'undefined') {
      localStorage.setItem('permissions', JSON.stringify(permissions));
      if (warehouses) {
        localStorage.setItem('warehouses', JSON.stringify(warehouses));
      }

      // Update user object
      const user = getStoredUser();
      if (user) {
        user.permissions = permissions;
        user.warehouses = warehouses;
        localStorage.setItem('user', JSON.stringify(user));
      }
    }
  } catch (error) {
    console.error('Failed to refresh permissions:', error);
  }
};
