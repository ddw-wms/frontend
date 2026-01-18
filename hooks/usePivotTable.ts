// File: hooks/usePivotTable.ts
// Pivot Table calculation hook - Excel-style pivot functionality

import { useMemo, useState, useCallback } from 'react';

export type AggregationType = 'count' | 'sum' | 'average' | 'min' | 'max';

export interface PivotConfig {
    rowFields: string[];      // Fields to group by rows (e.g., ['cms_vertical', 'brand'])
    colField: string;         // Field to group by columns (e.g., 'current_stage')
    valueField: string;       // Field to aggregate (e.g., 'fsp', 'mrp')
    aggregation: AggregationType;
}

export interface PivotCell {
    value: number;
    count: number;
    items: any[];  // Original items for drill-down
}

export interface PivotRow {
    key: string;
    label: string;
    level: number;
    isExpanded: boolean;
    children: PivotRow[];
    cells: Record<string, PivotCell>;
    total: PivotCell;
    path: string[];  // Full path for nested rows
}

export interface PivotResult {
    rows: PivotRow[];
    columns: string[];
    grandTotal: Record<string, PivotCell>;
    grandTotalAll: PivotCell;
}

// Available fields for pivot
export const PIVOT_FIELDS = [
    { key: 'brand', label: 'Brand', type: 'string' },
    { key: 'cms_vertical', label: 'Category', type: 'string' },
    { key: 'current_stage', label: 'Stage', type: 'string' },
    { key: 'qc_status', label: 'QC Status', type: 'string' },
    { key: 'rack_no', label: 'Rack No', type: 'string' },
    { key: 'warehouse_location', label: 'Location', type: 'string' },
    { key: 'inbound_status', label: 'Inbound Status', type: 'string' },
    { key: 'picking_status', label: 'Picking Status', type: 'string' },
    { key: 'outbound_status', label: 'Outbound Status', type: 'string' },
];

export const VALUE_FIELDS = [
    { key: '_count', label: 'Count', type: 'count' },
    { key: 'fsp', label: 'FSP (₹)', type: 'number' },
    { key: 'mrp', label: 'MRP (₹)', type: 'number' },
    { key: 'vrp', label: 'VRP (₹)', type: 'number' },
    { key: 'yield_value', label: 'Yield Value', type: 'number' },
];

export const AGGREGATION_TYPES: { key: AggregationType; label: string }[] = [
    { key: 'count', label: 'Count' },
    { key: 'sum', label: 'Sum' },
    { key: 'average', label: 'Average' },
    { key: 'min', label: 'Min' },
    { key: 'max', label: 'Max' },
];

// Helper: Get nested value from object
const getNestedValue = (obj: any, key: string): any => {
    if (!obj || !key) return null;
    return obj[key] ?? null;
};

// Helper: Aggregate values
const aggregate = (items: any[], field: string, type: AggregationType): number => {
    if (!items || items.length === 0) return 0;

    if (type === 'count' || field === '_count') {
        return items.length;
    }

    const values = items
        .map(item => parseFloat(getNestedValue(item, field)))
        .filter(v => !isNaN(v) && v !== null);

    if (values.length === 0) return 0;

    switch (type) {
        case 'sum':
            return values.reduce((a, b) => a + b, 0);
        case 'average':
            return values.reduce((a, b) => a + b, 0) / values.length;
        case 'min':
            return Math.min(...values);
        case 'max':
            return Math.max(...values);
        default:
            return values.length;
    }
};

// Helper: Create pivot cell
const createPivotCell = (items: any[], field: string, aggregation: AggregationType): PivotCell => ({
    value: aggregate(items, field, aggregation),
    count: items.length,
    items,
});

