// File Path = warehouse-frontend\lib\api.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

//const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// =================== Connection Status Manager ===================
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

interface ConnectionState {
  status: ConnectionStatus;
  lastError: string | null;
  retryCount: number;
  lastSuccessTime: Date | null;
}

// Global connection state
let connectionState: ConnectionState = {
  status: 'connected',
  lastError: null,
  retryCount: 0,
  lastSuccessTime: null,
};

// Listeners for connection status changes
type ConnectionListener = (state: ConnectionState) => void;
const connectionListeners: Set<ConnectionListener> = new Set();

export const connectionManager = {
  getState: () => ({ ...connectionState }),

  subscribe: (listener: ConnectionListener) => {
    connectionListeners.add(listener);
    // Immediately notify with current state
    listener(connectionState);
    return () => connectionListeners.delete(listener);
  },

  updateStatus: (status: ConnectionStatus, error?: string) => {
    connectionState = {
      ...connectionState,
      status,
      lastError: error || null,
      retryCount: status === 'reconnecting' ? connectionState.retryCount + 1 :
        status === 'connected' ? 0 : connectionState.retryCount,
      lastSuccessTime: status === 'connected' ? new Date() : connectionState.lastSuccessTime,
    };
    connectionListeners.forEach(listener => listener(connectionState));
  },
};

// =================== Error Message Helper ===================
export const getErrorMessage = (error: AxiosError | Error): string => {
  if (axios.isAxiosError(error)) {
    // Network errors (no response from server)
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return 'Server response timeout. Please wait, reconnecting...';
      }
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        return 'Unable to connect to server. Please check your internet connection.';
      }
      return 'Connection error. Server may be starting up...';
    }

    // Server responded with error
    const status = error.response.status;
    const serverMessage = error.response.data?.error || error.response.data?.message;

    switch (status) {
      case 401:
        return serverMessage || 'Session expired. Please login again.';
      case 403:
        return serverMessage || 'You do not have permission for this action.';
      case 404:
        return serverMessage || 'Requested resource not found.';
      case 500:
        return 'Server error. Our team has been notified.';
      case 502:
      case 503:
      case 504:
        return 'Server is temporarily unavailable. Reconnecting...';
      default:
        return serverMessage || `Request failed (Error ${status})`;
    }
  }
  return error.message || 'An unexpected error occurred';
};

// =================== Retry Configuration ===================
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRetryDelay = (attempt: number): number => {
  // Exponential backoff with jitter
  const delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay);
  const jitter = delay * 0.2 * Math.random();
  return delay + jitter;
};

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout - allows for database recovery after bulk uploads
});

// =====================Auth API====================
export const authAPI = {
  login: (username: string, password: string) => api.post('auth/login', { username, password }),
  register: (data: any) => api.post('auth/register', data),
};

// Request interceptor - add token and track requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Track retry count in config
  config.headers['x-retry-count'] = config.headers['x-retry-count'] || '0';
  return config;
});

