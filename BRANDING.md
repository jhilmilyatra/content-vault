# CloudVault Branding & Logo Update Guide

This guide explains how to update all logos, app names, and branding throughout the project.

---

## Table of Contents

1. [Quick Overview](#quick-overview)
2. [Adding Your Logo File](#adding-your-logo-file)
3. [Update Locations](#update-locations)
4. [Step-by-Step Instructions](#step-by-step-instructions)
5. [Favicon Update](#favicon-update)
6. [Color Scheme Customization](#color-scheme-customization)

---

## Quick Overview

| Location | File | Line Numbers | What to Update |
|----------|------|--------------|----------------|
| Landing Header | `src/components/landing/Header.tsx` | Lines 10, 26-29 | Logo image + App name |
| Landing Footer | `src/components/landing/Footer.tsx` | Lines 8-12 | Logo icon + App name |
| Dashboard Sidebar | `src/components/dashboard/DashboardLayout.tsx` | Lines 145-155 | Logo + App name |
| Browser Tab | `index.html` | Lines 7, 10-12 | Title + Meta tags |
| Favicon | `index.html` + `public/` folder | Line 8 | Favicon image |
| Guest Portal | `src/pages/guest/GuestPortal.tsx` | Search for "CloudVault" | App name text |
| Auth Page | `src/pages/Auth.tsx` | Search for "CloudVault" | App name text |

---

## Adding Your Logo File

### Step 1: Prepare Your Logo

Recommended formats:
- **SVG** - Best for scalability (recommended)
- **PNG** - Good for complex logos with transparency
- **WebP** - Modern format, smaller file size

Recommended sizes:
- Logo: 200x200px minimum (will be displayed at 40x40px typically)
- Favicon: 32x32px, 192x192px, and 512x512px

### Step 2: Add Logo to Project

1. Open the `src/assets/` folder
2. Add your logo file (e.g., `logo.svg`, `logo.png`)
3. For favicon, add to `public/` folder

---

## Step-by-Step Instructions

### 1. Update Landing Page Header

**File:** `src/components/landing/Header.tsx`

```tsx
// Line 10 - Uncomment and update the import
import logo from "@/assets/logo.png";  // Change filename to match yours

// Lines 26-29 - Replace the logo section
<Link to="/" className="flex items-center gap-2">
  <img src={logo} alt="Your App Name" className="w-10 h-10 object-contain" />
  <span className="text-xl font-bold text-foreground">Your App Name</span>
</Link>
```

### 2. Update Landing Page Footer

**File:** `src/components/landing/Footer.tsx`

**Find (around lines 8-12):**
```tsx
<div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
  <Cloud className="w-6 h-6 text-primary-foreground" />
</div>
<span className="text-xl font-bold">CloudVault</span>
```

**Replace with:**
```tsx
import logo from "@/assets/logo.png";  // Add this import at top of file

// Then replace the logo div with:
<img src={logo} alt="Your App Name" className="w-10 h-10 object-contain" />
<span className="text-xl font-bold">Your App Name</span>
```

### 3. Update Dashboard Sidebar

**File:** `src/components/dashboard/DashboardLayout.tsx`

**Find the logo section (around lines 145-155):**
```tsx
<div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
  <Cloud className="w-5 h-5 text-primary-foreground" />
</div>
{!collapsed && (
  <span className="text-lg font-bold">CloudVault</span>
)}
```

**Replace with:**
```tsx
import logo from "@/assets/logo.png";  // Add this import at top of file

// Then replace with:
<img src={logo} alt="Your App Name" className="w-8 h-8 object-contain" />
{!collapsed && (
  <span className="text-lg font-bold">Your App Name</span>
)}
```

### 4. Update Browser Tab & Meta Tags

**File:** `index.html`

```html
<!-- Line 7 - Update title -->
<title>Your App Name - Your Tagline</title>

<!-- Lines 10-12 - Update meta description -->
<meta name="description" content="Your app description here" />
<meta name="application-name" content="Your App Name" />

<!-- Lines 16-19 - Update Open Graph tags -->
<meta property="og:title" content="Your App Name" />
<meta property="og:description" content="Your app description" />
<meta property="og:site_name" content="Your App Name" />

<!-- Lines 22-23 - Update Twitter tags -->
<meta name="twitter:title" content="Your App Name" />
<meta name="twitter:description" content="Your app description" />
```

---

## Favicon Update

### Step 1: Create Favicon Files

Create these sizes from your logo:
- `favicon.ico` - 32x32px (legacy browsers)
- `favicon.png` - 32x32px (modern browsers)
- `apple-touch-icon.png` - 180x180px (iOS)
- `icon-192.png` - 192x192px (Android/PWA)
- `icon-512.png` - 512x512px (PWA splash)

**Tools to create favicons:**
- [Favicon.io](https://favicon.io/) - Free online generator
- [RealFaviconGenerator](https://realfavicongenerator.net/) - Comprehensive generator

### Step 2: Add to Public Folder

Place all favicon files in the `public/` folder.

### Step 3: Update index.html

**File:** `index.html`

Replace the favicon line with:
```html
<!-- Basic favicon -->
<link rel="icon" href="/favicon.png" type="image/png" />

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<!-- For PWA (optional) -->
<link rel="manifest" href="/manifest.json" />
```

---

## Color Scheme Customization

To match your brand colors, update these files:

### Primary Colors

**File:** `src/index.css`

Find the `:root` and `.dark` sections and update:

```css
:root {
  --primary: 220 90% 56%;        /* Your primary brand color in HSL */
  --primary-foreground: 0 0% 100%;
  
  /* Gradient colors */
  --gradient-start: 220 90% 56%;
  --gradient-end: 280 90% 60%;
}

.dark {
  --primary: 220 90% 60%;        /* Slightly brighter for dark mode */
  --primary-foreground: 0 0% 100%;
}
```

### Converting Colors to HSL

Use this tool: [HSL Color Picker](https://hslpicker.com/)

Example conversions:
- Blue (#3B82F6) → `217 91% 60%`
- Green (#22C55E) → `142 71% 45%`
- Purple (#8B5CF6) → `258 90% 66%`

---

## All Text Replacements

Search and replace "CloudVault" in these files:

| File | Occurrences | Context |
|------|-------------|---------|
| `src/components/landing/Header.tsx` | 1 | Header logo text |
| `src/components/landing/Footer.tsx` | 2 | Footer logo + copyright |
| `src/components/dashboard/DashboardLayout.tsx` | 1 | Sidebar logo |
| `src/pages/Auth.tsx` | ~2 | Auth page branding |
| `src/pages/Index.tsx` | ~3 | Landing page content |
| `src/pages/guest/GuestPortal.tsx` | ~2 | Guest portal header |
| `index.html` | ~5 | Meta tags & title |

### Quick Find & Replace

In your code editor:
1. Press `Ctrl+Shift+H` (Windows) or `Cmd+Shift+H` (Mac)
2. Search for: `CloudVault`
3. Replace with: `Your App Name`
4. Review each replacement before confirming

---

## Checklist

- [ ] Logo file added to `src/assets/`
- [ ] Header.tsx logo updated
- [ ] Footer.tsx logo updated
- [ ] DashboardLayout.tsx logo updated
- [ ] Favicon files added to `public/`
- [ ] index.html favicon link updated
- [ ] index.html title updated
- [ ] index.html meta tags updated
- [ ] All "CloudVault" text replaced with your app name
- [ ] Colors customized (optional)

---

## Need Help?

If you're using Lovable:
1. Upload your logo image in the chat
2. Ask: "Update all logos with this image and rename the app to [Your Name]"

Lovable will automatically update all the files for you!
