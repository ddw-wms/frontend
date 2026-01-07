/**
 * Utility functions for organizing and displaying granular permissions
 */

export interface Permission {
    permission_key: string;
    permission_name: string;
    category: string;
    description: string;
    enabled: boolean;
}

export interface PermissionGroup {
    type: 'base' | 'tab' | 'button' | 'filter' | 'action';
    label: string;
    permissions: Permission[];
    icon?: string;
}

/**
 * Organize permissions into logical groups
 */
export function organizePermissions(permissions: Permission[], category: string): PermissionGroup[] {
    const groups: PermissionGroup[] = [];

    // Base permissions (view, create, edit, delete, etc.)
    const basePermissions = permissions.filter(p =>
        p.category === category &&
        !p.permission_key.includes('_tab_') &&
        !p.permission_key.includes('_btn_') &&
        !p.permission_key.includes('_filter_') &&
        !p.permission_key.includes('_action_')
    );

    if (basePermissions.length > 0) {
        groups.push({
            type: 'base',
            label: 'Core Permissions',
            permissions: basePermissions,
            icon: '🔐'
        });
    }

    // Tab permissions
    const tabPermissions = permissions.filter(p =>
        p.category === category && p.permission_key.includes('_tab_')
    );

    if (tabPermissions.length > 0) {
        groups.push({
            type: 'tab',
            label: 'Tabs',
            permissions: tabPermissions,
            icon: '📑'
        });
    }

    // Button permissions
    const buttonPermissions = permissions.filter(p =>
        p.category === category && p.permission_key.includes('_btn_')
    );

    if (buttonPermissions.length > 0) {
        groups.push({
            type: 'button',
            label: 'Buttons',
            permissions: buttonPermissions,
            icon: '🔘'
        });
    }

    // Filter permissions
    const filterPermissions = permissions.filter(p =>
        p.category === category && p.permission_key.includes('_filter_')
    );

    if (filterPermissions.length > 0) {
        groups.push({
            type: 'filter',
            label: 'Filters',
            permissions: filterPermissions,
            icon: '🔍'
        });
    }

    // Action permissions
    const actionPermissions = permissions.filter(p =>
        p.category === category && p.permission_key.includes('_action_')
    );

    if (actionPermissions.length > 0) {
        groups.push({
            type: 'action',
            label: 'Actions',
            permissions: actionPermissions,
            icon: '⚡'
        });
    }

    return groups;
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
        'dashboard': 'Dashboard',
        'inbound': 'Inbound',
        'outbound': 'Outbound',
        'inventory': 'Inventory',
        'picking': 'Picking',
        'qc': 'Quality Control',
        'reports': 'Reports',
        'customers': 'Customers',
        'master-data': 'Master Data',
        'warehouses': 'Warehouses',
        'racks': 'Racks',
        'users': 'Users',
        'backups': 'Backups',
        'printers': 'Printers',
        'settings': 'Settings'
    };

    return names[category] || category;
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
        'dashboard': '📊',
        'inbound': '📥',
        'outbound': '📤',
        'inventory': '📦',
        'picking': '🛒',
        'qc': '✅',
        'reports': '📈',
        'customers': '👥',
        'master-data': '🗂️',
        'warehouses': '🏢',
        'racks': '🗄️',
        'users': '👤',
        'backups': '💾',
        'printers': '🖨️',
        'settings': '⚙️'
    };

    return icons[category] || '📁';
}

/**
 * Get permission type from key
 */
export function getPermissionType(permissionKey: string): 'base' | 'tab' | 'button' | 'filter' | 'action' {
    if (permissionKey.includes('_tab_')) return 'tab';
    if (permissionKey.includes('_btn_')) return 'button';
    if (permissionKey.includes('_filter_')) return 'filter';
    if (permissionKey.includes('_action_')) return 'action';
    return 'base';
}

/**
 * Get color for permission type
 */
export function getPermissionTypeColor(type: string): string {
    const colors: Record<string, string> = {
        'base': '#3b82f6',      // blue
        'tab': '#8b5cf6',       // purple
        'button': '#10b981',    // green
        'filter': '#f59e0b',    // amber
        'action': '#ef4444'     // red
    };

    return colors[type] || '#6b7280';
}

/**
 * Get badge label for permission type
 */
export function getPermissionTypeBadge(type: string): string {
    const badges: Record<string, string> = {
        'base': 'CORE',
        'tab': 'TAB',
        'button': 'BTN',
        'filter': 'FILTER',
        'action': 'ACTION'
    };

    return badges[type] || 'OTHER';
}

/**
 * Clean permission name for display
 */
export function cleanPermissionName(permissionName: string): string {
    // Remove category prefix if present
    return permissionName
        .replace(/^(Dashboard|Inbound|Outbound|Inventory|Picking|QC|Reports|Customers|Master Data|Warehouses|Racks|Users|Backups|Printers|Permissions)\s+/i, '')
        .trim();
}
