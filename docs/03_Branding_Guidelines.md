# Branding Guidelines

## 1. Brand Identity

### 1.1 Product Name

**GAC Menu Editor**

- Full: "GAC Menu Editor — Garlic & Chives Menu Manager"
- Short: "Menu Editor"
- Internal/slug: `gac-menu-editor`
- Bundle ID: `com.garlicandchives.menueditor`

### 1.2 Brand Position

GAC Menu Editor is an **independent product** within the Garlic & Chives (GAC) product family. It is the authoritative tool for menu data management and does not depend on any other GAC application at runtime.

| Product | Role | Relationship |
|---------|------|-------------|
| GAC Menu Editor | Menu data authority | **Producer** — creates and maintains menu data |
| GAC-Concierge | AI waiter | **Consumer** — reads menu data from the editor |
| Future GAC apps | Various | **Consumer** — reads menu data from the editor |

The Menu Editor should carry the GAC visual identity (color palette, typography) so all GAC products feel cohesive, while its editing-focused UI clearly communicates its administrative purpose.

### 1.3 Design Inspirations

The visual language is inspired by the GAC-Concierge mobile app's proven component styling (cards, tabs, color values) but adapted for an editing workflow. No runtime or code dependency exists — the editor extracts design concepts, not code imports.

---

## 2. Color Palette

### 2.1 Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Garden Green** | `#5a7a3a` | 90, 122, 58 | Primary actions, active states, tab indicators, FAB, save buttons |
| **Harvest Gold** | `#c8a84b` | 200, 168, 75 | Badges (popular), accent highlights, secondary actions |
| **Warm White** | `#ffffff` | 255, 255, 255 | Backgrounds, cards |

### 2.2 Neutral Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Charcoal** | `#2c2c2c` | 44, 44, 44 | Primary text, headings |
| **Slate** | `#555555` | 85, 85, 85 | Body text, descriptions |
| **Ash** | `#666666` | 102, 102, 102 | Secondary text |
| **Silver** | `#888888` | 136, 136, 136 | Inactive tab labels, placeholder text, Vietnamese names |
| **Linen** | `#e0d8c8` | 224, 216, 200 | Borders, dividers, card outlines |
| **Parchment** | `#f0ece1` | 240, 236, 225 | Subtle backgrounds, section headers |

### 2.3 Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success Green** | `#5a7a3a` | Save confirmations, connected status (reuse primary) |
| **Error Red** | `#d32f2f` | Validation errors, delete buttons, disconnected status |
| **Warning Amber** | `#f9a825` | Unsaved changes, connection issues |
| **Info Blue** | `#1976d2` | Informational toasts |

### 2.4 Editor Accent

To signal the editing/admin nature of this app (vs. customer-facing products):

| Name | Hex | Usage |
|------|-----|-------|
| **Editor Teal** | `#2e7d6f` | Edit mode header accent, form section headers |
| **Form Background** | `#faf9f6` | Edit form background (slightly warmer than pure white) |

---

## 3. Typography

### 3.1 Font Stack

System fonts (React Native defaults) for performance and native feel:

```
iOS: San Francisco
Android: Roboto
```

No custom fonts required.

### 3.2 Type Scale

| Element | Size | Weight | Color | Example |
|---------|------|--------|-------|---------|
| Screen Title | 17px | 700 (bold) | `#2c2c2c` | "Menu Items" |
| Card Title | 14px | 700 (bold) | `#2c2c2c` | "Honey Walnut Shrimps" |
| Card Price | 14px | 700 (bold) | `#5a7a3a` | "$13.00" |
| Vietnamese Name | 12px | 400 (italic) | `#888888` | "Tôm Walnut Mật Ong" |
| Description | 12px | 400 | `#666666` | "Indulge in our..." |
| Button Text | 13px | 700 (bold) | `#ffffff` | "Save Changes" |
| Tab Label | 13px | 600 (semi-bold) | `#888` / `#5a7a3a` | "🍽 Menu" |
| Badge Text | 10-11px | 800 (extra-bold) | `#ffffff` | "POPULAR" |
| Form Label | 14px | 600 (semi-bold) | `#2c2c2c` | "Item Name (English)" |
| Form Input | 15px | 400 | `#2c2c2c` | User text input |
| Detail Title | 20px | 800 (extra-bold) | `#2c2c2c` | Modal header |
| Detail Price | 20px | 800 (extra-bold) | `#5a7a3a` | Modal price |

---

## 4. Component Styling

### 4.1 Cards

```javascript
card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0d8c8',       // Linen border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,                  // Android shadow
}
```

### 4.2 Buttons

**Primary (Save/Confirm)**:
```javascript
{
    backgroundColor: '#5a7a3a',    // Garden Green
    borderRadius: 8-12,
    paddingVertical: 12-14,
}
```

**Destructive (Delete)**:
```javascript
{
    backgroundColor: '#d32f2f',    // Error Red
    borderRadius: 8-12,
    paddingVertical: 12-14,
}
```

