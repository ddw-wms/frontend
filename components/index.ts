// File: components/index.ts
// Central export file for all standard components

// export { StandardPageLayout } from './StandardPageLayout';



export { ExportDialog } from './ExportDialog';


// export { default as AppLayout } from './AppLayout';
// export { default as Sidebar } from './Sidebar';

export { default as StandardPageHeader } from './StandardPageHeader';
// export { default as ActionButtonBar } from './ActionButtonBar';
export { default as StandardTabs } from './StandardTabs';

// Error Boundary for catching runtime errors
export { default as ErrorBoundary } from './ErrorBoundary';

// API Error State - user-friendly error display
export { default as ApiErrorState } from './ApiErrorState';

// Connection Status Banner - shows connection issues
export { default as ConnectionStatusBanner } from './ConnectionStatusBanner';

// Confirmation Dialog (replacement for window.confirm)
export { default as ConfirmDialog } from './ConfirmDialog';

// Bulk Upload component for consistent file uploads
export { default as BulkUploadCard } from './BulkUploadCard';

// Batch Management Tab - standardized across all modules
export { default as BatchManagementTab } from './BatchManagementTab';
export type { BatchData } from './BatchManagementTab';

// Permission-related components
export { default as RouteGuard, withRouteGuard, useRouteAccess } from './RouteGuard';
export {
    PermissionButton,
    PermissionIconButton,
    CreateButton,
    EditButton,
    DeleteButton,
    ExportButton,
    UploadButton,
    CreateIconButton,
    EditIconButton,
    DeleteIconButton,
    PrintIconButton,
    ExportExcelIconButton
} from './PermissionButton';

// export type { FilterField } from './StandardPageLayout';