// Response interceptor - handle errors with retry logic
api.interceptors.response.use(
  (response) => {
    // Success - update connection status
    connectionManager.updateStatus('connected');
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config;

    // Handle 401 - Authentication errors
    if (error.response?.status === 401) {
      const msg = ((error.response?.data as any)?.error || "").toLowerCase();
      if (msg.includes("token") || msg.includes("invalid") || msg.includes("expired")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // Check if we should retry
    const retryCount = parseInt(config?.headers?.['x-retry-count'] as string || '0');
    const isRetryable = !error.response ||
      RETRY_CONFIG.retryableStatuses.includes(error.response.status);
    const shouldRetry = config && retryCount < RETRY_CONFIG.maxRetries && isRetryable;

    if (shouldRetry) {
      // Update connection status
      connectionManager.updateStatus('reconnecting', getErrorMessage(error));

      // Wait before retry
      const delay = getRetryDelay(retryCount);
      console.log(`🔄 Retrying request (${retryCount + 1}/${RETRY_CONFIG.maxRetries}) in ${Math.round(delay)}ms...`);
      await sleep(delay);

      // Update retry count and retry
      config.headers['x-retry-count'] = String(retryCount + 1);
      return api.request(config);
    }

    // Max retries exceeded or non-retryable error
    connectionManager.updateStatus('disconnected', getErrorMessage(error));
    return Promise.reject(error);
  }
);

// ========================Warehouses API========================
export const warehousesAPI = {
  getAll: () => api.get('warehouses'),
  create: (data: any) => api.post('warehouses', data),
  update: (id: number, data: any) => api.put(`warehouses/${id}`, data),
  delete: (id: number) => api.delete(`warehouses/${id}`),
  setActive: (id: number) => api.patch(`warehouses/${id}/set-active`, {}),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('users'),
  create: (data: any) => api.post('users', data),
  update: (id: number, data: any) => api.put(`users/${id}`, data),
  delete: (id: number) => api.delete(`users/${id}`),
  changePassword: (id: number, newPassword: string) => api.patch(`users/${id}/change-password`, { newPassword }),
};

// ================= Sessions API (Admin only) =======================
export const sessionsAPI = {
  // Real-time status
  heartbeat: () => api.post('sessions/heartbeat'),
  getOnlineUsers: () => api.get('sessions/online-users'),
  getOnlineCount: () => api.get('sessions/online-count'),
  getAllSessions: () => api.get('sessions'),

  // Session management
  logoutUser: (userId: number) => api.post(`sessions/logout-user/${userId}`),
  logoutAll: (excludeSelf: boolean = true) => api.post('sessions/logout-all', { excludeSelf }),
  cleanup: () => api.delete('sessions/cleanup'),

  // User activity & history (Admin only)
  getUserSession: (userId: number) => api.get(`sessions/user-session/${userId}`),
  getLoginHistory: (userId: number, page: number = 1, limit: number = 50) =>
    api.get(`sessions/login-history/${userId}?page=${page}&limit=${limit}`),
  getUserActivity: (userId: number, page: number = 1, limit: number = 50, module?: string) =>
    api.get(`sessions/activity/${userId}?page=${page}&limit=${limit}${module ? `&module=${module}` : ''}`),
  getUserSummary: (userId: number) => api.get(`sessions/user-summary/${userId}`),

  // Log activity
  logActivity: (data: { activityType: string; module: string; action: string; details?: any; warehouseId?: number }) =>
    api.post('sessions/log-activity', data),
};

// ====================Master Data API===================
// export const masterDataAPI = {
//   getAll: (
//     page: number,
//     limit: number,
//     search: string
//   ) =>
//     api.get(
//       `master-data?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
//     ),
//   upload: (formData: FormData) =>
//     api.post('master-data/upload', formData, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//     }),
//   getUploadProgress: (jobId: string) => api.get(`master-data/upload/progress/${jobId}`),
//   cancelUpload: (jobId: string) => api.delete(`master-data/upload/cancel/${jobId}`),
//   getBatches: () => api.get('master-data/batches'),
//   delete: (id: number) => api.delete(`master-data/${id}`),
//   deleteBatch: (batchId: string) => api.delete(`master-data/batch/${batchId}`),
//   getActiveUploads: () => api.get('master-data/upload/active'),
// };

export const masterDataAPI = {
  // Supports optional filters: batch_id, status, brand, category
  getAll: (page = 1, limit = 100, search = '', filters?: any) =>
    api.get('master-data', {
      params: {
        page,
        limit,
        search,
        batch_id: filters?.batchId || filters?.batch_id,
        status: filters?.status,
        brand: filters?.brand,
        category: filters?.category
      },
    }),
  // Create single product
  create: (data: any) => api.post('master-data', data),
  // Update product
  update: (id: number, data: any) => api.put(`master-data/${id}`, data),
  upload: (formData: FormData) =>
    api.post('master-data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getUploadProgress: (jobId: string) => api.get(`master-data/upload/progress/${jobId}`),
  cancelUpload: (jobId: string) => api.delete(`master-data/upload/cancel/${jobId}`),
  getBatches: () => api.get('master-data/batches'),
  // Get unique brands for filter dropdown (optionally filtered by category)
  getBrands: (category?: string) => api.get('master-data/brands', { params: { category } }),
  // Get unique categories for filter dropdown (optionally filtered by brand)
  getCategories: (brand?: string) => api.get('master-data/categories', { params: { brand } }),
  delete: (id: number) => api.delete(`master-data/${id}`),
  deleteBatch: (batchId: string) => api.delete(`master-data/batch/${batchId}`),
  getActiveUploads: () => api.get('master-data/upload/active'),
  // Helper to trigger template download in browser
  downloadTemplate: () => {
    if (typeof window !== 'undefined') {
      window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/master-data/download-template`;
      return;
    }
    // Fallback (server-side) - returns axios promise
    return api.get('master-data/download-template');
  }
};

// ====================Inbound API=======================
export const inboundAPI = {
  createSingle: (data: any) => api.post('inbound', data),
  getMasterDataByWSN: (wsn: string) => api.get(`inbound/master-data/${wsn}`),
  // Master data cache APIs
  getMasterDataCount: () => api.get('master-data/count'),
  getMasterDataBatch: (page: number, limit: number) =>
    api.get('master-data/batch', { params: { page, limit } }),
  // Batch-specific cache APIs
  getMasterDataBatchList: () => api.get('master-data/batch-list'),
  getMasterDataByBatchIds: (batchIds: string[]) =>
    api.get('master-data/by-batch', { params: { batchIds: batchIds.join(',') } }),
  bulkUpload: (formData: FormData) => api.post('inbound/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAllInboundWSNs: () => api.get('inbound/wsns/all'),
  multiEntry: (entries: any[], warehouse_id: number) =>
    api.post('inbound/multi-entry', { entries, warehouse_id }),
  getWarehouseRacks: (warehouseId: number) => api.get(`inbound/racks/${warehouseId}`),

  // Receiving WSNs tracking (for multi-entry scanning status in master data)
  syncReceivingWSNs: (wsns: string[], warehouse_id: number) =>
    api.post('inbound/receiving-wsns/sync', { wsns, warehouse_id }),
  clearReceivingWSNs: (warehouse_id?: number) =>
    api.post('inbound/receiving-wsns/clear', { warehouse_id }),
  getReceivingWSNs: (warehouse_id?: number) =>
    api.get('inbound/receiving-wsns', { params: { warehouse_id } }),

  getBatches: (warehouseId?: string) => {
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    return api.get(`inbound/batches${params}`);
  },
  deleteBatch: (batchId: string) => api.delete(`inbound/batches/${batchId}`),
  getBrands: (warehouseId?: number) =>
    api.get('inbound/brands', { params: { warehouse_id: warehouseId } }),
  getCategories: (warehouseId?: number) =>
    api.get('inbound/categories', { params: { warehouse_id: warehouseId } }),
  getAll: (page: number, limit: number, filters?: any, config?: AxiosRequestConfig) =>
    api.get('inbound', {
      params: {
        page,
        limit,
        warehouseId: filters?.warehouseId,
        search: filters?.search,
        brand: filters?.brand,
        category: filters?.category,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        batchId: filters?.batchId
      },
      ...(config || {})
    }),

  getPrinterSettings: () => api.get('printer-settings'),
  printBarcode: (wsn: string) =>
    api.post('print-barcode', { wsn }),

};

// ====================Inventory/Stock API=======================
export const inventoryAPI = {
  getSummary: (warehouseId: number) => api.get(`inventory/summary?warehouseId=${warehouseId}`),
  getAvailableStock: (warehouseId: number, page = 1, limit = 100, search = '') =>
    api.get(`inventory/available-stock?warehouseId=${warehouseId}&page=${page}&limit=${limit}&search=${search}`),
  getStockByStatus: (warehouseId: number, status: string) =>
    api.get(`inventory/by-status?warehouseId=${warehouseId}&status=${status}`),
  getMovementHistory: (wsn: string) => api.get(`inventory/movement-history?wsn=${wsn}`),
};

// ======================Racks API======================
export const rackAPI = {
  getAll: (warehouseId?: number) => {
    const params = warehouseId ? `?warehouse_id=${warehouseId}` : '';
    return api.get(`racks${params}`);
  },
  create: (data: any) => api.post('racks', data),
  bulkUpload: (formData: FormData) => api.post('racks/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id: number, data: any) => api.put(`racks/${id}`, data),
  delete: (id: number) => api.delete(`racks/${id}`),
  toggleStatus: (id: number) => api.patch(`racks/${id}/toggle`),
  getByWarehouse: (warehouseId: number) => api.get('racks/by-warehouse',
    { params: { warehouse_id: warehouseId } })
};

// =====================QC API=========================
export const qcAPI = {
  getAllQCWSNs: () => api.get('qc/wsns/all'),

  getPendingInbound: (warehouseId?: number, search?: string) => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId.toString());
    if (search) params.append('search', search);
    return api.get(`/qc/pending-inbound?${params.toString()}`);
  },

  getList: (page: number, limit: number, filters?: any, config?: any) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.qcStatus) params.append('qcStatus', filters.qcStatus);
    if (filters?.qc_grade) params.append('qcGrade', filters.qc_grade);
    if (filters?.brand) params.append('brand', filters.brand);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    return api.get(`/qc/list?${params.toString()}`, config);
  },

  createEntry: (data: any) =>
    api.post('/qc/create', data),

  bulkUpload: (file: File, warehouseId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('warehouse_id', warehouseId.toString());
    return api.post('/qc/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  multiEntry: (data: any) =>
    api.post('/qc/multi-entry', data),

  checkExistingQC: (wsns: string[]) =>
    api.post('/qc/check-existing', { wsns }),

  getStats: (warehouseId?: number) =>
    api.get(`/qc/stats${warehouseId ? `?warehouseId=${warehouseId}` : ''}`),

  getCategories: (warehouseId?: number) =>
    api.get(`/qc/categories${warehouseId ? `?warehouseId=${warehouseId}` : ''}`),

  getBrands: (warehouseId?: number) =>
    api.get(`/qc/brands${warehouseId ? `?warehouseId=${warehouseId}` : ''}`),

  getBatches: (warehouseId?: number) =>
    api.get(`/qc/batches`, {
      params: { warehouseId }
    }),

  deleteBatch: (batchId: string) =>
    api.delete(`/qc/batch/${batchId}`),

  deleteEntry: (qcId: number) =>
    api.delete(`/qc/delete/${qcId}`),

  getWarehouseRacks: (warehouseId?: number) =>
    api.get(`/inbound/racks/${warehouseId}`),

  exportData: (filters?: any) =>
    api.get(`/qc/export`, {
      params: {
        warehouseId: filters?.warehouseId,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        qcStatus: filters?.qcStatus,
        qcGrade: filters?.qc_grade,
        brand: filters?.brand,
        category: filters?.category
      }
    }),

  downloadTemplate: () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/qc/template`;
  }
};

// ============================ CUSTOMER API ==============================
export const customerAPI = {
  // Get all customers for warehouse (full details)
  getAll: (warehouseId: number) =>
    api.get('/customers', { params: { warehouseId } }),
  // Get customer names only for dropdown
  getNames: (warehouseId: number) =>
    api.get('/customers/names', { params: { warehouseId } }),
  // Get single customer
  getById: (id: number) =>
    api.get(`/customers/${id}`),
  // Create customer
  create: (data: any) =>
    api.post('/customers', data),
  // Update customer
  update: (id: number, data: any) =>
    api.put(`/customers/${id}`, data),
  // Delete customer
  delete: (id: number) =>
    api.delete(`/customers/${id}`)
};

// ======================= OUTBOUND API ===========================
export const outboundAPI = {
  // Get all outbound WSNs for duplicate checking
  getAllOutboundWSNs: () => api.get('outbound/all-wsns'),

  // Get pending WSNs for outbound (from PICKING/QC)
  getPendingForOutbound: (warehouseId: number, search?: string) =>
    api.get('outbound/pending', { params: { warehouseId, search } }),

  // Get source data by WSN (PICKING → QC → INBOUND)
  getSourceByWSN: (wsn: string, warehouseId: number) =>
    api.get('outbound/source-by-wsn', { params: { wsn, warehouseId } }),

  // Create single outbound entry
  createSingle: (data: any) => api.post('outbound/single', data),

  // Multi entry with auto batch ID
  multiEntry: (data: { entries: any[]; warehouse_id: number }) =>
    api.post('outbound/multi', data),

  // Bulk upload with Excel file - Extended timeout for large files (30 minutes)
  bulkUpload: (formData: FormData) =>
    api.post('outbound/bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30 * 60 * 1000, // 30 minutes for large bulk uploads
    }),

  // Get outbound list with filters (accepts optional axios config, e.g., { signal })
  getList: (page: number, limit: number, params: {
    warehouseId?: number;
    search?: string;
    source?: string;
    customer?: string;
    startDate?: string;
    endDate?: string;
    batchId?: string;
    brand?: string;
    category?: string;
  }, config?: any) => api.get('outbound/list', { params: { page, limit, ...params }, ...(config || {}) }),

  // Get customers list for dropdown
  getCustomers: (warehouseId: number) =>
    api.get('outbound/customers', { params: { warehouseId } }),

  // Get existing WSNs for duplicate check
  getExistingWSNs: (warehouseId: number) =>
    api.get('outbound/existing-wsns', { params: { warehouseId } }),

  // Get batches for batch management
  getBatches: (warehouseId: number) =>
    api.get('outbound/batches', { params: { warehouseId } }),

  // Delete batch
  deleteBatch: (batchId: string) =>
    api.delete(`outbound/batch/${batchId}`),

  // Export to Excel with filters
  exportToExcel: (params: {
    warehouseId?: number;
    source?: string;
    customer?: string;
    startDate?: string;
    endDate?: string;
    batchId?: string;
  }) => api.get('outbound/export', { params, responseType: 'blob' }),

  // Get brands for filter dropdown
  getBrands: (warehouseId?: number) =>
    api.get('outbound/brands', { params: { warehouse_id: warehouseId } }),

  // Get categories for filter dropdown
  getCategories: (warehouseId?: number) =>
    api.get('outbound/categories', { params: { warehouse_id: warehouseId } }),
  // Get available sources for outbound filter (distinct values from outbound table)
  getSources: (warehouseId?: number) =>
    api.get('outbound/sources', { params: { warehouse_id: warehouseId } }),

  // Get all available inventory for outbound caching (PICKING + QC + INBOUND not yet dispatched)
  getAvailableForOutbound: (warehouseId: number) =>
    api.get('outbound/available-inventory', { params: { warehouseId } }),
};

// ==========================PICKING API ==============================
export const pickingAPI = {
  // Get source data by WSN (QC → INBOUND → MASTER priority)
  getSourceByWSN: (wsn: string, warehouseId: number) =>
    api.get('/picking/source-by-wsn', {
      params: { wsn, warehouseId }
    }),
  // Multi-entry with auto batch ID
  multiEntry: (entries: any[], warehouse_id: number) =>
    api.post('/picking/multi-entry', {
      entries,
      warehouse_id
    }),
  // Get picking list with filters & pagination
  getList: (params: {
    page: number;
    limit: number;
    warehouseId: number;
    search?: string;
    brand?: string;
    category?: string;
    source?: string;
  }) =>
    api.get('/picking/list', { params }),
  // Get customers list for dropdown (using customer API)
  getCustomers: (warehouseId: number) =>
    customerAPI.getNames(warehouseId),
  // Check if WSN exists
  checkWSNExists: (wsn: string, warehouseId: number) =>
    api.get('/picking/check-wsn', {
      params: { wsn, warehouseId }
    }),
  // Get all existing WSNs for duplicate check
  getExistingWSNs: (warehouseId: number) =>
    api.get('/picking/existing-wsns', {
      params: { warehouseId }
    }),
  // Get batches
  getBatches: (warehouseId: number) =>
    api.get('/picking/batches', {
      params: { warehouseId }
    }),
  // Delete batch
  deleteBatch: (batchId: string) =>
    api.delete(`/picking/batch/${batchId}`),
  // Get unique brands for filter dropdown
  getBrands: (warehouseId?: number) =>
    api.get('/picking/brands', { params: { warehouseId } }),
  // Get unique categories for filter dropdown
  getCategories: (warehouseId?: number) =>
    api.get('/picking/categories', { params: { warehouseId } })
};

// ======================== DASHBOARD API ==============================
export const dashboardAPI = {
  // Get inventory pipeline with all stages
  getInventoryPipeline: (params: any, config: any = {}) =>
    api.get('/dashboard/inventory-pipeline', { params, ...config }),

  // Get inventory metrics
  getInventoryMetrics: (warehouseId: number) =>
    api.get('/dashboard/inventory-metrics', {
      params: { warehouseId }
    }),

  // Get activity logs
  getActivityLogs: (params: {
    warehouseId: number;
    page?: number;
    limit?: number;
  }) =>
    api.get('/dashboard/activity-logs', { params }),

  // ✅ FIXED: Get data for export with complete details
  getInventoryDataForExport: (queryString: string) =>
    api.get(`/dashboard/export-data?${queryString}`),

  // ✅ PIVOT TABLE APIs - Server-side aggregation
  // Get pivot summary (category-wise qty count)
  getPivotSummary: (params: { warehouseId: number; groupBy?: string; brand?: string; category?: string }) =>
    api.get('/dashboard/pivot-summary', { params }),

  // Get pivot filter options (brands, categories)
  getPivotFilters: (params: { warehouseId: number }) =>
    api.get('/dashboard/pivot-filters', { params }),

  // Get drill-down data for a specific category (with all master_data columns)
  getPivotDrilldown: (params: {
    warehouseId: number;
    groupBy?: string;
    categoryValue: string;
    page?: number;
    limit?: number;
    exportAll?: boolean;
  }) =>
    api.get('/dashboard/pivot-drilldown', { params }),
};


// ================= Reports API =======================

// ================= Permissions API =======================
export const permissionsAPI = {
  // Get current user's permissions
  getMyPermissions: () => api.get('/permissions/me'),

  // Check specific permission
  checkPermission: (code: string) => api.get(`/permissions/check/${code}`),

  // Get all permissions (master list)
  getAll: () => api.get('/permissions'),

  // Roles
  getRoles: () => api.get('/permissions/roles'),
  getRolePermissions: (roleId: number) => api.get(`/permissions/roles/${roleId}/permissions`),
  updateRolePermissions: (roleId: number, permissions: { code: string; is_enabled: boolean; is_visible: boolean }[]) =>
    api.put(`/permissions/roles/${roleId}/permissions`, { permissions }, { timeout: 30000 }), // Extended timeout for batch update

  // User overrides
  getUserOverrides: (userId: number) => api.get(`/permissions/users/${userId}/overrides`),
  updateUserOverrides: (userId: number, overrides: { code: string; is_enabled: boolean | null; is_visible: boolean | null }[]) =>
    api.put(`/permissions/users/${userId}/overrides`, { overrides }, { timeout: 30000 }), // Extended timeout for batch update

  // User warehouses
  getUserWarehouses: (userId: number) => api.get(`/permissions/users/${userId}/warehouses`),
  updateUserWarehouses: (userId: number, warehouse_ids: number[], default_warehouse_id?: number) =>
    api.put(`/permissions/users/${userId}/warehouses`, { warehouse_ids, default_warehouse_id }),

  // ============== Approval Workflow APIs ==============
  // Get pending approval count (for badge)
  getPendingApprovalCount: () => api.get('/permissions/approval/pending-count'),

  // Get all approval requests (super_admin only)
  getApprovalRequests: (status?: string) =>
    api.get('/permissions/approval/requests', { params: { status: status || 'all' } }),

  // Get single request with details
  getApprovalRequestDetails: (requestId: number) =>
    api.get(`/permissions/approval/requests/${requestId}`),

  // Get current user's requests
  getMyApprovalRequests: () => api.get('/permissions/approval/my-requests'),

  // Create role permission change request
  createRolePermissionRequest: (roleId: number, permissions: { code: string; is_enabled: boolean; is_visible: boolean }[]) =>
    api.post('/permissions/approval/role-request', { roleId, permissions }),

  // Create user override change request
  createUserOverrideRequest: (targetUserId: number, overrides: { code: string; is_enabled: boolean | null; is_visible: boolean | null }[]) =>
    api.post('/permissions/approval/user-request', { targetUserId, overrides }),

  // Update individual change approvals (super_admin)
  updateChangeApprovals: (requestId: number, changes: { detailId: number; is_approved: boolean }[]) =>
    api.put(`/permissions/approval/requests/${requestId}/changes`, { changes }),

  // Finalize request (approve/reject/partial)
  finalizeRequest: (requestId: number, action: 'approve' | 'reject' | 'partial', note?: string, approveAll?: boolean) =>
    api.post(`/permissions/approval/requests/${requestId}/finalize`, { action, note, approveAll }),

  // Cancel request
  cancelRequest: (requestId: number) =>
    api.delete(`/permissions/approval/requests/${requestId}`),
};

// ================= Error Logs API (Super Admin Only) =======================
export const errorLogsAPI = {
  getAll: () => api.get('/error-logs'),
  getCount: () => api.get('/error-logs/count'),
  clearAll: () => api.delete('/error-logs/clear'),
  cleanup: (days: number) => api.delete(`/error-logs/cleanup/${days}`),
};


export default api;