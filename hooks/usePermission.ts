// File Path = warehouse-frontend/hooks/usePermission.ts
'use client';

import { useCallback, useMemo } from 'react';
import { usePermissions } from '@/app/context/PermissionContext';

/**
 * Hook for checking permissions on specific resources
 */
export function useResourcePermissions(resource: string) {
    const { hasPermission, isVisible, isSuperAdmin } = usePermissions();

    const canView = useMemo(() =>
        isSuperAdmin || hasPermission(`feature:${resource}:view`),
        [hasPermission, resource, isSuperAdmin]
    );

    const canCreate = useMemo(() =>
        isSuperAdmin || hasPermission(`feature:${resource}:create`),
        [hasPermission, resource, isSuperAdmin]
    );

    const canEdit = useMemo(() =>
        isSuperAdmin || hasPermission(`feature:${resource}:edit`),
        [hasPermission, resource, isSuperAdmin]
    );

    const canDelete = useMemo(() =>
        isSuperAdmin || hasPermission(`feature:${resource}:delete`),
        [hasPermission, resource, isSuperAdmin]
    );

    const canExport = useMemo(() =>
        isSuperAdmin || hasPermission(`feature:${resource}:export`),
        [hasPermission, resource, isSuperAdmin]
    );

    const canUpload = useMemo(() =>
        isSuperAdmin || hasPermission(`feature:${resource}:upload`),
        [hasPermission, resource, isSuperAdmin]
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
    const { canAccessPage, isVisible, isLoading, isSuperAdmin } = usePermissions();

    const canAccess = useMemo(() =>
        isSuperAdmin || canAccessPage(pageName),
        [canAccessPage, pageName, isSuperAdmin]
    );

    const isPageVisible = useMemo(() =>
        isSuperAdmin || isVisible(`page:${pageName}`),
        [isVisible, pageName, isSuperAdmin]
    );

    return {
        canAccess,
        isVisible: isPageVisible,
        isLoading,
    };
}

/**
 * Hook for warehouse-based data filtering
 */
export function useWarehouseFilter() {
    const { accessibleWarehouses, defaultWarehouseId, canAccessWarehouse, isSuperAdmin } = usePermissions();

    const warehouseIds = useMemo(() =>
        accessibleWarehouses.map(w => w.warehouse_id),
        [accessibleWarehouses]
    );

    const filterByWarehouse = useCallback(<T extends { warehouse_id?: number }>(data: T[]): T[] => {
        if (isSuperAdmin) return data;
        return data.filter(item =>
            item.warehouse_id && canAccessWarehouse(item.warehouse_id)
        );
    }, [canAccessWarehouse, isSuperAdmin]);

    return {
        accessibleWarehouses,
        warehouseIds,
        defaultWarehouseId,
        canAccessWarehouse,
        filterByWarehouse,
        isSuperAdmin,
    };
}

/**
 * Hook for action buttons (print, export, etc.)
 */
export function useActionPermissions() {
    const { canPerformAction, isSuperAdmin } = usePermissions();

    return {
        canPrint: isSuperAdmin || canPerformAction('print'),
        canExportExcel: isSuperAdmin || canPerformAction('export-excel'),
        canExportPdf: isSuperAdmin || canPerformAction('export-pdf'),
        canBulkDelete: isSuperAdmin || canPerformAction('bulk-delete'),
        canBulkEdit: isSuperAdmin || canPerformAction('bulk-edit'),
    };
}

/**
 * Hook for inbound-specific permissions
 */
export function useInboundPermissions() {
    const { hasPermission, isSuperAdmin } = usePermissions();
    const base = useResourcePermissions('inbound');

    return {
        ...base,
        canScan: isSuperAdmin || hasPermission('action:inbound:scan'),
        canPrintLabel: isSuperAdmin || hasPermission('action:inbound:print-label'),
    };
}

/**
 * Hook for QC-specific permissions
 */
export function useQCPermissions() {
    const { hasPermission, isSuperAdmin } = usePermissions();
    const base = useResourcePermissions('qc');

    return {
        ...base,
        canProcess: isSuperAdmin || hasPermission('feature:qc:process'),
        canApprove: isSuperAdmin || hasPermission('action:qc:approve'),
        canReject: isSuperAdmin || hasPermission('action:qc:reject'),
    };
}

/**
 * Hook for picking-specific permissions
 */
export function usePickingPermissions() {
    const { hasPermission, isSuperAdmin } = usePermissions();
    const base = useResourcePermissions('picking');

    return {
        ...base,
        canComplete: isSuperAdmin || hasPermission('action:picking:complete'),
    };
}

/**
 * Hook for outbound-specific permissions
 */
export function useOutboundPermissions() {
    const { hasPermission, isSuperAdmin } = usePermissions();
    const base = useResourcePermissions('outbound');

    return {
        ...base,
        canDispatch: isSuperAdmin || hasPermission('action:outbound:dispatch'),
    };
}

/**
 * Hook for settings permissions
 */
export function useSettingsPermissions() {
    const { canAccessPage, isSuperAdmin } = usePermissions();

    return {
        canAccessSettings: isSuperAdmin || canAccessPage('settings'),
        canAccessMasterData: isSuperAdmin || canAccessPage('settings:master-data'),
        canAccessWarehouses: isSuperAdmin || canAccessPage('settings:warehouses'),
        canAccessRacks: isSuperAdmin || canAccessPage('settings:racks'),
        canAccessUsers: isSuperAdmin || canAccessPage('settings:users'),
        canAccessPrinters: isSuperAdmin || canAccessPage('settings:printers'),
        canAccessBackups: isSuperAdmin || canAccessPage('settings:backups'),
        canAccessPermissions: isSuperAdmin || canAccessPage('settings:permissions'),
    };
}

/**
 * Hook for permission management permissions
 */
export function usePermissionManagement() {
    const { hasPermission, isSuperAdmin } = usePermissions();

    return {
        canView: isSuperAdmin || hasPermission('feature:permissions:view'),
        canEditRoles: isSuperAdmin || hasPermission('feature:permissions:edit-roles'),
        canEditUsers: isSuperAdmin || hasPermission('feature:permissions:edit-users'),
        canCreateRoles: isSuperAdmin || hasPermission('feature:permissions:create-roles'),
        canDeleteRoles: isSuperAdmin || hasPermission('feature:permissions:delete-roles'),
    };
}

export default useResourcePermissions;
