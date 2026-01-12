'use client';
// File Path = warehouse-frontend/components/PermissionButton.tsx

import React from 'react';
import { Button, ButtonProps, IconButton, IconButtonProps, Tooltip } from '@mui/material';
import { usePermissions } from '@/app/context/PermissionContext';

interface PermissionButtonProps extends ButtonProps {
    permissionCode: string;
    hideWhenDisabled?: boolean;
    disabledTooltip?: string;
}

/**
 * Button that is conditionally rendered/disabled based on user permissions
 */
export function PermissionButton({
    permissionCode,
    hideWhenDisabled = false,
    disabledTooltip = 'You do not have permission to perform this action',
    children,
    ...buttonProps
}: PermissionButtonProps) {
    const { canAccess, canSee, isAdmin, isLoading } = usePermissions();

    // Admin can do everything
    if (isAdmin) {
        return <Button {...buttonProps}>{children}</Button>;
    }

    // Check if permission is visible
    if (!canSee(permissionCode)) {
        return null;
    }

    // Check if user has permission
    const hasAccess = canAccess(permissionCode);

    // Hide button if no access and hideWhenDisabled is true
    if (!canAccess && hideWhenDisabled) {
        return null;
    }

    // Show disabled button with tooltip if no access
    if (!canAccess) {
        return (
            <Tooltip title={disabledTooltip}>
                <span>
                    <Button {...buttonProps} disabled>
                        {children}
                    </Button>
                </span>
            </Tooltip>
        );
    }

    return <Button {...buttonProps}>{children}</Button>;
}

interface PermissionIconButtonProps extends IconButtonProps {
    permissionCode: string;
    hideWhenDisabled?: boolean;
    disabledTooltip?: string;
    tooltip?: string;
}

/**
 * IconButton that is conditionally rendered/disabled based on user permissions
 */
export function PermissionIconButton({
    permissionCode,
    hideWhenDisabled = true, // Icon buttons usually hide when no permission
    disabledTooltip = 'You do not have permission',
    tooltip,
    children,
    ...iconButtonProps
}: PermissionIconButtonProps) {
    const { canAccess, canSee, isAdmin } = usePermissions();

    // Admin can do everything
    if (isAdmin) {
        if (tooltip) {
            return (
                <Tooltip title={tooltip}>
                    <IconButton {...iconButtonProps}>{children}</IconButton>
                </Tooltip>
            );
        }
        return <IconButton {...iconButtonProps}>{children}</IconButton>;
    }

    // Check if permission is visible
    if (!canSee(permissionCode)) {
        return null;
    }

    // Check if user has permission
    const hasAccess = canAccess(permissionCode);

    // Hide button if no access and hideWhenDisabled is true
    if (!hasAccess && hideWhenDisabled) {
        return null;
    }

    // Show disabled button with tooltip if no access
    if (!hasAccess) {
        return (
            <Tooltip title={disabledTooltip}>
                <span>
                    <IconButton {...iconButtonProps} disabled>
                        {children}
                    </IconButton>
                </span>
            </Tooltip>
        );
    }

    if (tooltip) {
        return (
            <Tooltip title={tooltip}>
                <IconButton {...iconButtonProps}>{children}</IconButton>
            </Tooltip>
        );
    }

    return <IconButton {...iconButtonProps}>{children}</IconButton>;
}

/**
 * Common action button types with preset permissions
 */
export function CreateButton({ resource, ...props }: Omit<PermissionButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionButton permissionCode={`feature:${resource}:create`} {...props} />;
}

export function EditButton({ resource, ...props }: Omit<PermissionButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionButton permissionCode={`feature:${resource}:edit`} {...props} />;
}

export function DeleteButton({ resource, ...props }: Omit<PermissionButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionButton permissionCode={`feature:${resource}:delete`} {...props} />;
}

export function ExportButton({ resource, ...props }: Omit<PermissionButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionButton permissionCode={`feature:${resource}:export`} {...props} />;
}

export function UploadButton({ resource, ...props }: Omit<PermissionButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionButton permissionCode={`feature:${resource}:upload`} {...props} />;
}

/**
 * Icon button variants
 */
export function CreateIconButton({ resource, ...props }: Omit<PermissionIconButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionIconButton permissionCode={`feature:${resource}:create`} tooltip="Create new" {...props} />;
}

export function EditIconButton({ resource, ...props }: Omit<PermissionIconButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionIconButton permissionCode={`feature:${resource}:edit`} tooltip="Edit" {...props} />;
}

export function DeleteIconButton({ resource, ...props }: Omit<PermissionIconButtonProps, 'permissionCode'> & { resource: string }) {
    return <PermissionIconButton permissionCode={`feature:${resource}:delete`} tooltip="Delete" {...props} />;
}

export function PrintIconButton(props: Omit<PermissionIconButtonProps, 'permissionCode'>) {
    return <PermissionIconButton permissionCode="action:print" tooltip="Print" {...props} />;
}

export function ExportExcelIconButton(props: Omit<PermissionIconButtonProps, 'permissionCode'>) {
    return <PermissionIconButton permissionCode="action:export-excel" tooltip="Export to Excel" {...props} />;
}

export default PermissionButton;
