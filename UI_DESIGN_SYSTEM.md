# WCGMall Operations Hub - UI Design System & Component Guidelines

> **Application**: WCGMall Multi-Channel E-Commerce & Marketing Hub  
> **Aesthetic Archetype**: Modern Enterprise Fintech / E-Commerce Operations Tone  
> **Framework**: React 18+ / Vite / Tailwind CSS / Lucide Icons  

---

## 1. Color Palette & Semantic Tokens

The app uses a high-contrast light workspace (`bg-slate-50` / `bg-white`) paired with a deep navy brand sidebar (`bg-slate-900` / `#0F172A`) and purposeful functional accents.

### Core Neutral Surfaces
| Token / Element | Tailwind Class | Hex Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Workspace Canvas** | `bg-slate-100` / `bg-slate-50` | `#F8FAFC` | Main background behind all cards & views |
| **Elevated Surfaces** | `bg-white` | `#FFFFFF` | Primary cards, panels, and modals |
| **Sub-panels / Insets** | `bg-slate-50` | `#F8FAFC` | Inset info cards, modal headers, table headers |
| **Structural Borders** | `border-slate-200` | `#E2E8F0` | Card borders, modal frames, input borders |
| **Row Dividers** | `border-slate-100` / `divide-slate-100` | `#F1F5F9` | Table row separations & list borders |
| **Primary Text** | `text-slate-900` / `text-slate-800` | `#0F172A` / `#1E293B` | High-contrast headings and primary labels |
| **Secondary Text** | `text-slate-600` / `text-slate-500` | `#475569` / `#64748B` | Subtitles, descriptions, timestamps |
| **Muted Text / Placeholders** | `text-slate-400` | `#94A3B8` | Input placeholders, inactive tabs, disabled items |

### Semantic & Channel Accents
| Role / Channel | Solid Accent | Soft Background Badge | Text Color |
| :--- | :--- | :--- | :--- |
| **Primary Blue** | `bg-blue-600` (`hover:bg-blue-700`) | `bg-blue-50 border-blue-200` | `text-blue-700` |
| **WhatsApp / Success** | `bg-emerald-600` (`hover:bg-emerald-700`) | `bg-emerald-50 border-emerald-300` | `text-emerald-800` |
| **Warning / Pending** | `bg-amber-500` (`hover:bg-amber-600`) | `bg-amber-50 border-amber-200` | `text-amber-900` |
| **Danger / Cancelled** | `bg-rose-600` (`hover:bg-rose-700`) | `bg-rose-50 border-rose-200` | `text-rose-700` |
| **Shopee Marketplace** | `bg-orange-500` | `bg-orange-50 border-orange-200` | `text-orange-700` |
| **Lazada Marketplace** | `bg-blue-600` | `bg-blue-50 border-blue-200` | `text-blue-800` |

---

## 2. Standard Modal UI Specification

Every dialog and modal window across the application must strictly adhere to this uniform layout:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
  <div
    className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
    onClick={(e) => e.stopPropagation()}
  >
    {/* 1. MODAL HEADER */}
    <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Icon Tile */}
        <div className="w-10 h-10 aspect-square shrink-0 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
              Modal Title
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider font-mono">
              Category Chip
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Descriptive subtitle or instruction for the user
          </p>
        </div>
      </div>

      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
        title="Close modal"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* 2. MODAL BODY */}
    <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-700">
      {/* Detail Inset Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>Section Label</span>
          <span className="font-mono text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Badge Info
          </span>
        </div>
        <div className="text-sm font-bold text-slate-900">
          Primary Field Value
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          Important instructions or confirmation notice message.
        </span>
      </div>
    </div>

    {/* 3. MODAL FOOTER */}
    <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>Confirm Action</span>
      </button>
    </div>
  </div>
</div>
```

---

## 3. Standard Buttons & Action Triggers

| Type | Tailwind Classes | Use Case |
| :--- | :--- | :--- |
| **Primary (Blue)** | `px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer` | "Save Changes", "Send SMS", "Sync API" |
| **Success (Green)** | `px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer` | "Yes, Message Sent", "Confirm", "Export" |
| **Destructive (Rose)** | `px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer` | "Delete Log", "Clear History", "Revoke Token" |
| **Secondary / Neutral** | `px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer` | "Cancel", "Close", "Dismiss", "Reset Filters" |
| **Table Action Pill** | `px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs` | "Open WhatsApp ↗", "View Details" |

---

## 4. Form Controls, Inputs & Dropdowns

### Single-Line Text Input
```tsx
<input
  type="text"
  placeholder="Search orders, phone, customer..."
  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all shadow-2xs"
