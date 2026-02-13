// File Path = warehouse-frontend\lib\api.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

//const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// =========================== ERROR TYPES ===========================
export interface ApiErrorDetails {
  message: string;
  userMessage: string;
  isRetryable: boolean;
  isNetworkError: boolean;
  isServerError: boolean;
  isTimeout: boolean;
  statusCode?: number;
}

// Parse API errors into user-friendly format
export const parseApiError = (error: any): ApiErrorDetails => {
  // Network error (no response from server)
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return {
      message: error.message,
      userMessage: 'Unable to connect to the server. Please check your internet connection or try again later.',
      isRetryable: true,
      isNetworkError: true,
      isServerError: false,
      isTimeout: false,
    };
  }

  // Timeout error
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return {
      message: error.message,
      userMessage: 'The request took too long. The server might be busy. Please try again.',
      isRetryable: true,
      isNetworkError: false,
      isServerError: false,
      isTimeout: true,
    };
  }

  // Server responded with error
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    // Server starting up (503)
    if (status === 503) {
      return {
        message: data?.error || 'Service unavailable',
        userMessage: data?.message || 'The server is starting up. Please wait a moment and try again.',
        isRetryable: data?.isRetryable ?? true,
        isNetworkError: false,
        isServerError: true,
        isTimeout: false,
        statusCode: status,
      };
    }

    // Gateway timeout (504)
    if (status === 504) {
      return {
        message: data?.error || 'Gateway timeout',
        userMessage: 'The request is taking too long. Please try again or use filters to reduce data.',
        isRetryable: true,
        isNetworkError: false,
        isServerError: true,
        isTimeout: true,
        statusCode: status,
      };
    }

    // Other server errors (500, 502)
    if (status >= 500) {
      return {
        message: data?.error || 'Server error',
        userMessage: data?.message || 'Something went wrong on our end. Please try again later.',
        isRetryable: data?.isRetryable ?? true,
        isNetworkError: false,
        isServerError: true,
        isTimeout: false,
        statusCode: status,
      };
    }

    // Client errors (4xx) - generally not retryable
    return {
      message: data?.error || error.message,
      userMessage: data?.message || data?.error || 'An error occurred. Please try again.',
      isRetryable: false,
      isNetworkError: false,
      isServerError: false,
      isTimeout: false,
      statusCode: status,
    };
  }

  // Unknown error
  return {
    message: error.message || 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again.',
    isRetryable: true,
    isNetworkError: false,
    isServerError: false,
    isTimeout: false,
  };
};

// =========================== RETRY LOGIC ===========================
interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  useExponentialBackoff?: boolean; // Default true, set false for fixed delays
  retryCondition?: (error: any) => boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  useExponentialBackoff: true,
  retryCondition: (error: any) => {
    const parsedError = parseApiError(error);
    return parsedError.isRetryable && (parsedError.isNetworkError || parsedError.isServerError || parsedError.isTimeout);
  },
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper with optional exponential backoff
export const withRetry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    useExponentialBackoff = true,
    retryCondition = defaultRetryConfig.retryCondition
  } = config;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt < maxRetries && retryCondition?.(error)) {
        // Use fixed delay or exponential backoff based on config
        const delay = useExponentialBackoff
          ? retryDelay * Math.pow(2, attempt)
          : retryDelay;
        console.warn(`API request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
};


const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout - allows for database recovery after bulk uploads
});

// =========================== SERVER WAKE-UP ===========================
let isWakingUp = false;
let wakeUpPromise: Promise<boolean> | null = null;

// Wake up the server (call this on app load or before critical operations)
// Render free instances can take 30-60 seconds to cold start
export const wakeUpServer = async (): Promise<boolean> => {
  // If already waking up, return the existing promise
  if (isWakingUp && wakeUpPromise) {
    return wakeUpPromise;
  }

  isWakingUp = true;

  wakeUpPromise = (async () => {
    const maxAttempts = 12; // Try for up to 60 seconds (12 attempts * 5 seconds)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Try health check with longer timeout
        const healthResponse = await axios.get(`${API_URL}/health`, { timeout: 15000 });

        if (healthResponse.data?.status === 'OK' || healthResponse.data?.status === 'DEGRADED') {
          console.log('Server is awake and ready');
          return true;
        }

        // Server responded but not ready yet (CONNECTING state)
        console.log(`Server is waking up... (attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error: any) {
        // 503 means server is starting - keep waiting
        if (error.response?.status === 503) {
          console.log(`Server is starting up... (attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Network error or timeout - server might be cold starting
        if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
          console.log(`Waiting for server to start... (attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Other errors - might still work, continue trying
        console.warn('Server wake-up check failed:', error.message);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.warn('Server wake-up timed out');
    return false;
  })();

  try {
    return await wakeUpPromise;
  } finally {
    isWakingUp = false;
    wakeUpPromise = null;
  }
};

// Check server health
export const checkServerHealth = async (): Promise<{
  status: 'OK' | 'DEGRADED' | 'CONNECTING' | 'ERROR' | 'OFFLINE';
  database?: { ready: boolean; healthy: boolean; latencyMs?: number };
  uptime?: number;
}> => {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 10000 });
    return response.data;
  } catch (error: any) {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      return { status: 'OFFLINE' };
    }
    return { status: 'ERROR' };
  }
};

