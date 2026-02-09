'use client';

import React from 'react';
import { usePermissions } from '@/app/context/PermissionContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function usePermissionGuard(requiredPermission: string | string[], redirectPath: string = '/dashboard') {
    const { canAccess, canSee, isLoading, isAdmin } = usePermissions();
    const router = useRouter();
    const [checked, setChecked] = React.useState(false);

    useEffect(() => {
        // Wait for permissions to load before checking access
        if (!isLoading && !checked) {
            // Admin always has access
            if (isAdmin) {
                setChecked(true);
                return;
            }

            const hasAccess = Array.isArray(requiredPermission)
                ? requiredPermission.some(code => canSee(code))
                : canSee(requiredPermission);

            console.log(`✓ Permission check: ${JSON.stringify(requiredPermission)} = ${hasAccess}`);

            if (!hasAccess) {
                console.warn(`❌ Access denied. Redirecting to ${redirectPath}`);
                router.push(redirectPath);
            }

            setChecked(true);
        }
    }, [isLoading, requiredPermission, redirectPath, canAccess, canSee, router, checked, isAdmin]);

    // Return loading state - components should wait for this to be false
    return { loading: isLoading || !checked };
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
    const { canAccess, canSee, isLoading, isAdmin } = usePermissions();

    // Show nothing while loading
    if (isLoading) {
        return null;
    }

    // Admin always has access
    if (isAdmin) {
        return React.createElement(React.Fragment, null, children);
    }

    let hasAccess = false;

    if (Array.isArray(permission)) {
        hasAccess = requireAll 
            ? permission.every(code => canSee(code))
            : permission.some(code => canSee(code));
    } else {
        hasAccess = canSee(permission);
    }

    if (!hasAccess) {
        return React.createElement(React.Fragment, null, fallback);
    }

    return React.createElement(React.Fragment, null, children);
}
