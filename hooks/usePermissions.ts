// File Path = warehouse-frontend/hooks/usePermissions.ts
import { useState, useEffect } from 'react';
import { fetchUserPermissions, hasPermissionSync } from '@/lib/permissions';

/**
 * Hook to load and check user permissions dynamically from database
 * Usage: const { permissions, hasPermission, loading } = usePermissions();
 */
export const usePermissions = () => {
    const [permissions, setPermissions] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const perms = await fetchUserPermissions();
            setPermissions(perms);
        } catch (error) {
            console.error('Error loading permissions:', error);
            setPermissions({});
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (permissionKey: string): boolean => {
        if (!permissions) return false;
        return permissions[permissionKey] === true;
    };

    const hasAnyPermission = (permissionKeys: string[]): boolean => {
        if (!permissions) return false;
        return permissionKeys.some(key => permissions[key] === true);
    };

    const hasAllPermissions = (permissionKeys: string[]): boolean => {
        if (!permissions) return false;
        return permissionKeys.every(key => permissions[key] === true);
    };

    return {
        permissions,
        loading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        reload: loadPermissions
    };
};

/**
 * Check if user has a specific permission (sync version)
 * Usage: if (hasPermission('create_inbound')) { ... }
 */
export const hasPermission = (permissionKey: string): boolean => {
    return hasPermissionSync(permissionKey);
};

/**
 * Check if user has any of the given permissions
 */
export const hasAnyPermission = (permissionKeys: string[]): boolean => {
    return permissionKeys.some(key => hasPermissionSync(key));
};

/**
 * Check if user has all of the given permissions
 */
export const hasAllPermissions = (permissionKeys: string[]): boolean => {
    return permissionKeys.every(key => hasPermissionSync(key));
};
