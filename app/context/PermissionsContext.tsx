// File Path = wms_frontend/app/context/PermissionsContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import axios from 'axios';

const api = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export interface Permission {
    permission_key: string;
    permission_name: string;
    category: string;
    description: string;
    enabled: boolean;
}

export interface PermissionsContextType {
    permissions: Record<string, boolean>;
    loading: boolean;
    error: string | null;
    hasPermission: (permissionKey: string) => boolean;
    hasAnyPermission: (permissionKeys: string[]) => boolean;
    hasAllPermissions: (permissionKeys: string[]) => boolean;
    refreshPermissions: () => Promise<void>;
    canView: (page: string) => boolean;
    canCreate: (module: string) => boolean;
    canEdit: (module: string) => boolean;
    canDelete: (module: string) => boolean;
    canExport: (module: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

interface PermissionsProviderProps {
    children: ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);

    const fetchPermissions = async (isInitialFetch = false, force = false) => {
        // Prevent multiple simultaneous fetches unless forced
        if (isFetching && !force) {
            console.log('⏳ Permissions fetch already in progress, skipping...');
            return;
        }

        try {
            setIsFetching(true);
            // Only show loading on initial fetch, not on polling updates
            if (isInitialFetch) {
                setLoading(true);
            }
            setError(null);

            if (force) console.log('🔁 Forcing permissions refresh');

            const response = await api.get('/permissions/my-permissions');

            if (response.data && response.data.permissions) {
                const newPermissions = response.data.permissions;
                const oldKeys = Object.keys(permissions);
                const newKeys = Object.keys(newPermissions);

                // Check if permissions changed
                let changed = oldKeys.length !== newKeys.length;
                if (!changed) {
                    changed = oldKeys.some(key => permissions[key] !== newPermissions[key]);
                }

                if (changed) {
                    console.log('🔄 Permissions changed! Updating...');
                    const enabledCount = Object.values(newPermissions).filter(v => v === true).length;
                    console.log(`   Total: ${newKeys.length}, Enabled: ${enabledCount}`);

                    // Show notification to user
                    const user = localStorage.getItem('user');
                    if (user) {
                        try {
                            const userData = JSON.parse(user);
                            if (userData.role !== 'admin') {
                                // Show toast notification for non-admin users
                                if (typeof window !== 'undefined' && (window as any).showPermissionNotification) {
                                    (window as any).showPermissionNotification(`Permissions updated! (${enabledCount} enabled)`);
                                }
                            }
                        } catch (e) { }
                    }
                }

                setPermissions(newPermissions);
                setLastUpdated(new Date().toISOString());

                if (!changed) {
                    console.log('✓ Permissions unchanged');
                }
            }
        } catch (err: any) {
            console.error('❌ Error fetching permissions:', err);
            setError(err.message || 'Failed to load permissions');
            setPermissions({});
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (token) {
            fetchPermissions(true);
        } else {
            setLoading(false);
        }

        // Listen for token changes in other tabs (login/logout)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'token') {
                if (e.newValue) {
                    // New token set in another tab - refresh permissions
                    fetchPermissions();
                } else {
                    // Token removed (logout) - clear permissions
                    setPermissions({});
                    setLoading(false);
                }
            }
        };

        window.addEventListener('storage', handleStorage);

        // Create BroadcastChannel for instant cross-tab permission updates
        try {
            broadcastRef.current = new BroadcastChannel('permissions_update');
            broadcastRef.current.onmessage = (event) => {
                if (event.data === 'refresh') {
                    console.log('📢 Received permission update broadcast - refreshing...');
                    fetchPermissions();
                }
            };
        } catch (e) {
            console.warn('BroadcastChannel not supported:', e);
        }

        // Expose a debug hook so other components can call refreshPermissions without importing the context directly
        (window as any).__PERMISSIONS_HOOK = {
            refreshPermissions: (opts: { force?: boolean } = {}) => fetchPermissions(false, !!opts.force),
            forceRefresh: () => {
                // Force a fresh fetch and notify other tabs
                fetchPermissions(false, true);
                if (broadcastRef.current) {
                    broadcastRef.current.postMessage('refresh');
                }
            }
        };

        // Set up polling to check for permission changes every 5 seconds
        const pollInterval = setInterval(() => {
            const token = localStorage.getItem('token');
            if (token && !document.hidden) {
                // Only poll if user is logged in and tab is visible
                fetchPermissions(false);
            }
        }, 5000); // 5 seconds - balanced between responsiveness and server load

        return () => {
            window.removeEventListener('storage', handleStorage);
            clearInterval(pollInterval);
            if (broadcastRef.current) {
                broadcastRef.current.close();
            }
            try { delete (window as any).__PERMISSIONS_HOOK; } catch (e) { }
        };
    }, []);

    // Expose force refresh function
    const forceRefresh = (force = false) => {
        console.log('🔄 Force refreshing permissions...', force ? '(forced)' : '');
        fetchPermissions(false, force);
    };

    const hasPermission = (permissionKey: string): boolean => {
        // Admin always has permission
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const userData = JSON.parse(user);
                if (userData.role === 'admin') {
                    return true;
                }
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }

        return permissions[permissionKey] === true;
    };

    const hasAnyPermission = (permissionKeys: string[]): boolean => {
        return permissionKeys.some(key => hasPermission(key));
    };

    const hasAllPermissions = (permissionKeys: string[]): boolean => {
        return permissionKeys.every(key => hasPermission(key));
    };

    const refreshPermissions = async () => {
        await fetchPermissions();
    };

    // Helper functions for common permission patterns
    const canView = (page: string): boolean => {
        return hasPermission(`view_${page}`);
    };

    const canCreate = (module: string): boolean => {
        return hasPermission(`create_${module}`);
    };

    const canEdit = (module: string): boolean => {
        return hasPermission(`edit_${module}`);
    };

    const canDelete = (module: string): boolean => {
        return hasPermission(`delete_${module}`);
    };

    const canExport = (module: string): boolean => {
        return hasPermission(`export_${module}`);
    };

    return (
        <PermissionsContext.Provider
            value={{
                permissions,
                loading,
                error,
                hasPermission,
                hasAnyPermission,
                hasAllPermissions,
                refreshPermissions,
                canView,
                canCreate,
                canEdit,
                canDelete,
                canExport,
            }}
        >
            {children}
        </PermissionsContext.Provider>
    );
};

// Hook to use permissions
export const usePermissions = (): PermissionsContextType => {
    const context = useContext(PermissionsContext);
    if (context === undefined) {
        throw new Error('usePermissions must be used within a PermissionsProvider');
    }
    return context;
};

// HOC to protect components with permissions
export function withPermission<P extends object>(
    Component: React.ComponentType<P>,
    requiredPermission: string | string[],
    fallback?: React.ReactNode
) {
    return function PermissionGuard(props: P) {
        const { hasPermission, hasAnyPermission, loading } = usePermissions();

        if (loading) {
            return <div>Loading permissions...</div>;
        }

        const hasAccess = Array.isArray(requiredPermission)
            ? hasAnyPermission(requiredPermission)
            : hasPermission(requiredPermission);

        if (!hasAccess) {
            return fallback || <div>You don't have permission to access this.</div>;
        }

        return <Component {...props} />;
    };
}
