// File Path = warehouse-frontend\lib\api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

//const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/api`;


const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor - handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const msg = (error.response?.data?.error || "").toLowerCase();
      // Logout ONLY when token expired or invalid
      if (
        msg.includes("token") ||
        msg.includes("invalid") ||
        msg.includes("expired")
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
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
  upload: (formData: FormData) =>
    api.post('master-data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getUploadProgress: (jobId: string) => api.get(`master-data/upload/progress/${jobId}`),
  cancelUpload: (jobId: string) => api.delete(`master-data/upload/cancel/${jobId}`),
  getBatches: () => api.get('master-data/batches'),
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
  bulkUpload: (formData: FormData) => api.post('inbound/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAllInboundWSNs: () => api.get('inbound/wsns/all'),
  multiEntry: (entries: any[], warehouse_id: number) =>
    api.post('inbound/multi-entry', { entries, warehouse_id }),
  getWarehouseRacks: (warehouseId: number) => api.get(`inbound/racks/${warehouseId}`),
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

  // Bulk upload with Excel file
  bulkUpload: (formData: FormData) =>
    api.post('outbound/bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // Get outbound list with filters (accepts optional axios config, e.g., { signal })
  getList: (page: number, limit: number, params: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    search?: string;
    source?: string;
    customer?: string;
    startDate?: string;
    endDate?: string;
    batchId?: string;
    brand?: string;
    category?: string;
  }, config?: any) => api.get('outbound/list', { params, ...(config || {}) }),

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
    api.delete(`/picking/batch/${batchId}`)
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
    api.get(`/dashboard/export-data?${queryString}`)
};


// ================= Reports API =======================


export default api;