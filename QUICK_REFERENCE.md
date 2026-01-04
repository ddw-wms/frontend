# 🚀 Quick Reference Card - UI Standardization

## 📦 Import Statement
```tsx
import {
  ExportDialog,
  ColumnSettingsDialog,
  MobileActionDialog,
  StandardPageHeader,
  type MobileAction
} from '@/components';
```

## 🎯 Common Patterns

### 1. Page Header
```tsx
<StandardPageHeader
  title="Your Page Title"
  breadcrumbs={[
    { label: 'Home', href: '/dashboard' },
    { label: 'Current Page' }
  ]}
  actions={
    !isMobile && (
      <>
        <Button>Action 1</Button>
        <Button>Action 2</Button>
      </>
    )
  }
/>
```

### 2. Export Dialog
```tsx
// State
const [exportOpen, setExportOpen] = useState(false);
const [exporting, setExporting] = useState(false);

// Handler
const handleExport = async (type: string, format: string) => {
  setExporting(true);
  // Your export logic
  setExporting(false);
  setExportOpen(false);
};

// Component
<ExportDialog
  open={exportOpen}
  onClose={() => setExportOpen(false)}
  onExport={handleExport}
  counts={{
    current: currentPageData.length,
    filtered: filteredData.length,
    all: totalCount
  }}
  loading={exporting}
/>
```

### 3. Column Settings Dialog
```tsx
// State
const [columnOpen, setColumnOpen] = useState(false);
const [columns, setColumns] = useState<ColumnConfig[]>([]);

// Component
<ColumnSettingsDialog
  open={columnOpen}
  onClose={() => setColumnOpen(false)}
  columns={columns}
  onColumnsChange={setColumns}
  storageKey="your_page_columns"
/>
```

### 4. Mobile Action Dialog
```tsx
// State
const [mobileOpen, setMobileOpen] = useState(false);
const isMobile = useMediaQuery('(max-width:600px)');

// Actions
const mobileActions: MobileAction[] = [
  {
    icon: <AddIcon />,
    label: 'Add New',
    onClick: () => handleAdd(),
    color: 'primary'
  },
  {
    icon: <DownloadIcon />,
    label: 'Export',
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
    label: 'Refresh',
    onClick: () => loadData(),
    color: 'primary'
  }
];

// Trigger Button (mobile only)
{isMobile && (
  <IconButton onClick={() => setMobileOpen(true)}>
    <MenuIcon />
  </IconButton>
)}

// Dialog
<MobileActionDialog
  open={mobileOpen}
  onClose={() => setMobileOpen(false)}
  title="Actions"
  actions={mobileActions}
/>
```

## 🎨 Color Codes

```tsx
Primary:   #1976d2  (blue)
Success:   #4caf50  (green)
Error:     #d32f2f  (red)
Warning:   #ed6c02  (orange)
Info:      #0288d1  (light blue)
```

## 📐 Responsive Breakpoints

```tsx
xs:  0px - 599px   (Mobile)
sm:  600px - 899px (Tablet)
md:  900px+        (Desktop)
```

## 🔍 Common SX Props

```tsx
// Hide on mobile
sx={{ display: { xs: 'none', md: 'block' } }}

// Stack vertically on mobile
sx={{ flexDirection: { xs: 'column', sm: 'row' } }}

// Full width on mobile
sx={{ width: { xs: '100%', sm: 'auto' } }}

// Smaller font on mobile
sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
```

## 📝 State Management Template

```tsx
// Dialog States
const [exportOpen, setExportOpen] = useState(false);
const [columnOpen, setColumnOpen] = useState(false);
const [mobileOpen, setMobileOpen] = useState(false);

// Loading States
const [loading, setLoading] = useState(false);
const [exporting, setExporting] = useState(false);

// Mobile Detection
const isMobile = useMediaQuery('(max-width:600px)');
```

## ✅ Quick Checklist

Before committing changes:
- [ ] Import all components from '@/components'
- [ ] Add required state variables
- [ ] Implement mobile detection if needed
- [ ] Test on desktop (1920x1080)
- [ ] Test on mobile (375px width)
- [ ] Verify no TypeScript errors
- [ ] Check that all functionality works
- [ ] Confirm dialogs close properly
- [ ] Test export and column settings

## 🐛 Common Issues & Fixes

**Issue**: Dialog doesn't close
**Fix**: Make sure onClose prop calls setState

**Issue**: Mobile actions not showing
**Fix**: Check isMobile detection and conditional rendering

**Issue**: Export not working
**Fix**: Verify handleExport function and loading state

**Issue**: Columns not persisting
**Fix**: Check storageKey is unique per page

## 📚 Full Documentation

- `STANDARDIZATION_GUIDE.md` - Detailed instructions
- `UI_VISUAL_REFERENCE.md` - Design specifications
- `UI_IMPLEMENTATION_STATUS.md` - Progress tracking
- `README_UI_STANDARDIZATION.md` - Complete overview

---

**Keep this card handy while implementing!**
