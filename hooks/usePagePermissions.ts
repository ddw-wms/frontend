// File Path = warehouse-frontend/hooks/usePagePermissions.ts
// Hook for checking page-level permissions (tabs, buttons)

import { useMemo } from 'react';
import { usePermissions } from '@/app/context/PermissionContext';

interface TabDefinition {
    label: string;
    code: string;
    originalIndex: number;
}

interface UsePagePermissionsResult {
    // Tab utilities
    filterTabs: (allTabs: string[], tabCodes: string[]) => string[];
    getVisibleTabIndex: (allTabs: string[], tabCodes: string[], selectedIndex: number) => number;
    canSeeTab: (code: string) => boolean;
    canAccessTab: (code: string) => boolean;

    // Button utilities  
    canSeeButton: (code: string) => boolean;
    canAccessButton: (code: string) => boolean;

    // General
    isAdmin: boolean;
    isLoading: boolean;
}

/**
 * Hook for managing page-level permissions
 * @param page - The page identifier (e.g., 'inbound', 'qc', 'outbound')
 */
export function usePagePermissions(page: string): UsePagePermissionsResult {
    const { canSeeTab, canAccessTab, canSeeButton, canAccessButton, isAdmin, isLoading } = usePermissions();

    /**
     * Filter tabs based on visibility permissions
     * @param allTabs - Array of all tab labels
     * @param tabCodes - Array of tab permission codes (without 'tab:' prefix)
     * @returns Filtered array of visible tab labels
     */
    const filterTabs = useMemo(() => {
        return (allTabs: string[], tabCodes: string[]): string[] => {
            if (isAdmin) return allTabs;

            return allTabs.filter((_, index) => {
                const code = tabCodes[index];
                if (!code) return true; // No permission code = always visible
                const fullCode = code.startsWith('tab:') ? code : `tab:${page}:${code}`;
                return canSeeTab(fullCode);
            });
        };
    }, [canSeeTab, isAdmin, page]);

    /**
     * Convert a tab index from all tabs to visible tabs index
     * This is needed when the visible tabs array is smaller than all tabs
     */
    const getVisibleTabIndex = useMemo(() => {
        return (allTabs: string[], tabCodes: string[], selectedIndex: number): number => {
            if (isAdmin) return selectedIndex;

            let visibleIndex = 0;
            for (let i = 0; i < selectedIndex; i++) {
                const code = tabCodes[i];
                if (!code) {
                    visibleIndex++;
                    continue;
                }
                const fullCode = code.startsWith('tab:') ? code : `tab:${page}:${code}`;
                if (canSeeTab(fullCode)) {
                    visibleIndex++;
                }
            }
            return visibleIndex;
        };
    }, [canSeeTab, isAdmin, page]);

    // Wrapper for tab visibility with page prefix
    const canSeeTabForPage = useMemo(() => {
        return (code: string): boolean => {
            const fullCode = code.startsWith('tab:') ? code : `tab:${page}:${code}`;
            return canSeeTab(fullCode);
        };
    }, [canSeeTab, page]);

    // Wrapper for tab access with page prefix
    const canAccessTabForPage = useMemo(() => {
        return (code: string): boolean => {
            const fullCode = code.startsWith('tab:') ? code : `tab:${page}:${code}`;
            return canAccessTab(fullCode);
        };
    }, [canAccessTab, page]);

    // Wrapper for button visibility with page prefix
    const canSeeButtonForPage = useMemo(() => {
        return (code: string): boolean => {
            const fullCode = code.startsWith('btn:') ? code : `btn:${page}:${code}`;
            return canSeeButton(fullCode);
        };
    }, [canSeeButton, page]);

    // Wrapper for button access with page prefix
    const canAccessButtonForPage = useMemo(() => {
        return (code: string): boolean => {
            const fullCode = code.startsWith('btn:') ? code : `btn:${page}:${code}`;
            return canAccessButton(fullCode);
        };
    }, [canAccessButton, page]);

    return {
        filterTabs,
        getVisibleTabIndex,
        canSeeTab: canSeeTabForPage,
        canAccessTab: canAccessTabForPage,
        canSeeButton: canSeeButtonForPage,
        canAccessButton: canAccessButtonForPage,
        isAdmin,
        isLoading,
    };
}

/**
 * Pre-configured hooks for specific pages
 */
export const useInboundPermissions = () => usePagePermissions('inbound');
export const useQCPermissions = () => usePagePermissions('qc');
export const usePickingPermissions = () => usePagePermissions('picking');
export const useOutboundPermissions = () => usePagePermissions('outbound');
export const useCustomersPermissions = () => usePagePermissions('customers');
export const useMasterDataPermissions = () => usePagePermissions('masterdata');
export const useWarehousesPermissions = () => usePagePermissions('warehouses');
export const useRacksPermissions = () => usePagePermissions('racks');
export const useUsersPermissions = () => usePagePermissions('users');
export const useDashboardPermissions = () => usePagePermissions('dashboard');

export default usePagePermissions;