/>
```

### Multi-Line Textarea
```tsx
<textarea
  rows={4}
  placeholder="Enter message text or custom customer note..."
  className="w-full p-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs leading-relaxed"
/>
```

### Dropdown Select
```tsx
<div className="relative">
  <select className="w-full appearance-none px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer shadow-2xs">
    <option value="all">All Channels</option>
    <option value="shopee">Shopee Orders</option>
    <option value="lazada">Lazada Orders</option>
  </select>
  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
</div>
```

---

## 5. Table Design & Sortable Column Headers

```tsx
<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
  <table className="w-full text-left text-xs border-collapse">
    <thead>
      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 select-none">
        <th className="py-2.5 px-3">
          <button
            type="button"
            onClick={() => handleSort('name')}
            className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
          >
            <span>Buyer Customer</span>
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
          </button>
        </th>
        <th className="py-2.5 px-3">Phone Number</th>
        <th className="py-2.5 px-3">Product Name</th>
        <th className="py-2.5 px-3 text-right">Action</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100 font-medium">
      <tr className="hover:bg-slate-50/80 transition-colors">
        <td className="py-2.5 px-3 font-bold text-slate-900">Lee Meng Teck</td>
        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">+60128887766</td>
        <td className="py-2.5 px-3 text-slate-700 truncate max-w-[160px]">Steam Wallet MYR 200</td>
        <td className="py-2.5 px-3 text-right">
          <button className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Open WhatsApp</span>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 6. Smart Hover Preview Tooltips (Anti-Clipping Pattern)

Hover tooltips in table rows (such as Full Product Name or Full Message Previews) must adjust their vertical position based on row index to prevent clipping:

```tsx
<td className="py-2.5 px-3 max-w-[140px] relative group/prod">
  <div className="font-medium text-slate-800 truncate cursor-pointer hover:text-emerald-700 transition-colors">
    {productName}
  </div>

  {/* Smart Placement: Opens downwards on top rows (idx < 3), upwards on lower rows */}
  <div
    className={`absolute left-0 ${
      rowIndex < 3 ? 'top-full mt-2' : 'bottom-full mb-2'
    } z-[60] hidden group-hover/prod:block w-72 sm:w-80 p-3 bg-white text-slate-900 text-xs rounded-xl shadow-2xl border border-slate-200 pointer-events-none leading-snug whitespace-normal ring-1 ring-slate-900/10`}
  >
    <div className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <span>FULL PRODUCT NAME</span>
    </div>
    <div className="font-bold text-slate-900 break-words leading-relaxed">
      {productName}
    </div>
  </div>
</td>
```

---

## 7. Status Badges & Pills Reference

| Status Value | Visual Style & Classes | Example Rendering |
| :--- | :--- | :--- |
| **DELIVERED / COMPLETED** | `px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono` | `DELIVERED` (Green) |
| **PENDING / UNPAID** | `px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 font-mono` | `PENDING` (Amber) |
| **CANCELLED / FAILED** | `px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 font-mono` | `CANCELLED` (Rose) |
| **PHONE BADGE** | `font-mono text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200` | `+60123456789` |
| **OUTREACH COUNTER** | `px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200` | `0 Sent` / `1 Sent` |

---

## 8. Geometry & Spacing Rules

* **Border Radius Hierarchy**:
  * Outer Cards / Modal Shells: `rounded-2xl` (16px)
  * Inner Info Blocks, Inputs, Textareas, & Buttons: `rounded-xl` (12px)
  * Small Badges & Table Buttons: `rounded-lg` (8px)
  * Status Pills: `rounded-full` (9999px)
* **Shadow Hierarchy**:
  * Inputs & Secondary Buttons: `shadow-2xs`
  * Action Buttons & Inset Badges: `shadow-xs`
  * Dashboard Metric Cards: `shadow-sm`
  * Modals, Dropdowns & Tooltips: `shadow-2xl`
* **Typography**:
  * Display & Section Headers: `font-extrabold` (800) / `font-bold` (700)
  * Data, Phone Numbers, Order IDs: `font-mono` (monospace)
  * Body & Paragraphs: `font-medium` (500)
