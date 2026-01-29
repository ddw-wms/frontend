/**
 * Hooks Index File
 * 
 * Export all custom hooks from a single location for easier imports.
 * Usage: import { useGridSettings, useDashboardFilters } from '@/hooks';
 */

// Authentication & Authorization
export { useAuthGuard } from './useAuthGuard';
export { useResourcePermissions } from './usePermission';
export { usePermissionGuard } from './usePermissionGuard';
export {
    usePagePermissions,
    useDashboardPermissions,
    useInboundPermissions,
    useQCPermissions,
    usePickingPermissions,
    useOutboundPermissions,
    useCustomersPermissions,
    useMasterDataPermissions,
    useWarehousesPermissions,
    useRacksPermissions,
    useUsersPermissions,
} from './usePagePermissions';

// UI & State Management
export { useSnackbar } from './useSnackbar';

// API & Data Fetching
export { useApiQuery, useApiMutation } from './useApiQuery';

// ⚡ Performance-Optimized Hooks
export { useDashboardFilters, type DashboardFilters, type DashboardPagination } from './useDashboardFilters';
export { useGridSettings, type GridSettings } from './useGridSettings';

// 🗃️ AG Grid State Management
export { useAgGridState, type UseAgGridStateOptions, type UseAgGridStateReturn } from './useAgGridState';
