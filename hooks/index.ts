/**
 * Hooks Index File
 * 
 * Export all custom hooks from a single location for easier imports.
 * Usage: import { useGridSettings, useDashboardFilters } from '@/hooks';
 */

// Authentication & Authorization
export { useAuthGuard } from './useAuthGuard';
export { usePermission } from './usePermission';
export { usePermissionGuard } from './usePermissionGuard';
export {
    usePagePermissions,
    useDashboardPermissions,
    useInboundPermissions,
    useQCPermissions,
    usePickingPermissions,
    useOutboundPermissions,
    useSettingsPermissions,
    useReportsPermissions,
    useBackupsPermissions,
    useUsersPermissions,
    usePermissionsPermissions,
} from './usePagePermissions';

// UI & State Management
export { useSnackbar } from './useSnackbar';

// ⚡ Performance-Optimized Hooks
export { useDashboardFilters, type DashboardFilters, type DashboardPagination } from './useDashboardFilters';
export { useGridSettings, type GridSettings } from './useGridSettings';
