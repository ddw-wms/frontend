// File Path = wms_frontend/components/PermissionButton.tsx
'use client';

import React from 'react';
import { Button, IconButton, Tooltip, ButtonProps } from '@mui/material';
import { usePermissions } from '@/app/context/PermissionsContext';

interface PermissionButtonProps extends ButtonProps {
    permission?: string | string[];
    requireAll?: boolean;
    hideIfNoPermission?: boolean;
    showTooltipOnDisabled?: boolean;
    children: React.ReactNode;
}

/**
 * Button component that automatically handles permission checks
 * - Disables button if user doesn't have permission
 * - Optionally hides button if user doesn't have permission
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
    permission,
    requireAll = false,
    hideIfNoPermission = false,
    showTooltipOnDisabled = true,
    disabled,
    children,
    ...buttonProps
}) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

    // If no permission specified, render normal button
    if (!permission) {
        return <Button {...buttonProps} disabled={disabled || loading}>{children}</Button>;
    }

    // Check permissions
    let hasAccess = false;
    if (Array.isArray(permission)) {
        hasAccess = requireAll ? hasAllPermissions(permission) : hasAnyPermission(permission);
    } else {
        hasAccess = hasPermission(permission);
    }

    // Hide button if no permission and hideIfNoPermission is true
    if (!hasAccess && hideIfNoPermission) {
        return null;
    }

    // Disable button if no permission
    const isDisabled = disabled || loading || !hasAccess;

    const button = (
        <Button {...buttonProps} disabled={isDisabled}>
            {children}
        </Button>
    );

    // Show tooltip if disabled due to permissions
    if (!hasAccess && showTooltipOnDisabled && !disabled) {
        return (
            <Tooltip title="You don't have permission to perform this action" arrow>
                <span>{button}</span>
            </Tooltip>
        );
    }

    return button;
};

// Icon Button version
interface PermissionIconButtonProps extends ButtonProps {
    permission?: string | string[];
    requireAll?: boolean;
    hideIfNoPermission?: boolean;
    icon: React.ReactNode;
    tooltip?: string;
    size?: 'small' | 'medium' | 'large';
}

export const PermissionIconButton: React.FC<PermissionIconButtonProps> = ({
    permission,
    requireAll = false,
    hideIfNoPermission = false,
    disabled,
    icon,
    tooltip,
    size = 'medium',
    ...buttonProps
}) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

    // If no permission specified, render normal button
    if (!permission) {
        return (
            <Tooltip title={tooltip || ''} arrow>
                <span>
                    <IconButton {...buttonProps as any} disabled={disabled || loading} size={size}>
                        {icon}
                    </IconButton>
                </span>
            </Tooltip>
        );
    }

    // Check permissions
    let hasAccess = false;
    if (Array.isArray(permission)) {
        hasAccess = requireAll ? hasAllPermissions(permission) : hasAnyPermission(permission);
    } else {
        hasAccess = hasPermission(permission);
    }

    // Hide button if no permission and hideIfNoPermission is true
    if (!hasAccess && hideIfNoPermission) {
        return null;
    }

    // Disable button if no permission
    const isDisabled = disabled || loading || !hasAccess;

    const tooltipText = !hasAccess && !disabled
        ? "You don't have permission to perform this action"
        : tooltip || '';

    return (
        <Tooltip title={tooltipText} arrow>
            <span>
                <IconButton {...buttonProps as any} disabled={isDisabled} size={size}>
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    );
};
