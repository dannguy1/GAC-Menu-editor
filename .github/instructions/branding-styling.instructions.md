---
description: "Use when creating or styling UI components, screens, or visual elements. Covers GAC brand colors, typography, spacing, and component style recipes for the Menu Editor mobile app."
applyTo: "mobile/**/*.js"
---

# Branding & Styling Quick Reference

Full guide: `docs/03_Branding_Guidelines.md`

## Colors

```javascript
const COLORS = {
  // Primary
  gardenGreen: '#5a7a3a',   // Primary actions, save, FAB, active tabs
  harvestGold: '#c8a84b',   // Popular badge, accent highlights
  // Neutral
  charcoal: '#2c2c2c',      // Primary text
  slate: '#555555',          // Body text
  ash: '#666666',            // Secondary text
  silver: '#888888',         // Inactive tabs, placeholders, Vietnamese text
  linen: '#e0d8c8',         // Borders, dividers
  parchment: '#f0ece1',     // Subtle backgrounds
  // Semantic
  errorRed: '#d32f2f',      // Delete, validation errors
  warningAmber: '#f9a825',  // Unsaved changes warning
  infoBlue: '#1976d2',      // Info toasts
  // Editor
  editorTeal: '#2e7d6f',    // Edit mode accent
  formBg: '#faf9f6',        // Form backgrounds
};
```

## Typography

| Element | fontSize | fontWeight | color |
|---------|----------|------------|-------|
| Screen title | 17 | '700' | charcoal |
| Card title | 14 | '700' | charcoal |
| Card price | 14 | '700' | gardenGreen |
| Vietnamese name | 12 | '400' (italic) | silver |
| Button text | 13 | '700' | '#fff' |
| Form label | 14 | '600' | charcoal |
| Form input | 15 | '400' | charcoal |
| Badge text | 11 | '800' | '#fff' |

## Component Recipes

### Card
```javascript
{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0d8c8',
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 }
```

### Primary Button
```javascript
{ backgroundColor: '#5a7a3a', borderRadius: 10, paddingVertical: 14 }
```

### Delete Button
```javascript
{ backgroundColor: '#d32f2f', borderRadius: 10, paddingVertical: 14 }
```

### Form Input
```javascript
{ backgroundColor: '#faf9f6', borderWidth: 1, borderColor: '#e0d8c8', borderRadius: 8,
  paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#2c2c2c' }
// Focused: borderColor: '#5a7a3a', borderWidth: 2
// Error:   borderColor: '#d32f2f'
```

### Badge (Popular)
```javascript
{ backgroundColor: '#c8a84b', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }
// Text: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }
```

## Spacing
- xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32
- Screen padding: 16px horizontal
- Touch targets: minimum 44x44px
