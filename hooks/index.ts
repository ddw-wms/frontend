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

// Fullscreen Mode
export { useFullscreen } from './useFullscreen';

// Live View (Real-time Multi Entry sharing)
export { useLiveSession } from './useLiveSession';

// Fast Submit (Optimistic batched submission)
export { useFastSubmit } from './useFastSubmit';

// Offline Guard (Submit protection when offline)
export { useOfflineGuard } from './useOfflineGuard';

// Real-time Sync (SSE-based multi-device data synchronization)
export { useRealtimeSync, getSSEDeviceId } from './useRealtimeSync';