**Secondary (Cancel/Close)**:
```javascript
{
    backgroundColor: 'transparent',
    paddingVertical: 12,
    // Text color: #888
}
```

### 4.3 Badges

```javascript
badge: {
    backgroundColor: '#c8a84b',    // Harvest Gold
    borderRadius: 4,
    paddingHorizontal: 6-8,
    paddingVertical: 2-3,
}
badgeText: {
    color: '#fff',
    fontSize: 10-11,
    fontWeight: '800',
    letterSpacing: 0.5,
}
```

### 4.4 Bottom Tab Bar

```javascript
tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0d8c8',     // Linen border
}
tabIndicator: {
    backgroundColor: '#5a7a3a',    // Garden Green
    height: 3,
    borderRadius: 2,
}
```

### 4.5 Bottom Sheet Modals

```javascript
sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
}
handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
}
```

### 4.6 Form Inputs

```javascript
input: {
    backgroundColor: '#faf9f6',    // Form Background
    borderWidth: 1,
    borderColor: '#e0d8c8',        // Linen
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2c2c2c',
}
inputFocused: {
    borderColor: '#5a7a3a',        // Garden Green focus ring
    borderWidth: 2,
}
inputError: {
    borderColor: '#d32f2f',        // Error Red
}
label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c2c2c',
    marginBottom: 6,
}
```

---

## 5. Iconography

### 5.1 Navigation Icons (Emoji-Based)

| Tab | Icon | Label |
|-----|------|-------|
| Menu | 🍽 | Menu |
| Facts | ℹ️ | Facts |
| Settings | ⚙️ | Settings |

### 5.2 Action Icons

| Action | Icon | Context |
|--------|------|---------|
| Add New | ＋ | FAB button |
| Edit | › | Card chevron |
| Delete | 🗑 | Delete button |
| Camera | 📷 | Photo capture |
| Gallery | 🖼 | Gallery picker |
| Refresh | ↺ | Title bar refresh |
| Popular | ⭐ | Popular badge |
| Save | ✓ | Save confirmation |
| Back | ← | Navigation back |
| Search | 🔍 | Search bar |
| Publish | 📤 | Publish button |
| Export | 📦 | Export ZIP |

### 5.3 App Icon

- Stylized plate/dish with an edit pencil overlay
- Garden Green (`#5a7a3a`) as the dominant color
- White background for the adaptive icon
- Unique to this product — not reused from any other GAC app

---

## 6. Spacing & Layout

### 6.1 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Badge padding, tight gaps |
| `sm` | 8px | Card internal gaps, icon margins |
| `md` | 12px | Card padding, input padding |
| `lg` | 16px | Screen horizontal padding, section gaps |
| `xl` | 20px | Modal body padding |
| `xxl` | 32px | Section separators |

### 6.2 Touch Targets

Minimum interactive element size: **44 × 44 points** (per platform HIG).

### 6.3 Screen Padding

- Horizontal: 16px
- List item gap: 12px
- Section gap: 24px

---

## 7. Visual Identity vs. Other GAC Products

The Menu Editor shares the GAC color palette for brand cohesion but is visually distinct in its editing focus:

| Aspect | Customer-Facing Apps | Menu Editor |
|--------|---------------------|-------------|
| Primary action | "Add to Order", "Ask AI" | "Save Changes", "Publish" |
| Card interaction | Tap to view detail | Tap to edit form |
| Bottom tabs | Chat \| Menu \| Order | Menu \| Facts \| Settings |
| Image interaction | View only | Tap to replace (camera/gallery) |
| FAB | None | ＋ Add New Item/Fact |
| Header accent | None (clean white) | Subtle teal tint on edit screens |
| Content area | Read-only cards | Editable form fields |
| Publish section | N/A | Prominent in Settings |

---

## 8. Motion & Feedback

### 8.1 Transitions

- Screen transitions: `slide` (left/right for navigation, bottom for modals)
- Tab switches: Instant (no animation)
- List updates: FlatList default animations

### 8.2 Feedback

| Action | Feedback |
|--------|----------|
| Save success | Green toast: "Item saved successfully" (2s auto-dismiss) |
| Save error | Red toast: "Failed to save. Check connection." (3s) |
| Delete confirm | `Alert.alert` confirmation dialog |
| Delete success | Green toast: "Item deleted" (2s) |
| Publish success | Green toast: "Published to 1 target" (2s) |
| Publish partial | Amber toast: "Published: 1 ok, 1 failed" (3s) |
| Connection test pass | Green status dot + toast |
| Connection test fail | Red status dot + error message |
| Form validation error | Red border on invalid field + inline error text |
| Image upload progress | Activity indicator overlay on image area |

### 8.3 Loading States

- List loading: `ActivityIndicator` centered
- Save in progress: Button shows spinner, disabled
- Image upload: Overlay spinner on image preview area
- Publish in progress: Spinner on Publish button with per-target status updates
