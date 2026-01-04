# Standard Components Usage Guide

## Overview
All pages should use these standardized components for consistency.

## 1. ColumnSettingsDialog

**Purpose:** Consistent column visibility settings across all pages

### Usage:
```tsx
import { ColumnSettingsDialog } from '@/components';

const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS);

<ColumnSettingsDialog
  open={columnSettingsOpen}
  onClose={() => setColumnSettingsOpen(false)}
  columns={ALL_COLUMNS}
  visibleColumns={visibleColumns}
  onToggleColumn={(col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }}
  onSelectAll={() => {
    setVisibleColumns(
      visibleColumns.length === ALL_COLUMNS.length ? [] : ALL_COLUMNS
    );
  }}
  onReset={() => setVisibleColumns(DEFAULT_COLUMNS)}
  title="Column Settings"
/>
```

### Features:
- ✅ Mobile-responsive (full-screen on mobile)
- ✅ Select all/Deselect all
- ✅ Reset to default
- ✅ Styled header with icon
- ✅ Scrollable column list
- ✅ Checkbox-based selection

---

## 2. ExportDialog

**Purpose:** Consistent export functionality across all pages

### Usage:
```tsx
import { ExportDialog } from '@/components';

const [exportDialogOpen, setExportDialogOpen] = useState(false);

const handleExport = async (options) => {
  const { type, format } = options;
  
  let dataToExport;
  if (type === 'current') dataToExport = currentPageData;
  else if (type === 'filtered') dataToExport = filteredData;
  else dataToExport = allData;

  // Export logic here
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dataToExport);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `export.${format}`);
  
  setExportDialogOpen(false);
  toast.success('Export successful!');
};

<ExportDialog
  open={exportDialogOpen}
  onClose={() => setExportDialogOpen(false)}
  onExport={handleExport}
  title="Export Data"
  currentCount={currentPageData.length}
  filteredCount={filteredData.length}
  totalCount={totalRecords}
/>
```

### Features:
- ✅ Three export scopes (current/filtered/all)
- ✅ Format selection (XLSX/CSV)
- ✅ Loading state
- ✅ Record counts display
- ✅ Professional green header
- ✅ Mobile-responsive

---

## 3. StandardAGGrid

**Purpose:** Consistent AG Grid styling and configuration

### Usage:
```tsx
import { StandardAGGrid } from '@/components';

<StandardAGGrid
  rowData={data}
  columnDefs={columnDefs}
  onGridReady={(params) => setGridApi(params.api)}
  pagination={true}
  paginationPageSize={50}
  height="600px"
  minHeight="400px"
/>
```

### Features:
- ✅ Auto-responsive (smaller on mobile)
- ✅ Consistent theme (ag-theme-quartz)
- ✅ Professional blue headers
- ✅ Pagination configured
- ✅ Hover effects
- ✅ Border styling

---

## 4. StandardActionButtons

**Purpose:** Consistent action button groups

### Usage:
```tsx
import { StandardActionButtons, commonButtons } from '@/components';

<StandardActionButtons
  buttons={[
    commonButtons.add(() => setDialogOpen(true)),
    commonButtons.export(() => setExportDialogOpen(true)),
    commonButtons.columnSettings(() => setColumnSettingsOpen(true)),
    commonButtons.refresh(() => loadData(), refreshing),
  ]}
/>
```

### Pre-configured Buttons:
- `commonButtons.add(onClick, disabled)`
- `commonButtons.export(onClick, disabled)`
- `commonButtons.import(onClick, disabled)`
- `commonButtons.refresh(onClick, loading)`
- `commonButtons.columnSettings(onClick)`
- `commonButtons.delete(onClick, disabled)`
- `commonButtons.edit(onClick, disabled)`
- `commonButtons.print(onClick, disabled)`
- `commonButtons.filters(onClick, active)`

### Custom Button:
```tsx
<StandardActionButtons
  buttons={[
    {
      label: 'Custom Action',
      icon: <CustomIcon />,
      onClick: handleCustomAction,
      variant: 'contained',
      color: 'primary',
      disabled: false,
    }
  ]}
/>
```

