# 🎨 WMS Professional UI System - Complete Implementation Guide

## ✨ Overview
This system provides **Zoho Books-style professional components** for complete UI consistency across all WMS pages.

---

## 📦 Available Professional Components

### 1. StandardPageHeader
**Professional gradient header with warehouse/user chips**

```tsx
import { StandardPageHeader } from '@/components';

<StandardPageHeader
  title="Dashboard"
  subtitle="Track all warehouse operations"
  icon="📊"
  warehouseName={activeWarehouse?.name}
  userName={user?.full_name}
  userRole={user?.role}
/>
```

**Features:**
- ✅ Gradient blue background (matches Zoho Books)
- ✅ Icon with glassmorphism effect
- ✅ Warehouse and user chips
- ✅ Fully responsive (0.85rem mobile → 1.3rem desktop)
- ✅ Sticky positioning
- ✅ Professional shadows and blur effects

---

### 2. StandardTabs
**Consistent tab navigation**

```tsx
import { StandardTabs } from '@/components';

<StandardTabs
  value={tabValue}
  onChange={(e, v) => setTabValue(v)}
  tabs={['List View', 'Multi Entry', 'Batch Manager']}
  color="#3b82f6"
/>
```

**Features:**
- ✅ Sticky positioning
- ✅ Scrollable on mobile
- ✅ Custom gradient indicator
- ✅ Hover effects
- ✅ Professional typography

---

### 3. ActionButtonBar
**Consistent action buttons (desktop/mobile)**

```tsx
import { ActionButtonBar, type ActionButtonConfig } from '@/components';

const buttons: ActionButtonConfig[] = [
  {
    icon: <AddIcon />,
    label: 'Add New',
    onClick: () => handleAdd(),
    variant: 'contained',
    color: 'primary',
    tooltip: 'Add new entry'
  },
  {
    icon: <DownloadIcon />,
    label: 'Export',
    onClick: () => setExportOpen(true),
    variant: 'outlined',
    color: 'success',
    tooltip: 'Export to Excel/CSV'
  },
  {
    icon: <SettingsIcon />,
    label: 'Columns',
    onClick: () => setColumnOpen(true),
    variant: 'outlined',
    color: 'info'
  },
  {
    icon: <RefreshIcon />,
    label: 'Refresh',
    onClick: () => loadData(),
    variant: 'outlined',
    disabled: loading
  }
];

<ActionButtonBar
  buttons={buttons}
  mobileMenuButton={
    <Button
      variant="contained"
      startIcon={<TuneIcon />}
      onClick={() => setMobileOpen(true)}
    >
      Actions
    </Button>
  }
/>
```

**Features:**
- ✅ Desktop: Full buttons with labels
- ✅ Mobile: Icon buttons or menu trigger
- ✅ Tooltips on all buttons
- ✅ Disabled state support
- ✅ Multiple color variants

---

### 4. StandardFilterBar
**Professional filter bar with search**

```tsx
import { StandardFilterBar, type FilterOption } from '@/components';

const filters: FilterOption[] = [
  {
    label: 'Brand',
    value: brandFilter,
    type: 'select',
    options: brandOptions.map(b => ({ label: b, value: b })),
    onChange: setBrandFilter,
    currentValue: brandFilter
  },
  {
    label: 'Category',
    value: categoryFilter,
    type: 'select',
    options: categoryOptions.map(c => ({ label: c, value: c })),
    onChange: setCategoryFilter,
    currentValue: categoryFilter
  },
  {
    label: 'Date From',
    value: dateFrom,
    type: 'date',
    onChange: setDateFrom,
    currentValue: dateFrom
  }
];

<StandardFilterBar
  searchValue={searchFilter}
  onSearchChange={setSearchFilter}
  searchPlaceholder="🔍 Search by WSN or Product"
  filters={filters}
  onReset={() => {
    setSearchFilter('');
    setBrandFilter('');
    setCategoryFilter('');
    setDateFrom('');
  }}
  filtersExpanded={filtersExpanded}
  onToggleFilters={() => setFiltersExpanded(!filtersExpanded)}
  filtersActive={Boolean(searchFilter || brandFilter || categoryFilter)}
  mobileActionButton={
    <Button variant="contained" onClick={() => setMobileOpen(true)}>
      Actions
    </Button>
  }
/>
```

**Features:**
- ✅ Professional search bar
- ✅ Collapsible filters on desktop
- ✅ Mobile action button integration
- ✅ Active filters indicator (green dot)
- ✅ Reset button with icon
- ✅ Smooth collapse animation

---

### 5. MobileActionDialog
**Professional mobile action menu**

