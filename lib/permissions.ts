// File Path = warehouse-frontend/lib/permissions.ts
import axios from 'axios';
import { getStoredUser } from './auth';

//const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;


// Cache for permissions
let permissionsCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get user's permissions from API
export const fetchUserPermissions = async (): Promise<any> => {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;

        // Check cache
        const now = Date.now();
        if (permissionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
            return permissionsCache;
        }

        const response = await axios.get(`${API_BASE_URL}/permissions/my-permissions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        permissionsCache = response.data.permissions;
        cacheTimestamp = now;

        return response.data.permissions;
    } catch (error) {
        console.error('Error fetching permissions:', error);
        return null;
    }
};

// Clear permissions cache (call on logout or role change)
export const clearPermissionsCache = () => {
    permissionsCache = null;
    cacheTimestamp = 0;
};

// Check if user has specific permission
export const hasPermission = async (permissionKey: string): Promise<boolean> => {
    try {
        const permissions = await fetchUserPermissions();
        if (!permissions) return false;

        return permissions[permissionKey] === true;
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
};

// Synchronous version - uses cache only (for immediate UI checks)
export const hasPermissionSync = (permissionKey: string): boolean => {
    if (!permissionsCache) {
        // Fallback to role-based check if cache not loaded
        const user = getStoredUser();
        if (!user) return false;

        // Default admin bypass
        if (user.role === 'admin') return true;

        return false;
    }

    return permissionsCache[permissionKey] === true;
};

// Permissions API
export const permissionsAPI = {
    // Get all permissions (admin only)
    getAll: async () => {
        const token = localStorage.getItem('token');
        return axios.get(`${API_BASE_URL}/permissions/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    },

    // Save all permissions (admin only)
    saveAll: async (permissions: any) => {
        const token = localStorage.getItem('token');
        return axios.post(
            `${API_BASE_URL}/permissions/save-all`,
            { permissions },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    },

    // Save single role permissions (admin only)
    saveRole: async (role: string, permissions: any) => {
        const token = localStorage.getItem('token');
        return axios.post(
            `${API_BASE_URL}/permissions/role`,
            { role, permissions },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    },

    // Get current user permissions
    getMyPermissions: async () => {
        const token = localStorage.getItem('token');
        return axios.get(`${API_BASE_URL}/permissions/my-permissions`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    }
};