### Features:
- ✅ Mobile-responsive (stacks vertically)
- ✅ Compact mode (icons only on mobile)
- ✅ Loading states
- ✅ Consistent styling

---

## 5. StandardPageLayout

**Purpose:** Consistent page structure

### Usage:
```tsx
import { StandardPageLayout } from '@/components';

<StandardPageLayout
  title="Page Title"
  searchValue={searchQuery}
  onSearchChange={setSearchQuery}
  showAdvancedFilters={filtersOpen}
  onToggleFilters={() => setFiltersOpen(!filtersOpen)}
  advancedFilters={
    <Stack direction="row" spacing={2}>
      <TextField label="Brand" />
      <TextField label="Category" />
    </Stack>
  }
  actionButtons={
    <StandardActionButtons buttons={[...]} />
  }
>
  {/* Your page content */}
  <StandardAGGrid rowData={data} columnDefs={cols} />
</StandardPageLayout>
```

### Features:
- ✅ Consistent header with title
- ✅ Search bar
- ✅ Collapsible filters
- ✅ Action buttons area
- ✅ Scrollable content area

---

## 6. StandardDialog

**Purpose:** Generic dialog for custom content

### Usage:
```tsx
import { StandardDialog } from '@/components';

<StandardDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  title="Dialog Title"
  actions={
    <>
      <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
      <Button variant="contained" onClick={handleSave}>Save</Button>
    </>
  }
>
  {/* Your dialog content */}
  <TextField label="Name" fullWidth />
</StandardDialog>
```

---

## Complete Page Example

```tsx
'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  StandardPageLayout,
  StandardAGGrid,
  StandardActionButtons,
  ColumnSettingsDialog,
  ExportDialog,
  commonButtons,
} from '@/components';
import { Button } from '@mui/material';
import toast from 'react-hot-toast';

export default function MyPage() {
  const [data, setData] = useState([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const columnDefs = visibleColumns.map(col => ({
    field: col,
    headerName: col.replace(/_/g, ' ').toUpperCase(),
  }));

  const handleExport = async ({ type, format }) => {
    // Export logic
    toast.success('Exported!');
    setExportDialogOpen(false);
  };

  return (
    <AppLayout>
      <StandardPageLayout
        title="My Page"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        showAdvancedFilters={filtersOpen}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        actionButtons={
          <StandardActionButtons
            buttons={[
              commonButtons.export(() => setExportDialogOpen(true)),
              commonButtons.columnSettings(() => setColumnSettingsOpen(true)),
              commonButtons.refresh(() => loadData()),
            ]}
          />
        }
      >
        <StandardAGGrid
          rowData={data}
          columnDefs={columnDefs}
          height="calc(100vh - 250px)"
        />
      </StandardPageLayout>

      <ColumnSettingsDialog
        open={columnSettingsOpen}
        onClose={() => setColumnSettingsOpen(false)}
        columns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        onToggleColumn={(col) => {
          setVisibleColumns(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
          );
        }}
        onSelectAll={() => {
          setVisibleColumns(
            visibleColumns.length === ALL_COLUMNS.length ? [] : ALL_COLUMNS
          );
        }}
        onReset={() => setVisibleColumns(DEFAULT_COLUMNS)}
      />

      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        currentCount={data.length}
        totalCount={data.length}
      />
    </AppLayout>
  );
}
```

---

## Benefits

✅ **Consistency** - All pages look and feel the same
✅ **Responsive** - Works perfectly on mobile/tablet/desktop
✅ **Professional** - Modern Material Design
✅ **Easy to Use** - Import and use, no custom styling needed
✅ **Maintainable** - Update once, applies everywhere

---

## Migration Checklist

For each page, replace:
- ❌ Custom dialogs → ✅ StandardDialog / ColumnSettingsDialog / ExportDialog
- ❌ Direct AG Grid → ✅ StandardAGGrid
- ❌ Custom buttons → ✅ StandardActionButtons
- ❌ Custom layouts → ✅ StandardPageLayout

This ensures 100% consistency across the app!
