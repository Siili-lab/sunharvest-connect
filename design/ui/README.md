# UI/UX Design System

## Design Principles

### 1. Farmer-First Design
- **Simple**: Maximum 3 taps to complete any action
- **Visual**: Icons and images over text where possible
- **Forgiving**: Easy to undo, hard to make mistakes
- **Accessible**: Large touch targets (min 48x48dp)

### 2. Offline-Ready
- All critical flows work without internet
- Clear indicators for sync status
- Graceful degradation

### 3. Bilingual
- All text available in English and Swahili
- Language can be changed anytime
- Numbers and dates localized

---

## Color System

See `mobile/src/theme/colors.ts` for full palette.

| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Gold) | #FFC107 | CTAs, highlights |
| Secondary (Green) | #4CAF50 | Success, agriculture theme |
| Premium Grade | #4CAF50 | Quality indicator |
| Grade A | #8BC34A | Quality indicator |
| Grade B | #FFC107 | Quality indicator |
| Reject | #F44336 | Quality indicator |

---

## Typography

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 28sp | Bold | Screen titles |
| H2 | 24sp | SemiBold | Section headers |
| H3 | 20sp | SemiBold | Card titles |
| Body | 16sp | Regular | Main content |
| Caption | 14sp | Regular | Secondary text |
| Button | 16sp | SemiBold | Button labels |

---

## Component Library

### Buttons
- **Primary**: Gold background, dark text
- **Secondary**: Green outline, green text
- **Danger**: Red for destructive actions
- **Minimum size**: 48dp height

### Cards
- White background
- 8dp border radius
- Subtle shadow (elevation 2)
- 16dp padding

### Input Fields
- 48dp height minimum
- Clear labels above
- Helper text below
- Error states in red

---

## Key Screens

### 1. Camera/Grading Screen
```
┌─────────────────────────┐
│  [Back]    Grade Crop   │
├─────────────────────────┤
│                         │
│    ┌─────────────────┐  │
│    │                 │  │
│    │   CAMERA VIEW   │  │
│    │                 │  │
│    │                 │  │
│    └─────────────────┘  │
│                         │
│    [ Guide overlay ]    │
│                         │
├─────────────────────────┤
│                         │
│      (●) CAPTURE        │
│                         │
└─────────────────────────┘
```

### 2. Grade Result Screen
```
┌─────────────────────────┐
│  [Back]    Result       │
├─────────────────────────┤
│    ┌─────────────────┐  │
│    │   [Photo]       │  │
│    └─────────────────┘  │
│                         │
│    ╔═════════════════╗  │
│    ║   GRADE A       ║  │
│    ║   92% confident ║  │
│    ╚═════════════════╝  │
│                         │
│    Suggested Price:     │
│    KES 90 - 100/kg      │
│                         │
├─────────────────────────┤
│  [Dispute]  [List Now]  │
└─────────────────────────┘
```

### 3. Marketplace Listing
```
┌─────────────────────────┐
│  [Back]    Marketplace  │
├─────────────────────────┤
│  [Filter] [Search...]   │
├─────────────────────────┤
│  ┌─────────────────────┐│
│  │[img] Tomatoes       ││
│  │      Grade A        ││
│  │      50kg @ 95/kg   ││
│  │      Embu           ││
│  └─────────────────────┘│
│  ┌─────────────────────┐│
│  │[img] Mangoes        ││
│  │      Premium        ││
│  │      30kg @ 120/kg  ││
│  │      Machakos       ││
│  └─────────────────────┘│
└─────────────────────────┘
```

---

## Figma Files

Design files should be stored in:
- `design/figma/` - Figma export files
- `design/assets/` - Exported icons and images
- `design/prototypes/` - Interactive prototype links

---

## Accessibility Checklist

- [ ] Color contrast ratio ≥ 4.5:1 for text
- [ ] Touch targets ≥ 48x48dp
- [ ] Labels for all form inputs
- [ ] Error messages are descriptive
- [ ] Screen reader compatible
- [ ] Supports dynamic text sizing
