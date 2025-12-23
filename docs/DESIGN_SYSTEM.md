# mixmi Design System
*Established January 2025 - Based on Upload Form Improvements*

## Overview
This design system documents the visual principles, spacing standards, and UI patterns established during the upload form optimization. These standards should be applied consistently across all edit forms, modals, and user interfaces throughout the application.

---

## 🎨 Visual Hierarchy

### Step Titles (Primary Headers)
**Purpose:** Main navigation anchors for multi-step processes
```css
className="text-2xl font-semibold text-white"
```
**Usage:**
- Use for step titles in wizards/multi-step forms
- Should be the most prominent text on the page
- Always center-aligned
- One clear action per step title

**Examples:**
- "Basic Information"
- "File Uploads" 
- "Connect to Release (Optional)"

### Section Headers (Secondary)
**Purpose:** Organize content within a step
```css
className="text-base font-medium text-white mb-2"
```
**Usage:**
- Subsections within a step
- Always include relevant emoji for visual interest
- Left-aligned

**Examples:**
- "💡 IDEA RIGHTS (Composition)"
- "🔧 IMPLEMENTATION RIGHTS (Sound Recording)"

### Field Labels (Tertiary)
**Purpose:** Form field identification
```css
className="block text-sm font-normal text-gray-300 mb-2"
```

### Helper Text
**Purpose:** Additional guidance below inputs
```css
className="text-xs font-normal text-gray-400 mt-1"
```

### Placeholder Text
**Purpose:** Input hints and examples
```css
placeholder-gray-500
```

**Usage Guidelines:**
- Every form input should have a clear label
- Use `(optional)` suffix in gray-500 for non-required fields
- Keep labels concise and descriptive
- Use helper text sparingly - only when truly needed
- Placeholder text should be examples, not instructions

---

## 📏 Spacing Standards

### Container Spacing
```css
space-y-6    // Main container spacing (24px) - USE SPARINGLY
space-y-4    // Standard container spacing (16px) - PREFERRED
space-y-3    // Compact spacing (12px)
space-y-2    // Tight spacing (8px)
```

### Navigation Spacing
```css
pt-8         // Space above navigation buttons (32px)
border-t     // Always include divider line above navigation
```

### Form Content
- **NO** minimum height constraints that create artificial empty space
- Let content dictate container height naturally
- Use consistent `space-y-4` for form sections

### Button Groupings
```css
gap-6        // Space between navigation buttons
```

---

## 🎯 Content Strategy

### Eliminate Redundancy
**Rules:**
1. **Never repeat the step title** within the step content
2. **Avoid redundant explanatory text** when the UI is self-explanatory
3. **Remove introductory phrases** like "Your track will be available for:"
4. **Trust the user** - clear UI doesn't need excessive explanation

**Before/After Examples:**

❌ **Before:**
```
Step Title: "Licensing & Pricing"
Content: "LICENSING & PRICING
         Your track will be available for:
         [options]"
```

✅ **After:**
```
Step Title: "Licensing & Pricing"  
Content: [options directly]
```

### Content Hierarchy
1. **Step Title** (most prominent)
2. **Direct content** (no redundant headers)
3. **Field labels** (clear and concise)

---

## 🎨 Visual Consistency

### Icons vs Emojis
**Standard:** Use Lucide React icons for interactive elements

```tsx
// ✅ Correct - Professional icons
import { Upload, Music, Settings } from "lucide-react";
<Upload size={24} className="mx-auto mb-2 text-gray-400" />
<Music size={24} className="mx-auto mb-4 text-gray-400" />

// ❌ Avoid - Emojis for functional elements  
<div className="text-4xl">🎵</div>
```

**Icon Standards:**
- Size: `24px` for upload/action icons
- Color: `text-gray-400` for inactive state
- Positioning: `mx-auto` for centered icons
- Spacing: `mb-2` or `mb-4` below icons

**Emoji Usage:**
- ✅ Use for **section headers** to add visual interest ("💡 IDEA RIGHTS")
- ❌ Avoid for **interactive elements** or **upload areas**

