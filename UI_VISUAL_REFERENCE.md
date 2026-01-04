# UI Components Visual Reference

## 📱 MobileActionDialog

### Purpose
Standardized mobile action menu that appears when users tap the menu button on mobile devices.

### Visual Appearance
```
┌─────────────────────────────────┐
│ Actions                      ✕  │ ← Header with close button
├─────────────────────────────────┤
│ ➕ Add New Entry                │ ← Icon + Label
├─────────────────────────────────┤
│ 📥 Export Data                  │
├─────────────────────────────────┤
│ ⚙️  Column Settings              │
├─────────────────────────────────┤
│ 🔄 Refresh                      │
└─────────────────────────────────┘
```

### Colors
- Icons can be colored: primary (blue), success (green), error (red), warning (orange), info (light blue)
- Border between items: #e0e0e0
- Background: white
- Border radius: 8px

---

## 📋 StandardPageHeader

### Purpose
Consistent page title section with optional breadcrumbs and action buttons.

### Visual Appearance (Desktop)
```
Home > Picking                                  [Add New] [Export]
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Picking Management                        [Action Buttons]    │ ← 2rem (32px) title
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Visual Appearance (Mobile)
```
Home > Picking
┌────────────────────┐
│                    │
│ Picking Management │ ← 1.5rem (24px) title
│                    │
│ [Add New]          │ ← Buttons stack vertically
│ [Export]           │
│                    │
└────────────────────┘
```

### Spacing
- Bottom margin: 16px (mobile), 24px (desktop)
- Breadcrumb size: 14px (mobile), 16px (desktop)
- Title weight: 600 (semi-bold)

---

## 📤 ExportDialog

### Purpose
Standardized export dialog for exporting data to Excel or CSV formats.

### Visual Appearance
```
┌─────────────────────────────────────────────┐
│ Export Data                              ✕  │ ← Green header (#4caf50)
├─────────────────────────────────────────────┤
│                                             │
│  Export Type:                               │
│  ○ Current Page (50 records)                │ ← Radio buttons
│  ○ Filtered Data (150 records)             │
│  ○ All Data (500 records)                  │
│                                             │
│  File Format:                               │
│  [Excel (.xlsx)        ▼]                   │ ← Dropdown
│                                             │
│                    [Cancel]  [Export]       │ ← Action buttons
└─────────────────────────────────────────────┘
```

### Colors
- Header background: #4caf50 (green)
- Header text: white
- Export button: green (#4caf50)
- Cancel button: gray outlined

### States
- Loading: Shows spinner on Export button
- Success: Button shows "Exporting..."

---

## ⚙️ ColumnSettingsDialog

### Purpose
Allow users to show/hide columns in data grids.

### Visual Appearance
```
┌─────────────────────────────────────────────┐
│ Column Settings                          ✕  │ ← Blue header (#1976d2)
├─────────────────────────────────────────────┤
│                                             │
│  [Select All]  [Deselect All]  [Reset]      │ ← Action chips
│                                             │
│  EDITABLE COLUMNS                           │ ← Section header
│  ☑ WSN                                      │
│  ☑ Product Serial Number                   │
│  ☑ Rack Number                             │
│  ☑ QC Grade                                │
│  ☑ Remarks                                 │
│                                             │
│  READ-ONLY COLUMNS                          │
│  ☑ Product Title                           │
│  ☑ Brand                                   │
│  ☐ MRP                                     │ ← Unchecked
│  ☑ FSP                                     │
│                                             │
│                    [Cancel]  [Done]         │
└─────────────────────────────────────────────┘
```

### Colors
- Header background: #1976d2 (blue)
- Header text: white
- Section headers: gray (#64748b)
- Checkboxes: blue (#1976d2)
- Done button: blue contained
- Cancel button: gray outlined

### Mobile
- Full screen on mobile (< 600px)
- Scrollable content area
- Sticky action buttons at bottom

---

## 📊 AG Grid Headers

### Visual Appearance
```
┌──────────┬─────────────┬──────────┬─────────┐
│ WSN      │ PRODUCT     │ BRAND    │ GRADE   │ ← Headers
├──────────┼─────────────┼──────────┼─────────┤
│ 12345    │ iPhone 14   │ Apple    │ A       │
│ 12346    │ Galaxy S23  │ Samsung  │ A       │
│ 12347    │ Pixel 8     │ Google   │ B       │
└──────────┴─────────────┴──────────┴─────────┘
```

### Styling
- Header background: #1976d2 (blue)
- Header text: white (#fff)
- Font weight: 600 (semi-bold)
- Text transform: uppercase
- Font size: 12px
- Letter spacing: 0.5px
- Header height: 48px (desktop), 40px (mobile)

### Row Styling
- Odd rows: #f9fafb (light gray)
- Even rows: white
- Hover: #e3f2fd (light blue)
- Row height: 42px (desktop), 36px (mobile)
- Font size: 13px (desktop), 12px (mobile)

---

## 🔘 Button Styles

### Primary Button (Contained)
```
┌─────────────┐
│  Add New    │ ← Blue background (#1976d2)
└─────────────┘
```

### Secondary Button (Outlined)
```
┌─────────────┐
│   Export    │ ← Blue border, transparent background
└─────────────┘
```

### Success Button (Export)
```
┌─────────────┐
│   Export    │ ← Green (#4caf50)
└─────────────┘
```

### Icon Button
```
┌───┐
│ ⚙ │ ← Circular, gray
└───┘
```

---

## 🎨 Color Palette

### Primary Colors
- **Primary Blue**: #1976d2
  - Used for: Headers, primary buttons, links
  
- **Success Green**: #4caf50
  - Used for: Export dialogs, success messages
  
- **Error Red**: #d32f2f
  - Used for: Delete buttons, error messages
  
- **Warning Orange**: #ed6c02
  - Used for: Warning messages
  
- **Info Light Blue**: #0288d1
  - Used for: Info messages

### Neutral Colors
- **Background**: #f5f5f5
- **Paper**: #ffffff
- **Border**: #e0e0e0
- **Text Primary**: #333333
- **Text Secondary**: #666666
- **Disabled**: #9e9e9e

### Grid Colors
- **Header BG**: #1976d2
- **Header Text**: #ffffff
- **Odd Row**: #f9fafb
- **Even Row**: #ffffff
- **Hover**: #e3f2fd
- **Border**: #e0e0e0

---

## 📐 Spacing System

### Margins & Padding
- **xs**: 4px (0.5rem)
- **sm**: 8px (1rem)
- **md**: 16px (2rem)
- **lg**: 24px (3rem)
- **xl**: 32px (4rem)

### Border Radius
- **Small**: 4px (buttons, chips)
- **Medium**: 8px (cards, dialogs)
- **Large**: 12px (main containers)

---

## 📱 Responsive Breakpoints

### Material-UI Breakpoints
- **xs**: 0px - 599px (Mobile Portrait)
- **sm**: 600px - 899px (Mobile Landscape / Small Tablet)
- **md**: 900px - 1199px (Tablet)
- **lg**: 1200px - 1535px (Desktop)
- **xl**: 1536px+ (Large Desktop)

### Common Patterns
```tsx
// Hide on mobile
sx={{ display: { xs: 'none', md: 'block' } }}

// Stack on mobile, row on desktop
sx={{ flexDirection: { xs: 'column', sm: 'row' } }}

// Full width on mobile, auto on desktop
sx={{ width: { xs: '100%', sm: 'auto' } }}

// Smaller font on mobile
sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
```

---

## 🎯 Interactive States

### Buttons
- **Default**: Normal appearance
- **Hover**: Slight background color change
- **Active**: Darker background
- **Disabled**: Grayed out, no pointer events
- **Loading**: Spinner + "Loading..." text

### Dialogs
- **Open**: Fade in animation (200ms)
- **Close**: Fade out animation (200ms)
- **Backdrop**: Semi-transparent black (#000 opacity 0.5)

### Grid
- **Loading**: Top linear progress bar (3px height)
- **No Data**: "No data available" centered message
- **Row Hover**: Light blue highlight (#e3f2fd)
- **Row Selected**: Darker blue highlight

---

## ✨ Animation Guidelines

### Timing
- **Fast**: 150ms - 200ms (micro-interactions, hovers)
- **Medium**: 300ms - 400ms (dialogs, modals)
- **Slow**: 500ms+ (page transitions)

### Easing
- **Ease-in-out**: Standard transitions
- **Ease-out**: Element entering
- **Ease-in**: Element leaving

### Loading States
```tsx
// Top bar loading (use LinearProgress)
<LinearProgress color="primary" sx={{ height: 3 }} />

// Centered loading (use CircularProgress)
<CircularProgress size={56} />

// Button loading (inline)
<CircularProgress size={20} />
```

---

## 🔍 Typography Scale

### Headings
- **h1**: 2.5rem (40px) - rarely used
- **h2**: 2rem (32px) - page titles desktop
- **h3**: 1.75rem (28px) - section headers
- **h4**: 1.5rem (24px) - page titles mobile
- **h5**: 1.25rem (20px) - dialog titles
- **h6**: 1rem (16px) - card titles

### Body Text
- **body1**: 1rem (16px) - default
- **body2**: 0.875rem (14px) - secondary text

### Smaller Text
- **caption**: 0.75rem (12px) - labels, hints
- **button**: 0.875rem (14px) - button text

### Font Weights
- **400**: Regular
- **500**: Medium (button text)
- **600**: Semi-bold (headings)
- **700**: Bold (emphasis)

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
