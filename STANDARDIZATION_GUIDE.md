# UI/UX Standardization Implementation Guide

## Overview
This guide provides step-by-step instructions to standardize UI across all pages in the WMS application based on user feedback and screenshots.

## Issues to Fix (From User Screenshots)

### 1. Grid Header Text Not Visible
**Issue**: AG Grid headers on QC, Picking, Outbound list tabs showing no text
**Solution**: Enhanced CSS with `!important` flags for header colors
**Status**: ✅ FIXED in globals.css

### 2. Export Dialog Inconsistency
**Issue**: QC and Outbound export dialogs have different UI compared to Dashboard/Inbound
**Solution**: Use standardized `ExportDialog` component across all pages
**Status**: 🔄 IN PROGRESS

### 3. Column Settings Dialog Different
**Issue**: Dashboard, Inbound, QC, Picking have different column settings compared to Outbound
**Solution**: Use standardized `ColumnSettingsDialog` component
**Status**: 🔄 IN PROGRESS

### 4. Missing Loading Animation on QC Grid
**Issue**: QC list tab doesn't show animation when searching/filtering
**Solution**: Already has `topLoading` animation - verify it's working
**Status**: ✅ VERIFIED (lines 2294-2296 in qc/page.tsx)

### 5. Mobile Action Button Dialog Inconsistency
**Issue**: Dashboard, Inbound, Picking, Outbound mobile dialogs should match QC page
**Solution**: Use new `MobileActionDialog` component
**Status**: ✅ COMPONENT CREATED

### 6. Page Header Sections Not Similar
**Issue**: All pages should have consistent header size/style on mobile and desktop
**Solution**: Use new `StandardPageHeader` component
**Status**: ✅ COMPONENT CREATED

---

## New Components Created

### 1. MobileActionDialog
**File**: `components/MobileActionDialog.tsx`
**Purpose**: Standardized mobile action menu dialog
**Usage**:
```tsx
import { MobileActionDialog, type MobileAction } from '@/components';

const actions: MobileAction[] = [
  {
    icon: <AddIcon />,
    label: 'Add New',
    onClick: () => console.log('Add clicked'),
    color: 'primary'
  },
  {
    icon: <DownloadIcon />,
    label: 'Export',
    onClick: () => setExportDialogOpen(true),
    color: 'success'
  }
];

<MobileActionDialog
  open={mobileActionsOpen}
  onClose={() => setMobileActionsOpen(false)}
  title="Actions"
  actions={actions}
/>
```

### 2. StandardPageHeader
**File**: `components/StandardPageHeader.tsx`
**Purpose**: Consistent page headers with breadcrumbs
**Usage**:
```tsx
import { StandardPageHeader } from '@/components';

<StandardPageHeader
  title="Quality Control"
  breadcrumbs={[
    { label: 'Home', href: '/dashboard' },
    { label: 'QC' }
  ]}
  actions={
    <>
      <Button>Action 1</Button>
      <Button>Action 2</Button>
    </>
  }
/>
```

### 3. ExportDialog (Already Created)
**File**: `components/ExportDialog.tsx`
**Usage**:
```tsx
import { ExportDialog } from '@/components';

<ExportDialog
  open={exportDialogOpen}
  onClose={() => setExportDialogOpen(false)}
  onExport={(type, format) => handleExport(type, format)}
  counts={{
    current: filteredData.length,
    filtered: filteredData.length,
    all: allData.length
  }}
  loading={exportLoading}
/>
```

### 4. ColumnSettingsDialog (Already Created)
**File**: `components/ColumnSettingsDialog.tsx`
**Usage**:
```tsx
import { ColumnSettingsDialog } from '@/components';

<ColumnSettingsDialog
  open={columnDialogOpen}
  onClose={() => setColumnDialogOpen(false)}
  columns={columns}
  onColumnsChange={setColumns}
  storageKey="qc_list_columns"
/>
```

---

## Implementation Steps by Page

### Dashboard Page (app/dashboard/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [ ] Replace mobile action buttons with `MobileActionDialog`
- [ ] Use `ExportDialog` (if not already)
- [ ] Use `ColumnSettingsDialog` (if not already)

### Inbound Page (app/inbound/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [ ] Replace mobile action buttons with `MobileActionDialog`
- [ ] Use `ExportDialog` (if not already)
- [ ] Use `ColumnSettingsDialog` (if not already)

### QC Page (app/qc/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [x] Loading animation already present (verified)
- [ ] Replace custom export dialog with `ExportDialog`
- [ ] Replace custom column settings with `ColumnSettingsDialog`
- [x] Mobile action dialog already good - can be reference for others

### Picking Page (app/picking/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [ ] Replace mobile action buttons with `MobileActionDialog`
- [ ] Use `ExportDialog` (if not already)
- [ ] Replace custom column settings with `ColumnSettingsDialog`

