'use client';

import React from 'react';
import { usePermissions } from '@/app/context/PermissionsContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function usePermissionGuard(requiredPermission: string | string[], redirectPath: string = '/dashboard') {
    const { hasPermission, hasAnyPermission, loading } = usePermissions();
    const router = useRouter();
    const [checked, setChecked] = React.useState(false);

    useEffect(() => {
        // Wait for permissions to load before checking access
        if (!loading && !checked) {
            const hasAccess = Array.isArray(requiredPermission)
                ? hasAnyPermission(requiredPermission)
                : hasPermission(requiredPermission);

            console.log(`✓ Permission check: ${JSON.stringify(requiredPermission)} = ${hasAccess}`);

            if (!hasAccess) {
                console.warn(`❌ Access denied. Redirecting to ${redirectPath}`);
                router.push(redirectPath);
            }

            setChecked(true);
        }
    }, [loading, requiredPermission, redirectPath, hasPermission, hasAnyPermission, router, checked]);

    // Return loading state - components should wait for this to be false
    return { loading: loading || !checked };
}

interface PermissionGateProps {
    children: React.ReactNode;
    permission: string | string[];
    fallback?: React.ReactNode;
    requireAll?: boolean;
}

export function PermissionGate({
    children,
    permission,
    fallback = null,
    requireAll = false,
}: PermissionGateProps) {
    const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

    // Show nothing while loading
    if (loading) {
        return null;
    }

    let hasAccess = false;

    if (Array.isArray(permission)) {
        hasAccess = requireAll ? hasAllPermissions(permission) : hasAnyPermission(permission);
    } else {
        hasAccess = hasPermission(permission);
    }

    if (!hasAccess) {
        return React.createElement(React.Fragment, null, fallback);
    }

    return React.createElement(React.Fragment, null, children);
}
