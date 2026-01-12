// File Path = warehouse-frontend/hooks/usePermission.ts
'use client';

import { useCallback, useMemo } from 'react';
import { usePermissions } from '@/app/context/PermissionContext';

/**
 * Hook for checking permissions on specific resources
 */
export function useResourcePermissions(resource: string) {
    const { canAccess, canSee, isAdmin } = usePermissions();

    const canView = useMemo(() =>
        isAdmin || canAccess(`feature:${resource}:view`),
        [canAccess, resource, isAdmin]
    );

    const canCreate = useMemo(() =>
        isAdmin || canAccess(`feature:${resource}:create`),
        [canAccess, resource, isAdmin]
    );

    const canEdit = useMemo(() =>
        isAdmin || canAccess(`feature:${resource}:edit`),
        [canAccess, resource, isAdmin]
    );

    const canDelete = useMemo(() =>
        isAdmin || canAccess(`feature:${resource}:delete`),
        [canAccess, resource, isAdmin]
    );

    const canExport = useMemo(() =>
        isAdmin || canAccess(`feature:${resource}:export`),
        [canAccess, resource, isAdmin]
    );

    const canUpload = useMemo(() =>
        isAdmin || canAccess(`feature:${resource}:upload`),
        [canAccess, resource, isAdmin]
    );

    return {
        canView,
        canCreate,
        canEdit,
        canDelete,
        canExport,
        canUpload,
    };
}

/**
 * Hook for page access control
 */
export function usePageAccess(pageName: string) {
    const { canAccessMenu, canSeeMenu, isLoading, isAdmin } = usePermissions();

    const canAccess = useMemo(() =>
        isAdmin || canAccessMenu(pageName),
        [canAccessMenu, pageName, isAdmin]
    );

    const isPageVisible = useMemo(() =>
        isAdmin || canSeeMenu(pageName),
        [canSeeMenu, pageName, isAdmin]
    );

    return {
        canAccess,
        isVisible: isPageVisible,
        isLoading,
    };
}

/**
 * Hook for action buttons (print, export, etc.)
 */
export function useActionPermissions() {
    const { canAccess, isAdmin } = usePermissions();

    return {
        canPrint: isAdmin || canAccess('action:print'),
        canExportExcel: isAdmin || canAccess('action:export-excel'),
        canExportPdf: isAdmin || canAccess('action:export-pdf'),
        canBulkDelete: isAdmin || canAccess('action:bulk-delete'),
        canBulkEdit: isAdmin || canAccess('action:bulk-edit'),
    };
}

/**
 * Hook for inbound-specific permissions
 */
export function useInboundPermissions() {
    const { canAccess, isAdmin } = usePermissions();
    const base = useResourcePermissions('inbound');

    return {
        ...base,
        canScan: isAdmin || canAccess('action:inbound:scan'),
        canPrintLabel: isAdmin || canAccess('action:inbound:print-label'),
    };
}

/**
 * Hook for QC-specific permissions
 */
export function useQCPermissions() {
    const { canAccess, isAdmin } = usePermissions();
    const base = useResourcePermissions('qc');

    return {
        ...base,
        canProcess: isAdmin || canAccess('feature:qc:process'),
        canApprove: isAdmin || canAccess('action:qc:approve'),
        canReject: isAdmin || canAccess('action:qc:reject'),
    };
}

/**
 * Hook for picking-specific permissions
 */
export function usePickingPermissions() {
    const { canAccess, isAdmin } = usePermissions();
    const base = useResourcePermissions('picking');

    return {
        ...base,
        canComplete: isAdmin || canAccess('action:picking:complete'),
    };
}

/**
 * Hook for outbound-specific permissions
 */
export function useOutboundPermissions() {
    const { canAccess, isAdmin } = usePermissions();
    const base = useResourcePermissions('outbound');

    return {
        ...base,
        canDispatch: isAdmin || canAccess('action:outbound:dispatch'),
    };
}

/**
 * Hook for settings permissions
 */
export function useSettingsPermissions() {
    const { canAccessMenu, isAdmin } = usePermissions();

    return {
        canAccessSettings: isAdmin || canAccessMenu('settings'),
        canAccessMasterData: isAdmin || canAccessMenu('settings-masterdata'),
        canAccessWarehouses: isAdmin || canAccessMenu('settings-warehouses'),
        canAccessRacks: isAdmin || canAccessMenu('settings-racks'),
        canAccessUsers: isAdmin || canAccessMenu('settings-users'),
        canAccessPrinters: isAdmin || canAccessMenu('settings-printers'),
        canAccessBackups: isAdmin || canAccessMenu('settings-backups'),
        canAccessPermissions: isAdmin || canAccessMenu('settings-permissions'),
    };
}

/**
 * Hook for permission management permissions
 */
export function usePermissionManagement() {
    const { canAccess, isAdmin } = usePermissions();

    return {
        canView: isAdmin || canAccess('feature:permissions:view'),
        canEditRoles: isAdmin || canAccess('feature:permissions:edit-roles'),
        canEditUsers: isAdmin || canAccess('feature:permissions:edit-users'),
        canCreateRoles: isAdmin || canAccess('feature:permissions:create-roles'),
        canDeleteRoles: isAdmin || canAccess('feature:permissions:delete-roles'),
    };
}

export default useResourcePermissions;
