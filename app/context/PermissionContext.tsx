'use client';
// File Path = warehouse-frontend/app/context/PermissionContext.tsx
// Final Permission Context - Enable/Disable + Show/Hide

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { permissionsAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

// Permission object structure
interface Permission {
    name: string;
    category: string;
    page: string;
    is_enabled: boolean;
    is_visible: boolean;
    source: string;
}

interface PermissionContextType {
    // Check functions
    canAccess: (code: string) => boolean;      // Check if feature is enabled
    canSee: (code: string) => boolean;         // Check if UI element is visible

    // Convenience methods
    canAccessMenu: (menuCode: string) => boolean;
    canSeeMenu: (menuCode: string) => boolean;
    canAccessTab: (tabCode: string) => boolean;
    canSeeTab: (tabCode: string) => boolean;
    canAccessButton: (btnCode: string) => boolean;
    canSeeButton: (btnCode: string) => boolean;

    // State
    permissions: Record<string, Permission>;
    isLoading: boolean;
    role: string;
    isAdmin: boolean;

    // Actions
    refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

interface PermissionProviderProps {
    children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
    const [permissions, setPermissions] = useState<Record<string, Permission>>({});
    const [role, setRole] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    const isAdmin = role === 'super_admin' || role === 'admin';

    // Load permissions function - can be called anytime
    const loadPermissions = useCallback(async () => {
        const user = getStoredUser();

        if (!user) {
            setPermissions({});
            setRole('');
            setIsLoading(false);
            setInitialized(true);
            return;
        }

        setRole(user.role || '');

        // Admin roles get full access immediately
        if (user.role === 'super_admin' || user.role === 'admin') {
            setIsLoading(false);
            setInitialized(true);
            return;
        }

        try {
            const response = await permissionsAPI.getMyPermissions();
            setPermissions(response.data.permissions || {});
            setRole(response.data.role || user.role);
        } catch (error) {
            console.error('Failed to load permissions:', error);
            // Continue with empty permissions - will fall back to role check
        } finally {
            setIsLoading(false);
            setInitialized(true);
        }
    }, []);

    // Load permissions on mount
    useEffect(() => {
        loadPermissions();
    }, [loadPermissions]);

    // Listen for storage events (login/logout from another tab or same tab)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'user' || e.key === 'token') {
                // User changed - reload permissions
                loadPermissions();
            }
        };

        // Custom event for same-tab login
        const handleLoginEvent = () => {
            loadPermissions();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('user-login', handleLoginEvent);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('user-login', handleLoginEvent);
        };
    }, [loadPermissions]);

    // Refresh permissions from API
    const refreshPermissions = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await permissionsAPI.getMyPermissions();
            setPermissions(response.data.permissions || {});
            setRole(response.data.role || '');
        } catch (error) {
            console.error('Failed to refresh permissions:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Check if user can ACCESS a feature (is_enabled)
    const canAccess = useCallback((code: string): boolean => {
        if (isAdmin) return true;
        const perm = permissions[code];
        return perm?.is_enabled === true;
    }, [permissions, isAdmin]);

    // Check if user can SEE a UI element (is_visible)
    const canSee = useCallback((code: string): boolean => {
        if (isAdmin) return true;
        const perm = permissions[code];
        return perm?.is_visible === true;
    }, [permissions, isAdmin]);

    // Convenience methods with prefix handling
    const canAccessMenu = useCallback((code: string): boolean => {
        const fullCode = code.startsWith('menu:') ? code : `menu:${code}`;
        return canAccess(fullCode);
    }, [canAccess]);

    const canSeeMenu = useCallback((code: string): boolean => {
        const fullCode = code.startsWith('menu:') ? code : `menu:${code}`;
        return canSee(fullCode);
    }, [canSee]);

    const canAccessTab = useCallback((code: string): boolean => {
        const fullCode = code.startsWith('tab:') ? code : `tab:${code}`;
        return canAccess(fullCode);
    }, [canAccess]);

    const canSeeTab = useCallback((code: string): boolean => {
        const fullCode = code.startsWith('tab:') ? code : `tab:${code}`;
        return canSee(fullCode);
    }, [canSee]);

    const canAccessButton = useCallback((code: string): boolean => {
        const fullCode = code.startsWith('btn:') ? code : `btn:${code}`;
        return canAccess(fullCode);
    }, [canAccess]);

    const canSeeButton = useCallback((code: string): boolean => {
        const fullCode = code.startsWith('btn:') ? code : `btn:${code}`;
        return canSee(fullCode);
    }, [canSee]);

    const value: PermissionContextType = {
        canAccess,
        canSee,
        canAccessMenu,
        canSeeMenu,
        canAccessTab,
        canSeeTab,
        canAccessButton,
        canSeeButton,
        permissions,
        isLoading,
        role,
        isAdmin,
        refreshPermissions,
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
}

// Hook to use permissions
export function usePermissions() {
    const context = useContext(PermissionContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionProvider');
    }
    return context;
}

// =============================================================
// WRAPPER COMPONENTS FOR CONDITIONAL RENDERING
// =============================================================

interface PermissionGateProps {
    code: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    checkType?: 'access' | 'visible' | 'both';
}

// Generic permission gate
export function PermissionGate({ code, children, fallback = null, checkType = 'visible' }: PermissionGateProps) {
    const { canAccess, canSee, isLoading, isAdmin } = usePermissions();

    if (isLoading) return null;
    if (isAdmin) return <>{children}</>;

    let hasPermission = false;
    switch (checkType) {
        case 'access':
            hasPermission = canAccess(code);
            break;
        case 'visible':
            hasPermission = canSee(code);
            break;
        case 'both':
            hasPermission = canAccess(code) && canSee(code);
            break;
    }

    if (!hasPermission) return <>{fallback}</>;
    return <>{children}</>;
}

// Menu visibility gate
export function MenuGate({ code, children, fallback = null }: Omit<PermissionGateProps, 'checkType'>) {
    const { canSeeMenu, isLoading, isAdmin } = usePermissions();

    if (isLoading) return null;
    if (isAdmin) return <>{children}</>;
    if (!canSeeMenu(code)) return <>{fallback}</>;
    return <>{children}</>;
}

// Tab visibility gate
export function TabGate({ code, children, fallback = null }: Omit<PermissionGateProps, 'checkType'>) {
    const { canSeeTab, isLoading, isAdmin } = usePermissions();

    if (isLoading) return null;
    if (isAdmin) return <>{children}</>;
    if (!canSeeTab(code)) return <>{fallback}</>;
    return <>{children}</>;
}

// Button visibility gate
export function ButtonGate({ code, children, fallback = null }: Omit<PermissionGateProps, 'checkType'>) {
    const { canSeeButton, isLoading, isAdmin } = usePermissions();

    if (isLoading) return null;
    if (isAdmin) return <>{children}</>;
    if (!canSeeButton(code)) return <>{fallback}</>;
    return <>{children}</>;
}

// =============================================================
// PERMISSION BUTTON COMPONENT
// =============================================================
interface PermissionButtonProps {
    code: string;
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: any;
}

export function PermissionButton({ code, children, onClick, disabled, ...props }: PermissionButtonProps) {
    const { canAccessButton, canSeeButton, isAdmin } = usePermissions();

    // Don't render if not visible
    if (!isAdmin && !canSeeButton(code)) {
        return null;
    }

    // Disable if not enabled
    const isDisabled = disabled || (!isAdmin && !canAccessButton(code));

    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            {...props}
        >
            {children}
        </button>
    );
}
