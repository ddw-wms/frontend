// File Path = warehouse-frontend/lib/nl-api.ts
// NL (Non-Large Inventory) Module API definitions
import api from './api';

// ============================ NL FKT OS API ============================
export const nlFktOsAPI = {
    // Upload OS Excel
    upload: (formData: FormData) =>
        api.post('nl/fkt-os/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    // List OS data with filters
    list: (params?: {
        warehouse_id?: number;
        category?: string;
        lot_type?: string;
        region?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/fkt-os', { params }),

    // Lookup single VRP ID
    getByVrpId: (vrpId: string, warehouseId?: number) =>
        api.get(`nl/fkt-os/vrp/${vrpId}`, { params: { warehouse_id: warehouseId } }),

    // Batch management
    getBatches: (warehouseId?: number) =>
        api.get('nl/fkt-os/batches', { params: { warehouse_id: warehouseId } }),

    deleteBatch: (batchId: string) =>
        api.delete(`nl/fkt-os/batches/${batchId}`),
};

// ============================ NL MASTER DATA API ============================
export const nlMasterDataAPI = {
    // Upload master data Excel (RA or RVP)
    upload: (formData: FormData) =>
        api.post('nl/master-data/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    // List master data with filters
    list: (params?: {
        lot_type?: string;
        category?: string;
        brand?: string;
        search?: string;
        page?: number;
        limit?: number;
    }, signal?: AbortSignal) => api.get('nl/master-data', { params, signal }),

    // Lookup WSN (for QC RVP scan)
    lookupWSN: (wsn: string) =>
        api.get('nl/master-data/lookup-wsn', { params: { wsn } }),

    // Lookup WID (for QC RA entry)
    lookupWID: (wid: string) =>
        api.get('nl/master-data/lookup-wid', { params: { wid } }),

    // Batch management
    getBatches: (lotType?: string) =>
        api.get('nl/master-data/batches', { params: { lot_type: lotType } }),

    deleteBatch: (batchId: string) =>
        api.delete(`nl/master-data/batches/${batchId}`),
};

// ============================ NL INBOUND API ============================
export const nlInboundAPI = {
    // Create new inbound session (draft)
    createSession: (data: { warehouse_id: number; vehicle_no: string; inbound_date: string }) =>
        api.post('nl/inbound/sessions', data),

    // Get current draft session
    getDraftSession: (warehouseId: number) =>
        api.get('nl/inbound/sessions/draft', { params: { warehouse_id: warehouseId } }),

    // List submitted sessions
    listSessions: (params?: {
        warehouse_id?: number;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/inbound/sessions', { params }),

    // Scan a box into the session
    scanBox: (sessionId: string, data: {
        warehouse_id: number;
        box_id: string;
        vrp_id?: string;
        actual_qty: number;
        declared_qty?: number;
        category?: string;
        region?: string;
        lot_type?: string;
        route?: string;
        remarks?: string;
    }) => api.post(`nl/inbound/sessions/${sessionId}/boxes`, data),

    // Delete a box from the session
    deleteBox: (sessionId: string, boxId: string) =>
        api.delete(`nl/inbound/sessions/${sessionId}/boxes/${boxId}`),

    // Submit session
    submitSession: (sessionId: string, data: { warehouse_id: number }) =>
        api.post(`nl/inbound/sessions/${sessionId}/submit`, data),

    // Update box (edit saved row)
    updateBox: (sessionId: string, boxId: string, data: { actual_qty?: number; route?: string; remarks?: string }) =>
        api.patch(`nl/inbound/sessions/${sessionId}/boxes/${boxId}`, data),

    // Batch management
    getBatches: (warehouseId?: number) =>
        api.get('nl/inbound/batches', { params: { warehouse_id: warehouseId } }),

    deleteBatch: (batchId: string) =>
        api.delete(`nl/inbound/batches/${batchId}`),

    // Multi-entry (batch submit without session)
    multiEntry: (data: {
        entries: Array<{
            box_id: string;
            vrp_id: string;
            actual_qty?: number;
            route?: string;
            remarks?: string;
        }>;
        warehouse_id: number;
        vehicle_no?: string;
        inbound_date?: string;
    }) => api.post('nl/inbound/multi-entry', data),

    // List boxes (box-level detail for Inbound List)
    listBoxes: (params?: {
        warehouse_id?: number;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/inbound/boxes', { params }),
};

// ============================ NL STACKING API ============================
export const nlStackingAPI = {
    // Lookup box from inbound for stacking grid
    lookupBox: (boxId: string, warehouseId?: number) =>
        api.get('nl/stacking/lookup-box', { params: { box_id: boxId, warehouse_id: warehouseId } }),

    // Multi entry (batch submit — no session needed)
    multiEntry: (data: {
        entries: Array<{ box_id: string; rack_no: string; remarks?: string }>;
        warehouse_id: number;
        stacking_date?: string;
    }) => api.post('nl/stacking/multi-entry', data),

    // List stacking entries (box-level with pagination)
    listEntries: (params?: {
        warehouse_id?: number;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/stacking/entries', { params }),

    // Batches (submitted sessions)
    getBatches: (warehouseId?: number) =>
        api.get('nl/stacking/batches', { params: { warehouse_id: warehouseId } }),

    deleteBatch: (batchId: string) =>
        api.delete(`nl/stacking/batches/${batchId}`),

    // Legacy session endpoints (kept for compatibility)
    createSession: (data: { warehouse_id: number; rack_id?: number }) =>
        api.post('nl/stacking/sessions', data),

    getDraftSession: (warehouseId: number) =>
        api.get('nl/stacking/sessions/draft', { params: { warehouse_id: warehouseId } }),

    listSessions: (params?: {
        warehouse_id?: number;
        page?: number;
        limit?: number;
    }) => api.get('nl/stacking/sessions', { params }),

    scanBox: (sessionId: string, data: {
        warehouse_id: number;
        box_id: string;
        rack_id?: number;
    }) => api.post(`nl/stacking/sessions/${sessionId}/boxes`, data),

    submitSession: (sessionId: string, data: { warehouse_id: number }) =>
        api.post(`nl/stacking/sessions/${sessionId}/submit`, data),
};

// ============================ NL QC API ============================
export const nlQcAPI = {
    // ====== NEW MULTI-ENTRY ENDPOINTS ======
    lookupBox: (boxId: string, warehouseId?: number) =>
        api.get('nl/qc/lookup-box', { params: { box_id: boxId, warehouse_id: warehouseId } }),

    multiEntry: (data: { entries: any[]; warehouse_id: number; qc_date: string }) =>
        api.post('nl/qc/multi-entry', data),

    submitBox: (data: { box_id: string; warehouse_id: number; qc_date: string; items: any[] }) =>
        api.post('nl/qc/submit-box', data),

    listEntries: (params?: {
        warehouse_id?: number; search?: string;
        dateFrom?: string; dateTo?: string;
        page?: number; limit?: number;
    }) => api.get('nl/qc/entries', { params }),

    getBatches: (warehouseId: number) =>
        api.get('nl/qc/batches', { params: { warehouse_id: warehouseId } }),

    deleteBatch: (batchId: string) =>
        api.delete(`nl/qc/batches/${batchId}`),

    // ====== LEGACY SESSION ENDPOINTS ======
    // Create new QC session (draft)
    createSession: (data: { warehouse_id: number }) =>
        api.post('nl/qc/sessions', data),

    // Get current draft session
    getDraftSession: (warehouseId: number) =>
        api.get('nl/qc/sessions/draft', { params: { warehouse_id: warehouseId } }),

    // List submitted sessions
    listSessions: (params?: {
        warehouse_id?: number;
        page?: number;
        limit?: number;
    }) => api.get('nl/qc/sessions', { params }),

    // Load box into QC session
    loadBox: (sessionId: string, data: {
        warehouse_id: number;
        box_id: string;
    }) => api.post(`nl/qc/sessions/${sessionId}/load-box`, data),

    // Scan item for QC
    scanItem: (sessionId: string, data: {
        warehouse_id: number;
        box_id: string;
        identifier: string;
        identifier_type: 'wid' | 'wsn';
        grade: 'A' | 'B' | 'C' | 'D';
        remarks?: string;
    }) => api.post(`nl/qc/sessions/${sessionId}/items`, data),

    // Submit session
    submitSession: (sessionId: string, data: { warehouse_id: number }) =>
        api.post(`nl/qc/sessions/${sessionId}/submit`, data),
};

// ============================ NL DISPATCH API ============================
export const nlDispatchAPI = {
    // Create new dispatch session (draft)
    createSession: (data: {
        warehouse_id: number;
        customer_id: number;
        dispatch_mode: 'direct_box' | 'order_level' | 'mixed_items';
    }) => api.post('nl/dispatch/sessions', data),

    // Get current draft session
    getDraftSession: (warehouseId: number) =>
        api.get('nl/dispatch/sessions/draft', { params: { warehouse_id: warehouseId } }),

    // List submitted sessions
    listSessions: (params?: {
        warehouse_id?: number;
        customer_id?: number;
        status?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/dispatch/sessions', { params }),

    // Scan box for dispatch
    scanBox: (sessionId: string, data: {
        warehouse_id: number;
        box_id: string;
        dispatch_price?: number;
    }) => api.post(`nl/dispatch/sessions/${sessionId}/boxes`, data),

    // Scan item for mixed dispatch
    scanItem: (sessionId: string, data: {
        warehouse_id: number;
        box_id: string;
        identifier: string;
        identifier_type: 'wid' | 'wsn';
        dispatch_price?: number;
    }) => api.post(`nl/dispatch/sessions/${sessionId}/items`, data),

    // Submit session
    submitSession: (sessionId: string, data: { warehouse_id: number }) =>
        api.post(`nl/dispatch/sessions/${sessionId}/submit`, data),

    // Delete entry from draft session
    deleteEntry: (sessionId: string, entryId: string) =>
        api.delete(`nl/dispatch/sessions/${sessionId}/entries/${entryId}`),

    // Discard (cancel) draft session
    discardSession: (sessionId: string) =>
        api.delete(`nl/dispatch/sessions/${sessionId}`),
};

// ============================ NL SUMMARY API ============================
export const nlSummaryAPI = {
    // Get summary data + KPIs
    getSummary: (params?: {
        warehouse_id?: number;
        dateFrom?: string;
        dateTo?: string;
    }) => api.get('nl/summary', { params }),

    // Export summary to Excel (returns blob)
    exportExcel: (params?: {
        warehouse_id?: number;
    }) => api.get('nl/summary/export', {
        params,
        responseType: 'blob',
    }),
};

// ============================ NL BILLING API ============================
export const nlBillingAPI = {
    // Upload proforma invoice Excel
    uploadProforma: (formData: FormData) =>
        api.post('nl/billing/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    // List financials
    list: (params?: {
        warehouse_id?: number;
        search?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/billing', { params }),

    // Update financial entry
    update: (id: string, data: {
        selling_price?: number;
        cost_price?: number;
        invoice_no?: string;
        invoice_date?: string;
        invoice_amount?: number;
        remarks?: string;
    }) => api.patch(`nl/billing/${id}`, data),

    // P&L summary
    getPLSummary: (params?: {
        warehouse_id?: number;
    }) => api.get('nl/billing/pl-summary', { params }),
};

// ============================ NL DISCREPANCY API ============================
export const nlDiscrepancyAPI = {
    // List discrepancies
    list: (params?: {
        warehouse_id?: number;
        status?: string;
        discrepancy_type?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/discrepancy', { params }),

    // Get stats / KPIs
    getStats: (params?: {
        warehouse_id?: number;
    }) => api.get('nl/discrepancy/stats', { params }),

    // Create manual discrepancy
    create: (data: {
        warehouse_id: number;
        box_id?: string;
        vrp_id?: string;
        discrepancy_type: string;
        expected_value?: string;
        actual_value?: string;
        notes?: string;
    }) => api.post('nl/discrepancy', data),

    // Resolve discrepancy
    resolve: (id: string, data: {
        resolution: string;
        notes?: string;
    }) => api.patch(`nl/discrepancy/${id}/resolve`, data),

    // Escalate discrepancy
    escalate: (id: string, data?: {
        notes?: string;
    }) => api.patch(`nl/discrepancy/${id}/escalate`, data),
};

// ============================ NL PICKLIST API ============================
export const nlPicklistAPI = {
    // Create picklist with items
    create: (data: {
        warehouse_id: number;
        customer_id?: number;
        remarks?: string;
        items: { vrp_id: string; required_qty: number }[];
    }) => api.post('nl/picklist', data),

    // List picklists
    list: (params?: {
        warehouse_id?: number;
        status?: string;
        page?: number;
        limit?: number;
    }) => api.get('nl/picklist', { params }),

    // Get single picklist with items
    get: (id: string) => api.get(`nl/picklist/${id}`),

    // Get available boxes for picklist (pick guide)
    getAvailableBoxes: (id: string) => api.get(`nl/picklist/${id}/available-boxes`),

    // Add item to picklist
    addItem: (id: string, data: { vrp_id: string; required_qty: number }) =>
        api.post(`nl/picklist/${id}/items`, data),

    // Update item qty
    updateItem: (id: string, itemId: string, data: { required_qty: number }) =>
        api.patch(`nl/picklist/${id}/items/${itemId}`, data),

    // Delete item from picklist
    deleteItem: (id: string, itemId: string) =>
        api.delete(`nl/picklist/${id}/items/${itemId}`),

    // Cancel picklist
    cancel: (id: string) => api.delete(`nl/picklist/${id}`),
};

// ============================ NL PICKING API ============================
export const nlPickingAPI = {
    // Create picking session
    createSession: (data: { warehouse_id: number; picklist_id: string }) =>
        api.post('nl/picking/sessions', data),

    // Get draft session
    getDraftSession: (warehouseId: number) =>
        api.get('nl/picking/sessions/draft', { params: { warehouse_id: warehouseId } }),

    // List submitted sessions
    listSessions: (params?: { warehouse_id?: number; page?: number; limit?: number }) =>
        api.get('nl/picking/sessions', { params }),

    // Scan box
    scanBox: (sessionId: string, data: { box_id: string; warehouse_id: number }) =>
        api.post(`nl/picking/sessions/${sessionId}/scan`, data),

    // Delete entry
    deleteEntry: (sessionId: string, entryId: string) =>
        api.delete(`nl/picking/sessions/${sessionId}/entries/${entryId}`),

    // Submit session
    submitSession: (sessionId: string, data: { warehouse_id: number }) =>
        api.post(`nl/picking/sessions/${sessionId}/submit`, data),

    // Discard session
    discardSession: (sessionId: string) =>
        api.delete(`nl/picking/sessions/${sessionId}`),
};
