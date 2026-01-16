/**
 * ⚡ PERFORMANCE OPTIMIZATION: Custom hook to manage dashboard filters
 * 
 * Purpose: Extract filter state and logic from the large dashboard page
 * to reduce re-renders and improve maintainability.
 * 
 * Benefits:
 * - Isolates filter-related state (won't trigger re-renders of other parts)
 * - Memoized callbacks prevent unnecessary function recreations
 * - Centralized filter logic makes debugging easier
 * - Can be reused in other pages with similar filter requirements
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

export interface DashboardFilters {
    searchWSN: string;
    stageFilter: string;
    availableOnly: boolean;
    brandFilter: string;
    categoryFilter: string;
    dateFrom: string;
    dateTo: string;
}

export interface DashboardPagination {
    page: number;
    limit: number;
    total: number;
}

const DEFAULT_FILTERS: DashboardFilters = {
    searchWSN: '',
    stageFilter: 'all',
    availableOnly: false,
    brandFilter: '',
    categoryFilter: '',
    dateFrom: '',
    dateTo: '',
};

const STORAGE_KEY = 'dashboardFilters';
const FILTERS_OPEN_KEY = 'dashboardFiltersOpen';

export function useDashboardFilters() {
    // Filter state
    const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);

    // Pagination state
    const [pagination, setPagination] = useState<DashboardPagination>({
        page: 1,
        limit: 50,
        total: 0,
    });

    // UI state
    const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            const saved = localStorage.getItem(FILTERS_OPEN_KEY);
            return saved === 'true';
        } catch {
            return false;
        }
    });

    // Debounced search value
    const [debouncedSearch, setDebouncedSearch] = useState(filters.searchWSN);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(filters.searchWSN);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters.searchWSN]);

    // Check if any filters are active
    const hasActiveFilters = useMemo(() => {
        return Boolean(
            filters.searchWSN.trim() ||
            (filters.stageFilter && filters.stageFilter !== 'all') ||
            filters.availableOnly ||
            filters.brandFilter.trim() ||
            filters.categoryFilter.trim() ||
            filters.dateFrom ||
            filters.dateTo
        );
    }, [filters]);

    // Filter setters - memoized to prevent unnecessary re-renders
    const setSearchWSN = useCallback((value: string) => {
        setFilters(prev => ({ ...prev, searchWSN: value }));
    }, []);

    const setStageFilter = useCallback((value: string) => {
        setFilters(prev => ({ ...prev, stageFilter: value }));
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1
    }, []);

    const setAvailableOnly = useCallback((value: boolean) => {
        setFilters(prev => ({ ...prev, availableOnly: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const setBrandFilter = useCallback((value: string) => {
        setFilters(prev => ({ ...prev, brandFilter: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const setCategoryFilter = useCallback((value: string) => {
        setFilters(prev => ({ ...prev, categoryFilter: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const setDateFrom = useCallback((value: string) => {
        setFilters(prev => ({ ...prev, dateFrom: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const setDateTo = useCallback((value: string) => {
        setFilters(prev => ({ ...prev, dateTo: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    // Pagination setters
    const setPage = useCallback((value: number) => {
        setPagination(prev => ({ ...prev, page: value }));
    }, []);

    const setLimit = useCallback((value: number) => {
        setPagination(prev => ({ ...prev, limit: value, page: 1 }));
    }, []);

    const setTotal = useCallback((value: number) => {
        setPagination(prev => ({ ...prev, total: value }));
    }, []);

    // Toggle filters panel
    const toggleFilters = useCallback(() => {
        setFiltersOpen(prev => {
            const next = !prev;
            try {
                localStorage.setItem(FILTERS_OPEN_KEY, next ? 'true' : 'false');
            } catch { /* ignore */ }
            return next;
        });
    }, []);

    // Reset all filters
    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    // Build query params for API
    const queryParams = useMemo(() => ({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        stage: filters.stageFilter !== 'all' ? filters.stageFilter : undefined,
        available_only: filters.availableOnly || undefined,
        brand: filters.brandFilter || undefined,
        category: filters.categoryFilter || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
    }), [
        pagination.page,
        pagination.limit,
        debouncedSearch,
        filters.stageFilter,
        filters.availableOnly,
        filters.brandFilter,
        filters.categoryFilter,
        filters.dateFrom,
        filters.dateTo,
    ]);

    return {
        // Filter values
        filters,
        debouncedSearch,
        hasActiveFilters,

        // Pagination values
        pagination,

        // UI state
        filtersOpen,

        // Filter setters
        setSearchWSN,
        setStageFilter,
        setAvailableOnly,
        setBrandFilter,
        setCategoryFilter,
        setDateFrom,
        setDateTo,

        // Pagination setters
        setPage,
        setLimit,
        setTotal,

        // Actions
        toggleFilters,
        resetFilters,

        // For API calls
        queryParams,
    };
}

export default useDashboardFilters;