### Color Usage Rules
```css
// Text Hierarchy
text-white           // Primary text (step titles, active states)
text-gray-300        // Secondary text (labels, body text)
text-gray-400        // Tertiary text (helper text, inactive icons)
text-gray-500        // Placeholder text and optional indicators ONLY

// Accent Color (#81E4F2)
border-[#81E4F2]     // ✅ Borders and focus states
text-[#81E4F2]       // ✅ Links and active tab states
bg-[#81E4F2]         // ❌ AVOID - Use for borders, not fills

// Backgrounds
bg-slate-800         // Form inputs
bg-slate-700         // Inactive buttons  
bg-slate-900/50      // Nested containers
bg-white             // Active toggle buttons (text becomes slate-900)
```

**Critical Rule:** Accent color (#81E4F2) should only be used for borders and text, never as background fills.

---

## 📱 Form Components

### Input Field Heights & Padding
```css
// Standard Text Inputs - Compact but comfortable
py-1.5 px-3         // Preferred for most inputs (12px vertical)
py-2                // For textareas and larger inputs (16px vertical)

// Interactive Elements
py-1 px-3           // Toggle buttons (compact)
py-1.5 px-4         // Navigation buttons (balanced)
```

### Input Fields
```tsx
// Standard input field
className="w-full py-1.5 px-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2]"

// Textarea
className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2]"
```

### Toggle Buttons (Song/Loop, Upload/URL)
```tsx
className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
  isActive 
    ? 'bg-white text-slate-900'
    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
}`}
```

### Navigation Buttons
```tsx
// Previous/Next buttons
className="px-4 py-1.5 bg-slate-800 text-gray-400 rounded-lg hover:bg-slate-700 hover:text-white transition-colors font-medium"

// Primary action (Create/Submit)
className="px-4 py-1.5 bg-[#101726] text-white border-2 border-white rounded-lg font-semibold hover:bg-[#1a2030] hover:scale-105 transition-all"
```

### Upload Areas
```tsx
// Standard upload dropzone
className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center"

// With professional icon
<Music size={24} className="mx-auto mb-4 text-gray-400" />
```

---

## 🚀 Implementation Checklist

When working on any edit form or modal, verify:

### ✅ Visual Hierarchy
- [ ] Step titles use `text-2xl font-semibold`
- [ ] Section headers use `text-base font-medium` with emojis
- [ ] Field labels use `text-sm font-normal text-gray-300`
- [ ] Optional fields marked with `(optional)` in gray-500

### ✅ Spacing
- [ ] Containers use `space-y-4` (avoid space-y-6 unless necessary)
- [ ] Navigation has `pt-8` spacing above border
- [ ] No artificial min-height constraints
- [ ] Consistent button gaps (`gap-6`)

### ✅ Content
- [ ] No redundant step title repetition
- [ ] No unnecessary explanatory text
- [ ] Self-explanatory UI without verbose instructions
- [ ] Clear, concise field labels

### ✅ Visual Consistency  
- [ ] Lucide React icons for interactive elements (24px, gray-400)
- [ ] Emojis only for section headers, not functional elements
- [ ] Consistent color usage (white, gray-300, gray-400, gray-500)
- [ ] Standard component styling (inputs, buttons, toggles)

---

## 📋 Form Audit Targets

Based on this design system, prioritize auditing these forms:

### High Priority
1. **Profile Edit Forms** - User bio, contact info, etc.
2. **Store Configuration** - Store settings and customization
3. **Collection Management** - Adding/editing collections

### Medium Priority  
4. **Settings Modals** - App preferences and configuration
5. **Account Management** - Security, notifications, etc.

### Low Priority
6. **Administrative Forms** - Less frequent user interactions

---

## 🎯 Success Metrics

A well-implemented form should:
- Feel **professional and cohesive** 
- Have **clear visual hierarchy** with no confusion about primary actions
- **Eliminate cognitive load** through self-explanatory design
- **Maintain consistency** with this established design language
- **Respect user attention** by removing redundant content

---

*This design system is a living document. Update it as we refine and expand the design language.*