```tsx
import { MobileActionDialog, type MobileAction } from '@/components';

const actions: MobileAction[] = [
  {
    icon: <AddIcon />,
    label: 'Add New Entry',
    onClick: () => handleAdd(),
    color: 'primary'
  },
  {
    icon: <DownloadIcon />,
    label: 'Export Data',
    onClick: () => setExportOpen(true),
    color: 'success'
  },
  {
    icon: <SettingsIcon />,
    label: 'Column Settings',
    onClick: () => setColumnOpen(true),
    color: 'info'
  },
  {
    icon: <RefreshIcon />,
    label: 'Refresh Data',
    onClick: () => loadData(),
    color: 'primary'
  },
  {
    icon: <FilterListIcon />,
    label: 'Toggle Filters',
    onClick: () => setFiltersExpanded(!filtersExpanded),
    color: 'inherit'
  }
];

<MobileActionDialog
  open={mobileOpen}
  onClose={() => setMobileOpen(false)}
  title="Actions"
  actions={actions}
/>
```

**Features:**
- ✅ Clean list design
- ✅ Color-coded icons
- ✅ Auto-close after action
- ✅ Proper spacing
- ✅ Close button in header

---

### 6. ExportDialog
**Standardized export dialog**

```tsx
import { ExportDialog } from '@/components';

<ExportDialog
  open={exportOpen}
  onClose={() => setExportOpen(false)}
  onExport={async (type, format) => {
    // type: 'current' | 'filtered' | 'all'
    // format: 'xlsx' | 'csv'
    const data = type === 'all' ? allData : filteredData;
    // Export logic here
  }}
  counts={{
    current: currentPageData.length,
    filtered: filteredData.length,
    all: totalCount
  }}
  loading={exporting}
/>
```

**Features:**
- ✅ Green success-themed header
- ✅ Current/Filtered/All options
- ✅ XLSX/CSV format selection
- ✅ Record counts display
- ✅ Loading state

---

### 7. ColumnSettingsDialog
**Standardized column visibility dialog**

```tsx
import { ColumnSettingsDialog } from '@/components';

<ColumnSettingsDialog
  open={columnOpen}
  onClose={() => setColumnOpen(false)}
  columns={columns}
  onColumnsChange={setColumns}
  storageKey="dashboard_columns"
/>
```

**Features:**
- ✅ Blue primary-themed header
- ✅ Select All / Deselect All
- ✅ Reset to defaults
- ✅ localStorage persistence
- ✅ Full-screen on mobile
- ✅ Checkbox-based selection

---

## 🎨 Professional AG Grid Styling

