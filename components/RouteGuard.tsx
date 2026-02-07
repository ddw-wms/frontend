'use client';
// File Path = warehouse-frontend/components/RouteGuard.tsx
// RouteGuard - Protects routes based on permissions

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import { usePermissions } from '@/app/context/PermissionContext';
import { isAuthenticated, getStoredUser } from '@/lib/auth';

interface RouteGuardProps {
    children: React.ReactNode;
    requiredPermission?: string;
    fallbackPath?: string;
}

/**
 * Map URL paths to their menu permission codes
 */
const pathMenuMap: Record<string, string> = {
    '/dashboard': 'menu:dashboard',
    '/inbound': 'menu:inbound',
    '/qc': 'menu:qc',
    '/picking': 'menu:picking',
    '/outbound': 'menu:outbound',
    '/customers': 'menu:customers',
    '/reports': 'menu:reports',
    '/settings/master-data': 'menu:settings:masterdata',
    '/settings/warehouses': 'menu:settings:warehouses',
    '/settings/racks': 'menu:settings:racks',
    '/settings/users': 'menu:settings:users',
    '/settings/printers': 'menu:settings:printers',
    '/settings/backups': 'menu:settings:backups',
    '/settings/permissions': 'menu:settings:permissions',
    '/settings/appearance': 'menu:settings:appearance',
    '/settings/error-logs': 'menu:settings:errorlogs',
    '/settings/rejections': 'menu:settings:rejections',
};

/**
 * Get the required menu code for a given path
 */
function getRequiredMenuCode(pathname: string): string | null {
    // Check exact match first
    if (pathMenuMap[pathname]) {
        return pathMenuMap[pathname];
    }

    // Check if path starts with any of the mapped paths
    for (const [path, menuCode] of Object.entries(pathMenuMap)) {
        if (pathname.startsWith(path + '/')) {
            return menuCode;
        }
    }

    return null;
}

/**
 * RouteGuard component that protects pages based on permissions
 */
export default function RouteGuard({
    children,
    requiredPermission,
    fallbackPath = '/dashboard'
}: RouteGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { canAccess, canSee, isAdmin, isLoading } = usePermissions();

    // ⚡ FLICKER FIX: Initialize optimistically for authenticated users
    // This prevents full-page loading spinner when navigating between pages
    // Security is still enforced - unauthorized users will be redirected after check
    const [authorized, setAuthorized] = useState<boolean | null>(() => {
        // For login page, always authorized
        if (typeof window !== 'undefined' && window.location.pathname === '/login') return true;
        // For authenticated users, assume authorized initially (optimistic)
        // The useEffect will verify and redirect if actually unauthorized
        return isAuthenticated() ? true : null;
    });
    const [checkingAuth, setCheckingAuth] = useState(() => {
        // Skip loading state for authenticated users - show content immediately
        return !isAuthenticated();
    });

    useEffect(() => {
        // Skip for login page
        if (pathname === '/login') {
            setAuthorized(true);
            setCheckingAuth(false);
            return;
        }

        // Check authentication first
        if (!isAuthenticated()) {
            router.replace('/login');
            return;
        }

        // Get user for role check - do this FIRST before waiting for permissions API
        const user = getStoredUser();

        // Only super_admin has automatic access bypass (not admin)
        // Admin role should respect their permission settings
        if (isAdmin || user?.role === 'super_admin') {
            setAuthorized(true);
            setCheckingAuth(false);
            return;
        }

        // For non-super_admin users (including admin), allow access while permissions are still loading
        // This prevents the app from feeling frozen on slow networks
        // The actual permission will be enforced once loaded (shows access denied if not allowed)
        if (isLoading) {
            // Optimistic: show content while loading, will redirect if unauthorized after load
            setAuthorized(true);
            setCheckingAuth(false);
            return;
        }

        // Get required menu code for this route
        const menuCode = requiredPermission || getRequiredMenuCode(pathname);

        // If no menu code required (unknown route), allow access
        if (!menuCode) {
            setAuthorized(true);
            setCheckingAuth(false);
            return;
        }

        // Check if user can see this menu item
        if (canSee(menuCode)) {
            setAuthorized(true);
        } else {
            setAuthorized(false);
        }
        setCheckingAuth(false);
    }, [pathname, canSee, isAdmin, isLoading, router, requiredPermission]);

    // Loading state - only show loader briefly on initial mount, not during permission check
    // This prevents the app from feeling unresponsive
    if (checkingAuth || authorized === null) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column',
                    gap: 2
                }}
            >
                <CircularProgress />
                <Typography color="text.secondary">Loading...</Typography>
            </Box>
        );
    }

    // Unauthorized
    if (!authorized) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column',
                    gap: 2,
                    p: 3
                }}
            >
                <Alert severity="error" sx={{ maxWidth: 500 }}>
                    <Typography variant="h6" gutterBottom>
                        Access Denied
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        You do not have permission to access this page.
                        Please contact your administrator if you believe this is an error.
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={() => router.push(fallbackPath)}
                        size="small"
                    >
                        Go to Dashboard
                    </Button>
                </Alert>
            </Box>
        );
    }

    return <>{children}</>;
}

/**
 * HOC to wrap pages with route protection
 */
export function withRouteGuard<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    requiredPermission?: string
) {
    return function GuardedComponent(props: P) {
        return (
            <RouteGuard requiredPermission={requiredPermission}>
                <WrappedComponent {...props} />
            </RouteGuard>
        );
    };
}

/**
 * Hook to check if current route is accessible
 */
export function useRouteAccess() {
    const pathname = usePathname();
    const { canAccess, canSee, isAdmin, isLoading } = usePermissions();

    const requiredMenuCode = getRequiredMenuCode(pathname);

    const hasAccess = isAdmin ||
        !requiredMenuCode ||
        (canAccess(requiredMenuCode) && canSee(requiredMenuCode));

    return {
        canAccess: hasAccess,
        isLoading,
        requiredMenuCode,
    };
}