### Outbound Page (app/outbound/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [ ] Replace mobile action buttons with `MobileActionDialog`
- [ ] Replace custom export dialog with `ExportDialog`
- [ ] Column settings already good - can be reference for others

### Customers Page (app/customers/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [ ] Use standard components if applicable

### Reports Page (app/reports/page.tsx)
**Changes Needed**:
- [ ] Replace custom header with `StandardPageHeader`
- [ ] Use standard components if applicable

---

## CSS Changes

### globals.css - AG Grid Headers
**File**: `app/globals.css`
**Status**: ✅ FIXED
**Changes Applied**:
```css
.ag-theme-quartz {
  --ag-header-foreground-color: #fff !important;
  --ag-header-background-color: #1976d2 !important;
}

.ag-theme-quartz .ag-header {
  background-color: #1976d2 !important;
}

.ag-theme-quartz .ag-header-cell {
  background-color: #1976d2 !important;
  color: #fff !important;
}

.ag-theme-quartz .ag-header-cell-label {
  font-weight: 600 !important;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: #fff !important;
}

.ag-theme-quartz .ag-header-cell-text {
  color: #fff !important;
}
```

---

## Testing Checklist

After implementing changes, test the following on each page:

### Desktop Testing
- [ ] Grid headers show white text on blue background
- [ ] Export dialog has consistent green header with "Export Data" title
- [ ] Column settings dialog has consistent blue header with "Column Settings" title
- [ ] Page header has consistent size and spacing
- [ ] All buttons have consistent styling
- [ ] Loading animations appear during data fetch

### Mobile Testing (< 600px)
- [ ] Page header scales appropriately
- [ ] Mobile action button opens standardized dialog
- [ ] Export dialog is full-screen on mobile
- [ ] Column settings dialog is full-screen on mobile
- [ ] Grid is responsive and scrollable
- [ ] Buttons stack vertically when needed

### Tablet Testing (600px - 900px)
- [ ] Page layout adapts smoothly
- [ ] Dialogs scale appropriately
- [ ] Grid maintains readability

---

## Priority Order

1. **HIGH**: Fix grid headers (✅ DONE)
2. **HIGH**: Standardize export dialogs across all pages
3. **HIGH**: Standardize column settings dialogs
4. **MEDIUM**: Replace page headers with StandardPageHeader
5. **MEDIUM**: Standardize mobile action dialogs
6. **LOW**: Verify loading animations on all pages

---

## Common Patterns

### Pattern 1: Replace Custom Export Dialog
**Before**:
```tsx
<Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
  <DialogTitle>Export</DialogTitle>
  <DialogContent>
    {/* custom export UI */}
  </DialogContent>
</Dialog>
```

**After**:
```tsx
import { ExportDialog } from '@/components';

<ExportDialog
  open={exportOpen}
  onClose={() => setExportOpen(false)}
  onExport={handleExport}
  counts={{ current: data.length, filtered: filteredData.length, all: totalCount }}
  loading={exporting}
/>
```

### Pattern 2: Replace Custom Column Settings
**Before**:
```tsx
<Dialog open={columnOpen}>
  {/* custom checkboxes */}
</Dialog>
```

**After**:
```tsx
import { ColumnSettingsDialog } from '@/components';

<ColumnSettingsDialog
  open={columnOpen}
  onClose={() => setColumnOpen(false)}
  columns={columns}
  onColumnsChange={setColumns}
  storageKey="page_columns"
/>
```

### Pattern 3: Replace Mobile Action Buttons
**Before**:
```tsx
<Dialog open={mobileOpen}>
  <List>
    <ListItem button onClick={action1}>Action 1</ListItem>
    <ListItem button onClick={action2}>Action 2</ListItem>
  </List>
</Dialog>
```

**After**:
```tsx
import { MobileActionDialog, type MobileAction } from '@/components';

const actions: MobileAction[] = [
  { icon: <Icon1 />, label: 'Action 1', onClick: action1, color: 'primary' },
  { icon: <Icon2 />, label: 'Action 2', onClick: action2, color: 'success' }
];

<MobileActionDialog
  open={mobileOpen}
  onClose={() => setMobileOpen(false)}
  actions={actions}
/>
```

---

## Notes

- All components are exported from `components/index.ts` for easy import
- Components use Material-UI theme for consistent styling
- Mobile responsiveness built into all components
- localStorage is used for persisting user preferences
- All dialogs support full-screen on mobile devices
- AG Grid styling is globally applied via globals.css

---

## Support

For issues or questions:
1. Check component source code in `components/` folder
2. Review this guide for usage examples
3. Test on multiple screen sizes before deployment
4. Verify no TypeScript errors before committing

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
