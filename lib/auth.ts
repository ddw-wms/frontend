// File Path = warehouse-frontend\lib\auth.ts
import { authAPI, withRetry, parseApiError, wakeUpServer } from './api';

// ===================== Cookie Helpers =====================
// Store auth token in cookie alongside localStorage for:
// 1. Next.js middleware can read cookies (server-side) for route protection
// 2. Cookies persist across browser restarts even if Edge clears localStorage
// 3. Cookies are shared across all tabs automatically

const AUTH_COOKIE_NAME = 'wms_auth_token';
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export const setAuthCookie = (token: string) => {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
};

export const clearAuthCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
};

export const getAuthCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

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
  // First, try to wake up the server (this handles Render cold start)
  // This is a fire-and-forget - we don't wait for it to complete
  wakeUpServer().catch(() => { }); // Ignore errors, just try to wake it

  // Try to login with retry for 503 errors (server starting up)
  const response = await withRetry(
    () => authAPI.login(username, password),
    {
      maxRetries: 8, // More retries for login since server cold start can take 30-60s
      retryDelay: 5000, // Fixed 5 second delay
      useExponentialBackoff: false, // Use fixed delays for login
      retryCondition: (error) => {
        // Only retry on 503 (Service Unavailable) or network errors
        const status = error.response?.status;
        const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
        const isServerStarting = status === 503;
        const isTimeout = error.code === 'ECONNABORTED';
        const isGatewayError = status === 502 || status === 504;

        if (isServerStarting || isNetworkError || isTimeout || isGatewayError) {
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

    // Also store token in cookie for:
    // - Next.js middleware (server-side route protection)
    // - Persistence across browser restarts (Edge clears localStorage)
    // - Cross-tab session sharing
    setAuthCookie(token);

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
    clearAuthCookie();
  }
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Check localStorage first, then fall back to cookie
  // This handles cases where Edge clears localStorage on browser restart
  const token = localStorage.getItem('token');
  if (token) return token;

  // Fallback: recover token from cookie (e.g., after browser restart cleared localStorage)
  const cookieToken = getAuthCookie();
  if (cookieToken) {
    // Restore to localStorage so the rest of the app works seamlessly
    localStorage.setItem('token', cookieToken);
    return cookieToken;
  }

  return null;
};

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!getStoredToken();
};

export const getStoredPermissions = (): Record<string, Permission> | null => {
  if (typeof window === 'undefined') return null;
  const permissions = localStorage.getItem('permissions');
  if (!permissions) return null;
  try {
    return JSON.parse(permissions);
  } catch {
    localStorage.removeItem('permissions');
    return null;
  }
};

export const getStoredWarehouses = (): WarehouseAccess[] | null => {
  if (typeof window === 'undefined') return null;
  const warehouses = localStorage.getItem('warehouses');
  if (!warehouses) return null;
  try {
    return JSON.parse(warehouses);
  } catch {
    localStorage.removeItem('warehouses');
    return null;
  }
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
    const { permissions: rawPermissions, warehouses } = response.data;

    // Map API shape {is_enabled, is_visible} → localStorage shape {can_access, is_visible}
    // The API (getMyPermissions) returns is_enabled, but localStorage/hasPermission expects can_access
    const mappedPermissions: Record<string, Permission> = {};
    if (rawPermissions) {
      for (const [code, perm] of Object.entries(rawPermissions)) {
        const p = perm as any;
        mappedPermissions[code] = {
          can_access: p.is_enabled ?? p.can_access ?? false,
          is_visible: p.is_visible ?? false
        };
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('permissions', JSON.stringify(mappedPermissions));
      if (warehouses) {
        localStorage.setItem('warehouses', JSON.stringify(warehouses));
      }

      // Update user object
      const user = getStoredUser();
      if (user) {
        user.permissions = mappedPermissions;
        user.warehouses = warehouses;
        localStorage.setItem('user', JSON.stringify(user));
      }
    }
  } catch (error) {
    console.error('Failed to refresh permissions:', error);
  }
};