// Main pivot calculation
const calculatePivot = (
    data: any[],
    config: PivotConfig,
    expandedRows: Set<string>
): PivotResult => {
    if (!data || data.length === 0 || !config.rowFields.length) {
        return {
            rows: [],
            columns: [],
            grandTotal: {},
            grandTotalAll: { value: 0, count: 0, items: [] },
        };
    }

    const { rowFields, colField, valueField, aggregation } = config;

    // Get unique column values
    const columnSet = new Set<string>();
    data.forEach(item => {
        const colValue = getNestedValue(item, colField);
        if (colValue !== null && colValue !== undefined && colValue !== '') {
            columnSet.add(String(colValue));
        }
    });
    const columns = Array.from(columnSet).sort();

    // Group data by row fields (hierarchical)
    const groupByFields = (
        items: any[],
        fields: string[],
        level: number = 0,
        parentPath: string[] = []
    ): PivotRow[] => {
        if (fields.length === 0 || level >= fields.length) {
            return [];
        }

        const currentField = fields[level];
        const groups = new Map<string, any[]>();

        items.forEach(item => {
            const value = getNestedValue(item, currentField);
            const key = value !== null && value !== undefined && value !== '' ? String(value) : '(Empty)';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        });

        const rows: PivotRow[] = [];
        const sortedKeys = Array.from(groups.keys()).sort();

        sortedKeys.forEach(key => {
            const groupItems = groups.get(key)!;
            const path = [...parentPath, key];
            const pathKey = path.join('|||');
            const isExpanded = expandedRows.has(pathKey);

            // Calculate cells for each column
            const cells: Record<string, PivotCell> = {};
            columns.forEach(col => {
                const colItems = groupItems.filter(item => String(getNestedValue(item, colField)) === col);
                cells[col] = createPivotCell(colItems, valueField, aggregation);
            });

            // Calculate row total
            const total = createPivotCell(groupItems, valueField, aggregation);

            // Get children if expanded and more fields available
            let children: PivotRow[] = [];
            if (isExpanded && level < fields.length - 1) {
                children = groupByFields(groupItems, fields, level + 1, path);
            }

            rows.push({
                key: pathKey,
                label: key,
                level,
                isExpanded,
                children,
                cells,
                total,
                path,
            });
        });

        return rows;
    };

    const rows = groupByFields(data, rowFields);

    // Calculate grand totals for each column
    const grandTotal: Record<string, PivotCell> = {};
    columns.forEach(col => {
        const colItems = data.filter(item => String(getNestedValue(item, colField)) === col);
        grandTotal[col] = createPivotCell(colItems, valueField, aggregation);
    });

    // Grand total of all
    const grandTotalAll = createPivotCell(data, valueField, aggregation);

    return { rows, columns, grandTotal, grandTotalAll };
};

// Hook
export const usePivotTable = (data: any[]) => {
    const [config, setConfig] = useState<PivotConfig>({
        rowFields: ['cms_vertical'],
        colField: 'current_stage',
        valueField: '_count',
        aggregation: 'count',
    });

    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [drillDownData, setDrillDownData] = useState<{ items: any[]; title: string } | null>(null);

    // Calculate pivot when data or config changes
    const pivotResult = useMemo(() => {
        return calculatePivot(data, config, expandedRows);
    }, [data, config, expandedRows]);

    // Toggle row expansion
    const toggleRowExpansion = useCallback((rowKey: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(rowKey)) {
                next.delete(rowKey);
            } else {
                next.add(rowKey);
            }
            return next;
        });
    }, []);

    // Update config
    const updateConfig = useCallback((updates: Partial<PivotConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
        // Reset expansions when config changes
        if (updates.rowFields) {
            setExpandedRows(new Set());
        }
    }, []);

    // Add row field
    const addRowField = useCallback((field: string) => {
        setConfig(prev => {
            if (prev.rowFields.includes(field)) return prev;
            return { ...prev, rowFields: [...prev.rowFields, field] };
        });
    }, []);

    // Remove row field
    const removeRowField = useCallback((field: string) => {
        setConfig(prev => ({
            ...prev,
            rowFields: prev.rowFields.filter(f => f !== field),
        }));
    }, []);

    // Open drill-down
    const openDrillDown = useCallback((items: any[], title: string) => {
        setDrillDownData({ items, title });
    }, []);

    // Close drill-down
    const closeDrillDown = useCallback(() => {
        setDrillDownData(null);
    }, []);

    // Expand all
    const expandAll = useCallback(() => {
        const allKeys = new Set<string>();
        const collectKeys = (rows: PivotRow[]) => {
            rows.forEach(row => {
                allKeys.add(row.key);
                if (row.children) collectKeys(row.children);
            });
        };
        // Re-calculate with all expanded to get all keys
        const tempResult = calculatePivot(data, config, new Set());
        collectKeys(tempResult.rows);
        setExpandedRows(allKeys);
    }, [data, config]);

    // Collapse all
    const collapseAll = useCallback(() => {
        setExpandedRows(new Set());
    }, []);

    return {
        config,
        pivotResult,
        expandedRows,
        drillDownData,
        updateConfig,
        addRowField,
        removeRowField,
        toggleRowExpansion,
        openDrillDown,
        closeDrillDown,
        expandAll,
        collapseAll,
    };
};

export default usePivotTable;
