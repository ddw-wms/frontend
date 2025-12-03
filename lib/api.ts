import axios, { AxiosInstance } from 'axios';

let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Ensure trailing slash
API_URL = API_URL.endsWith('/') ? API_URL : API_URL + '/';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authAPI = {
  login: (username: string, password: string) => api.post('auth/login', { username, password }),
  register: (data: any) => api.post('auth/register', data),
};
console.log("DEPLOYED API BASEURL:", API_URL);

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

  // Otherwise DO NOT LOGOUT
  }
    return Promise.reject(error);
  }
);

// Warehouses API
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
};

// Master Data API
export const masterDataAPI = {
  getAll: (page = 1, limit = 100, search = '') =>
    api.get(`master-data?page=${page}&limit=${limit}&search=${search}`),
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

};

// Inbound API
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
  
  getAll: (page: number, limit: number, filters?: any) => 
    api.get('inbound', { 
      params: { 
        page, 
        limit, 
        warehouseId: filters?.warehouseId,
        search: filters?.search,
        brand: filters?.brand,
        category: filters?.category,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        batchId: filters?.batchId
      } 
    }),
};

// Racks API
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

// QC API
export const qcAPI = {
  createSingleQC: (data: any) => api.post('qc/single', data),
  multiQCEntry: (data: any) => api.post('qc/multi', data),
  bulkQCUpload: (formData: FormData) => api.post('qc/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getQCList: (params: any) => api.get('qc/list', { params }),
  getQCBatches: (warehouseId: number) => api.get('qc/batches', { params: { warehouseId } }),
  deleteQCBatch: (batchId: string) => api.delete(`qc/batch/${batchId}`),
  getInboundByWSN: (wsn: string, warehouseId: number) => api.get(`qc/inbound/${wsn}`, { params: { warehouse_id: warehouseId } }),
  getBrands: (warehouseId?: number) => api.get('qc/brands', { params: { warehouse_id: warehouseId } }),
  getCategories: (warehouseId?: number) => api.get('qc/categories', { params: { warehouse_id: warehouseId } }),
  //getExistingWSNs: (warehouseId: number) => api.get('qc/existing-wsns', { params: { warehouse_id: warehouseId } }),
  checkWSNExists: (wsn: string, warehouseId: number) => 
    api.get(`qc/check-wsn`, { params: { wsn, warehouse_id: warehouseId } }),
  
  updateSingleQC: (qcId: number, data: any) => 
    api.put(`qc/${qcId}`, data),
  
  getExistingWSNs: (warehouseId: number) => 
    api.get(`qc/existing-wsns`, { params: { warehouse_id: warehouseId } })
};



// ====== CUSTOMER API ======
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

// ====== OUTBOUND API ===========================
export const outboundAPI = {
  // Get source data by WSN (PICKING → QC → INBOUND)
  getSourceByWSN: (wsn: string, warehouseId: number) =>
    api.get('/outbound/source-by-wsn', { params: { wsn, warehouseId } }),

  // Multi entry with auto batch ID
  multiEntry: (data: { entries: any[]; warehouse_id: number }) =>
    api.post('/outbound/multi', data),

  // Bulk upload with Excel file
  bulkUpload: (formData: FormData) =>
    api.post('/outbound/bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // Get outbound list with filters
  getList: (params: {
    page?: number;
    limit?: number;
    warehouseId?: number;
    search?: string;
    source?: string;
    customer?: string;
    startDate?: string;
    endDate?: string;
    batchId?: string;
  }) => api.get('/outbound/list', { params }),

  // Get customers list for dropdown (using customer API)
  getCustomers: (warehouseId: number) =>
    customerAPI.getNames(warehouseId),


  // Get existing WSNs for duplicate check
  getExistingWSNs: (warehouseId: number) =>
    api.get('/outbound/existing-wsns', { params: { warehouseId } }),

  // Get batches for batch management
  getBatches: (warehouseId: string) =>
    api.get('/outbound/batches', { params: { warehouseId } }),

  // Delete batch
  deleteBatch: (batchId: string) =>
    api.delete(`/outbound/batch/${batchId}`)
};





// ===PICKING API ==============================================
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


// ====== DASHBOARD API ======
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



export default api;
