// File Path = warehouse-frontend/lib/types.ts
// Centralized TypeScript type definitions for the WMS application

// =================== USER TYPES ===================
export interface User {
    id: number;
    username: string;
    email: string | null;
    full_name: string | null;
    fullName?: string;
    phone: string | null;
    role: UserRole;
    is_active: boolean;
    warehouse_id: number | null;
    last_login: string | null;
    created_at: string;
    permissions?: Record<string, PermissionValue>;
    warehouses?: UserWarehouse[];
    defaultWarehouseId?: number;
}

export type UserRole = 'admin' | 'super_admin' | 'manager' | 'operator' | 'qc' | 'picker';

export interface UserWarehouse {
    warehouse_id: number;
    warehouse_name: string;
    warehouse_code: string;
    is_default: boolean;
}

export interface PermissionValue {
    can_access: boolean;
    is_visible: boolean;
}

// =================== WAREHOUSE TYPES ===================
export interface Warehouse {
    id: number;
    name: string;
    code: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    is_active: boolean;
    created_at: string;
}

// =================== MASTER DATA TYPES ===================
export interface MasterData {
    id: number;
    wsn: string;
    batch_id: string;
    product_title: string;
    brand: string | null;
    cms_vertical: string | null;
    mrp: number;
    fsp: number;
    hsn_code: string | null;
    style_code: string | null;
    size: string | null;
    color: string | null;
    created_at: string;
}

// =================== INBOUND TYPES ===================
export interface InboundItem {
    id: number;
    wsn: string;
    warehouse_id: number;
    warehouse_name?: string;
    inbound_date: string;
    rack_no: string | null;
    created_user_id: number;
    created_user_name: string;
    product_title?: string;
    brand?: string;
    mrp?: number;
    fsp?: number;
}

// =================== QC TYPES ===================
export interface QCItem {
    id: number;
    wsn: string;
    warehouse_id: number;
    qc_date: string;
    qc_status: QCStatus;
    qc_by_id: number;
    qc_by_name: string;
    damage_type: string | null;
    damage_description: string | null;
    product_title?: string;
    brand?: string;
}

export type QCStatus = 'pending' | 'pass' | 'fail' | 'rtv';

// =================== PICKING TYPES ===================
export interface PickingItem {
    id: number;
    wsn: string;
    warehouse_id: number;
    picking_date: string;
    picker_id: number;
    picker_name: string;
    pick_status: PickStatus;
    customer_id: number | null;
    customer_name?: string;
    product_title?: string;
    brand?: string;
}

export type PickStatus = 'pending' | 'picked' | 'packed';

// =================== OUTBOUND TYPES ===================
export interface OutboundItem {
    id: number;
    wsn: string;
    warehouse_id: number;
    dispatch_date: string;
    awb_no: string | null;
    courier_name: string | null;
    customer_id: number;
    customer_name?: string;
    created_user_id: number;
    created_user_name: string;
    product_title?: string;
    brand?: string;
}

// =================== CUSTOMER TYPES ===================
export interface Customer {
    id: number;
    name: string;
    code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gst_no: string | null;
    is_active: boolean;
    created_at: string;
}

// =================== RACK TYPES ===================
export interface Rack {
    id: number;
    name: string;
    warehouse_id: number;
    warehouse_name?: string;
    zone: string | null;
    capacity: number;
    is_active: boolean;
    created_at: string;
}

// =================== BACKUP TYPES ===================
export interface Backup {
    id: number;
    filename: string;
    file_size: number;
    backup_type: 'manual' | 'scheduled';
    storage_location: 'local' | 'cloud';
    status: 'completed' | 'failed' | 'in_progress';
    created_at: string;
    created_by_id: number;
    created_by_name?: string;
}

// =================== API RESPONSE TYPES ===================
export interface ApiResponse<T> {
    data: T;
    message?: string;
    total?: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface ApiError {
    error: string;
    statusCode?: number;
}

// =================== FORM TYPES ===================
export interface UserFormData {
    username: string;
    email: string;
    fullName: string;
    phone: string;
    role: UserRole;
    password: string;
    isActive: boolean;
}

export interface WarehouseFormData {
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
}

export interface RackFormData {
    name: string;
    warehouse_id: number;
    zone: string;
    capacity: number;
}

// =================== FILTER TYPES ===================
export interface DateRange {
    startDate: string | null;
    endDate: string | null;
}

export interface CommonFilters {
    warehouse_id?: number;
    search?: string;
    dateRange?: DateRange;
    page?: number;
    pageSize?: number;
}

// =================== TABLE COLUMN TYPES ===================
export interface TableColumn<T = unknown> {
    field: keyof T | string;
    headerName: string;
    width?: number;
    minWidth?: number;
    flex?: number;
    sortable?: boolean;
    filterable?: boolean;
    renderCell?: (params: { row: T; value: unknown }) => React.ReactNode;
}

// =================== PERMISSION TYPES ===================
export interface Permission {
    code: string;
    name: string;
    description: string | null;
    category: string;
    can_access: boolean;
    is_visible: boolean;
}

export interface RolePermission {
    role_id: number;
    role_name: string;
    permission_code: string;
    can_access: boolean;
    is_visible: boolean;
}