// =====================Auth API====================
export const authAPI = {
  login: (username: string, password: string) => api.post('auth/login', { username, password }),
  register: (data: any) => api.post('auth/register', data),
};

// Request interceptor - add token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor - handle errors with user-friendly messages
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const parsedError = parseApiError(error);

    // Handle 401 - authentication errors
    if (error.response?.status === 401) {
      const msg = ((error.response?.data as any)?.error || "").toLowerCase();
      // Logout ONLY when token expired or invalid - but NOT on login page
      // Skip redirect if already on login page (login failures shouldn't redirect)
      const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
      if (
        !isOnLoginPage &&
        (msg.includes("token") ||
          msg.includes("expired") ||
          msg.includes("unauthorized"))
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    // Attach parsed error details for easy access
    (error as any).parsedError = parsedError;

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
  // Phase 3: Upload history & duplicate details
  getUploadHistory: (page = 1, limit = 20, filters?: { status?: string; search?: string; dateFrom?: string; dateTo?: string }) =>
    api.get('master-data/upload/history', {
      params: { page, limit, status: filters?.status, search: filters?.search, dateFrom: filters?.dateFrom, dateTo: filters?.dateTo }
    }),
  getUploadDuplicates: (jobId: string) => api.get(`master-data/upload/duplicates/${jobId}`),
  // Phase 5: Advanced features
  restoreBatch: (batchId: string) => api.post(`master-data/batch/${batchId}/restore`),
  getSnapshots: (page = 1, limit = 20, filters?: { batchId?: string; includeRestored?: boolean }) =>
    api.get('master-data/snapshots', {
      params: { page, limit, batchId: filters?.batchId, includeRestored: filters?.includeRestored }
    }),
  getDeletedRecords: (page = 1, limit = 50, filters?: { search?: string; batchId?: string }) =>
    api.get('master-data/deleted', {
      params: { page, limit, search: filters?.search, batchId: filters?.batchId }
    }),
  purgeDeletedRecord: (id: number) => api.delete(`master-data/deleted/purge/${id}`),
  cleanupStaleData: () => api.delete('master-data/cleanup/stale'),
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
        // Send batch IDs as comma-separated string for reliable parsing
        batchId: Array.isArray(filters?.batchId) ? filters.batchId.join(',') : filters?.batchId
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
    api.delete(`/customers/${id}`),
  // Lookup pincode for city/state auto-fill
  lookupPincode: (pincode: string) =>
    api.get(`/customers/pincode/${pincode}`),
  // Lookup GST number for company details auto-fill
  lookupGST: (gstin: string) =>
    api.get(`/customers/gst/${gstin}`)
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
    customer?: string;
    startDate?: string;
    endDate?: string;
    batchId?: string | string[];
  }) =>
    api.get('/picking/list', { params }),
  // Get customers from picking table (unique customers who have picking entries)
  getPickingCustomers: (warehouseId: number) =>
    api.get('/picking/customers', { params: { warehouseId } }),
  // Get all customers for Multi Picking entry (from customers table)
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

  // Export all available inventory data (pivot export all)
  getPivotExportAll: (params: { warehouseId: number; brand?: string; category?: string }) =>
    api.get('/dashboard/pivot-export-all', { params }),
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

