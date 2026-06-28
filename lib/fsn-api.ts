// File Path = wms_frontend/lib/fsn-api.ts
// FSN Level Scanning Module — API client
// All calls go through the shared axios instance (auth header injected automatically)

import api from "./api";

// ============================================================
// CONFIG API  (global settings — no warehouse restriction)
// ============================================================
export const fsnConfigAPI = {
  /** Get all custom inventory type labels stored in DB */
  getInventoryTypes: () => api.get("fsn/config/inventory-types"),

  /** Replace the full list of custom inventory types in DB.
   *  Only pass the CUSTOM types (not the built-in defaults). */
  saveInventoryTypes: (types: string[]) =>
    api.post("fsn/config/inventory-types", { types }),
};

// ============================================================
// MASTER DATA API
// ============================================================
export const fsnMasterAPI = {
  /** Upload Excel / CSV master dump */
  upload: (formData: FormData, onUploadProgress?: (pct: number) => void) =>
    api.post("fsn/master/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 20 * 60 * 1000, // 20 min — allow large file processing
      onUploadProgress: onUploadProgress
        ? (evt: any) => {
            const pct = evt.total
              ? Math.round((evt.loaded * 100) / evt.total)
              : 0;
            onUploadProgress(pct);
          }
        : undefined,
    }),

  /** Poll background upload job progress */
  getUploadProgress: (jobId: string) =>
    api.get(`fsn/master/upload-progress/${encodeURIComponent(jobId)}`),

  /** List master data with optional filters */
  list: (params?: {
    search?: string;
    brand?: string;
    cms_vertical?: string;
    mega_category?: string;
    page?: number;
    limit?: number;
  }) => api.get("fsn/master", { params }),

  /** Get all upload batches */
  getBatches: () => api.get("fsn/master/batches"),

  /** Delete an upload batch */
  deleteBatch: (batchId: string) =>
    api.delete(`fsn/master/batches/${encodeURIComponent(batchId)}`),

  /**
   * Lookup product by any identifier (WID / FSN / EAN / SAP/SKU).
   * Returns: { found: boolean; matched_by: string|null; data: object|null }
   */
  lookup: (q: string, signal?: AbortSignal) =>
    api.get("fsn/master/lookup", { params: { q }, signal }),
};

// ============================================================
// SCANNING SESSION API
// ============================================================
export const fsnScanningAPI = {
  /**
   * Submit a complete scanning session.
   * Backend handles master backfill + conflict detection atomically.
   */
  submitSession: (data: {
    session_date: string;
    customer_name: string;
    warehouse_id?: number;
    rows: Array<{
      lookup_value: string | null;
      lookup_type: string | null;
      master_id: number | null;
      wid: string | null;
      fsn: string | null;
      product_title: string | null;
      brand: string | null;
      cms_vertical: string | null;
      mega_category: string | null;
      ean: string | null;
      sap_sku: string | null;
      mrp: number | null;
      fsp: number | null;
      quantity: number;
      inventory_type: string | null;
      remarks: string | null;
    }>;
  }) => api.post("fsn/sessions", data),

  /** Delete a session and all its rows */
  deleteSession: (sessionId: string) =>
    api.delete(`fsn/sessions/${encodeURIComponent(sessionId)}`),

  /** List submitted sessions with optional filters */
  listSessions: (params?: {
    dateFrom?: string;
    dateTo?: string;
    customer?: string;
    warehouseId?: number;
    wid?: string;
    fsn?: string;
    ean?: string;
    sap_sku?: string;
    inventory_type?: string;
    page?: number;
    limit?: number;
  }) => api.get("fsn/sessions", { params }),

  /** Get all rows for a session (by UUID or human-readable session_id) */
  getSessionRows: (sessionId: string) =>
    api.get(`fsn/sessions/${encodeURIComponent(sessionId)}/rows`),

  /**
   * Flat list of all scanned rows across sessions.
   * Used by the Scanned List page.
   */
  listRows: (params?: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    customer?: string;
    warehouseId?: number;
    wid?: string;
    fsn?: string;
    ean?: string;
    sap_sku?: string;
    inventory_type?: string;
    page?: number;
    limit?: number;
  }) => api.get("fsn/rows", { params }),
};