### Enhanced globals.css
All grids now have:
- ✅ Blue gradient header (matches Zoho Books)
- ✅ White text on headers
- ✅ Uppercase headers with letter-spacing
- ✅ Alternating row colors (#f9fafb / white)
- ✅ Smooth hover effects (#e3f2fd)
- ✅ Professional borders
- ✅ Mobile-responsive sizing

**No code changes needed - automatically applied!**

---

## 📋 Complete Page Implementation Example

```tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  Add as AddIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Tune as TuneIcon
} from '@mui/icons-material';
import {
  StandardPageHeader,
  StandardTabs,
  ActionButtonBar,
  StandardFilterBar,
  MobileActionDialog,
  ExportDialog,
  ColumnSettingsDialog,
  AppLayout,
  type ActionButtonConfig,
  type MobileAction,
  type FilterOption
} from '@/components';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function YourPage() {
  // State
  const [tabValue, setTabValue] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Desktop action buttons
  const actionButtons: ActionButtonConfig[] = [
    {
      icon: <AddIcon />,
      label: 'Add New',
      onClick: () => console.log('Add'),
      variant: 'contained',
      color: 'primary'
    },
    {
      icon: <DownloadIcon />,
      label: 'Export',
      onClick: () => setExportOpen(true),
      variant: 'outlined',
      color: 'success'
    },
    {
      icon: <SettingsIcon />,
      label: 'Columns',
      onClick: () => setColumnOpen(true),
      variant: 'outlined',
      color: 'info'
    },
    {
      icon: <RefreshIcon />,
      label: 'Refresh',
      onClick: () => loadData(),
      variant: 'outlined',
      disabled: loading
    }
  ];

  // Mobile actions
  const mobileActions: MobileAction[] = [
    { icon: <AddIcon />, label: 'Add New', onClick: () => {}, color: 'primary' },
    { icon: <DownloadIcon />, label: 'Export', onClick: () => setExportOpen(true), color: 'success' },
    { icon: <SettingsIcon />, label: 'Columns', onClick: () => setColumnOpen(true), color: 'info' },
    { icon: <RefreshIcon />, label: 'Refresh', onClick: () => loadData(), color: 'primary' }
  ];

  // Filters
  const filters: FilterOption[] = [
    {
      label: 'Brand',
      value: 'brand',
      type: 'select',
      options: [{ label: 'Apple', value: 'apple' }],
      onChange: (v) => {},
      currentValue: ''
    }
  ];

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* HEADER */}
        <StandardPageHeader
          title="Your Page Title"
          subtitle="Page description"
          icon="📊"
          warehouseName="Main Warehouse"
          userName="John Doe"
        />

        {/* TABS */}
        <StandardTabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          tabs={['List View', 'Analytics']}
        />

        {/* FILTERS + ACTIONS */}
        <Box sx={{ p: 1 }}>
          <StandardFilterBar
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder="🔍 Search..."
            filters={filters}
            onReset={() => setSearchFilter('')}
            filtersExpanded={filtersExpanded}
            onToggleFilters={() => setFiltersExpanded(!filtersExpanded)}
            filtersActive={Boolean(searchFilter)}
            mobileActionButton={
              <Button
                variant="contained"
                startIcon={<TuneIcon />}
                onClick={() => setMobileOpen(true)}
              >
                Actions
              </Button>
            }
          />

          {/* Desktop Actions */}
          <Box sx={{ mt: 1, display: { xs: 'none', md: 'block' } }}>
            <ActionButtonBar buttons={actionButtons} />
          </Box>
        </Box>

        {/* GRID */}
        <Box sx={{ flex: 1, p: 1 }}>
          <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              rowData={[]}
              columnDefs={[]}
              // ... other props
            />
          </div>
        </Box>

        {/* DIALOGS */}
        <MobileActionDialog
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          actions={mobileActions}
        />

        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onExport={(type, format) => {}}
          counts={{ current: 0, filtered: 0, all: 0 }}
          loading={false}
        />

        <ColumnSettingsDialog
          open={columnOpen}
          onClose={() => setColumnOpen(false)}
          columns={[]}
          onColumnsChange={() => {}}
          storageKey="page_columns"
        />
      </Box>
    </AppLayout>
  );
}
```

---

## 🎯 Implementation Checklist

For each page (Dashboard, Inbound, QC, Picking, Outbound):

### Step 1: Replace Header
- [ ] Remove old custom header
- [ ] Add `<StandardPageHeader>` with icon, title, subtitle
- [ ] Pass warehouse name and user info

### Step 2: Replace Tabs (if applicable)
- [ ] Remove old `<Tabs>` component
- [ ] Add `<StandardTabs>` with tab labels and color

### Step 3: Add Action Buttons
- [ ] Create `actionButtons` array with `ActionButtonConfig[]`
- [ ] Add `<ActionButtonBar>` for desktop
- [ ] Create `mobileActions` array for mobile
- [ ] Add `<MobileActionDialog>`

### Step 4: Enhance Filters
- [ ] Create `filters` array with `FilterOption[]`
- [ ] Replace old filter UI with `<StandardFilterBar>`
- [ ] Connect mobile action button

### Step 5: Update Dialogs
- [ ] Replace export dialog with `<ExportDialog>`
- [ ] Replace column settings with `<ColumnSettingsDialog>`

### Step 6: Verify Grid
- [ ] Ensure `className="ag-theme-quartz"`
- [ ] Grid headers should show white text automatically
- [ ] Test responsive behavior

---

## 🎨 Color Palette

```tsx
Primary Blue:    #1976d2  (Headers, primary buttons)
Success Green:   #4caf50  (Export, success actions)
Error Red:       #ef4444  (Delete, errors)
Warning Orange:  #f59e0b  (Warnings, picking)
Info Blue:       #0288d1  (Info actions)
Gray:            #64748b  (Secondary text)
Background:      #f9fafb  (Odd rows, backgrounds)
```

---

## 📱 Responsive Breakpoints

```tsx
Mobile:    0px - 599px   (xs)
Tablet:    600px - 899px (sm)
Desktop:   900px+        (md, lg, xl)
```

---

## ✨ Benefits

### For Users:
- ✅ **Zoho Books-quality** professional appearance
- ✅ **100% consistency** across all pages
- ✅ **Smooth animations** and transitions
- ✅ **Mobile-optimized** experience
- ✅ **Predictable** interface

### For Developers:
- ✅ **Copy-paste ready** examples
- ✅ **Type-safe** with TypeScript
- ✅ **Reusable** components
- ✅ **Well-documented** with examples
- ✅ **Easy maintenance**

---

## 🚀 Quick Start

1. **Import components:**
```tsx
import {
  StandardPageHeader,
  StandardTabs,
  ActionButtonBar,
  StandardFilterBar,
  MobileActionDialog,
  ExportDialog,
  ColumnSettingsDialog
} from '@/components';
```

2. **Copy example from above**

3. **Customize for your page**

4. **Test on mobile and desktop**

5. **Done!** ✨

---

**Last Updated:** ${new Date().toISOString().split('T')[0]}
**Status:** Production Ready
**Quality:** Zoho Books Professional Standard