// ================= Rejections API =======================
export const rejectionsAPI = {
  // Get rejections list with filters
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    rejection_type?: string;
    rejected_by_person?: string;
    batch_id?: string;
    source_batch_id?: string;
    warehouse_id?: number;
    cn_status?: 'pending' | 'received' | 'all';
  }) => api.get('/rejections', { params }),

  // Get summary for credit note tracking
  getSummary: (warehouse_id?: number) =>
    api.get('/rejections/summary', { params: { warehouse_id } }),

  // Get unique persons for filter dropdown
  getPersons: (warehouse_id?: number) =>
    api.get('/rejections/persons', { params: { warehouse_id } }),

  // Get upload batches for filter dropdown
  getBatches: (warehouse_id?: number) =>
    api.get('/rejections/batches', { params: { warehouse_id } }),

  // Download template
  downloadTemplate: () =>
    api.get('/rejections/template', { responseType: 'blob' }),

  // Upload rejection Excel
  uploadRejections: (formData: FormData) =>
    api.post('/rejections/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Update credit note info
  updateCreditNote: (data: {
    batch_id?: string;
    rejection_ids?: number[];
    credit_note_no: string;
    credit_note_date?: string;
    credit_note_amount?: number;
  }) => api.put('/rejections/credit-note', data),

  // Export to Excel
  exportRejections: (params?: {
    batch_id?: string;
    warehouse_id?: number;
    cn_status?: string;
  }) => api.get('/rejections/export', { params, responseType: 'blob' }),

  // Delete single rejection
  delete: (id: number) => api.delete(`/rejections/${id}`),

  // Delete batch
  deleteBatch: (batchId: string) => api.delete(`/rejections/batch/${batchId}`),

  // Rename batch
  renameBatch: (batchId: string, newBatchId: string) =>
    api.put(`/rejections/batch/${batchId}/rename`, { newBatchId }),
};

// ============================ LIVE VIEW API ============================
export const liveViewAPI = {
  // Start a live entry session
  startSession: (warehouse_id: number, page_type: string) =>
    api.post('/live-view/start', { warehouse_id, page_type }),

  // Update entries in current session
  updateEntries: (session_id: string, entries: any[]) =>
    api.post('/live-view/update', { session_id, entries }),

  // End a live session
  endSession: (session_id: string) =>
    api.post('/live-view/end', { session_id }),

  // Get active sessions for a warehouse/page
  getActiveSessions: (warehouse_id: number, page_type: string) =>
    api.get('/live-view/sessions', { params: { warehouse_id, page_type } }),

  // Get entries for a specific session
  getEntries: (session_id: string) =>
    api.get(`/live-view/entries/${session_id}`),

  // Export entries for a session
  exportEntries: (session_id: string) =>
    api.get(`/live-view/export/${session_id}`),

  // Cleanup stale sessions (admin)
  cleanup: () =>
    api.post('/live-view/cleanup'),
};

// ============================ CACHE API ============================
export const cacheAPI = {
  // Get pending inventory for Inbound (master_data not yet received, not rejected)
  getPending: (warehouseId: number) =>
    api.get('/cache/pending', { params: { warehouseId } }),

  // Get available inventory for QC/Picking/Outbound
  getAvailable: (warehouseId: number) =>
    api.get('/cache/available', { params: { warehouseId } }),

  // Get cache statistics
  getStats: (warehouseId: number) =>
    api.get('/cache/stats', { params: { warehouseId } }),
};


export default api;