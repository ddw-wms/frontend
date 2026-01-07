// File Path = wms_frontend/lib/permissions.ts
import axios from 'axios';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export interface UserPermissions {
    [key: string]: boolean;
}

/**
 * Fetch current user's permissions from API
 */
export async function fetchUserPermissions(): Promise<UserPermissions> {
    try {
        const response = await api.get('/permissions/my-permissions');
        return response.data.permissions || {};
    } catch (error) {
        console.error('Error fetching user permissions:', error);
        return {};
    }
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permissions: UserPermissions, permissionKey: string): boolean {
    // Check if user is admin (admins have all permissions)
    const user = localStorage.getItem('user');
    if (user) {
        try {
            const userData = JSON.parse(user);
            if (userData.role === 'admin') {
                return true;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }

    return permissions[permissionKey] === true;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(permissions: UserPermissions, permissionKeys: string[]): boolean {
    return permissionKeys.some(key => hasPermission(permissions, key));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(permissions: UserPermissions, permissionKeys: string[]): boolean {
    return permissionKeys.every(key => hasPermission(permissions, key));
}
