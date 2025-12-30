# 📁 SecureFiles - Complete Folder Structure

> **Last Updated:** December 2024  
> **Version:** 1.1.0  
> **Purpose:** Comprehensive file-by-file documentation for debugging, maintenance, and feature development

---

## 📋 Table of Contents

1. [Root Directory](#root-directory)
2. [Source Code (src/)](#source-code-src)
3. [Components (src/components/)](#components-srccomponents)
4. [Pages (src/pages/)](#pages-srcpages)
5. [Hooks (src/hooks/)](#hooks-srchooks)
6. [Contexts (src/contexts/)](#contexts-srccontexts)
7. [Libraries (src/lib/)](#libraries-srclib)
8. [Integrations (src/integrations/)](#integrations-srcintegrations)
9. [Backend Functions (supabase/functions/)](#backend-functions-supabasefunctions)
10. [VPS Storage Server](#vps-storage-server)
11. [Configuration Files](#configuration-files)

---

## Root Directory

```
SecureFiles/
├── 📄 .env                    # Environment variables (auto-generated, DO NOT EDIT)
├── 📄 Dockerfile              # Docker container configuration for deployment
├── 📄 docker-compose.yml      # Docker Compose orchestration file
├── 📄 docker-entrypoint.sh    # Docker startup script
├── 📄 eslint.config.js        # ESLint linting configuration
├── 📄 index.html              # Main HTML entry point
├── 📄 package.json            # NPM dependencies and scripts (READ-ONLY)
├── 📄 postcss.config.js       # PostCSS configuration for Tailwind
├── 📄 tailwind.config.ts      # Tailwind CSS theme and design tokens
├── 📄 tsconfig.json           # TypeScript compiler configuration
├── 📄 vite.config.ts          # Vite build tool configuration
├── 📄 README.md               # Project documentation and setup guide
├── 📄 FOLDERSTRUCTURE.md      # This file - folder structure documentation
├── 📁 public/                 # Static assets
├── 📁 src/                    # Source code
├── 📁 supabase/               # Backend configuration and functions
└── 📁 vps-storage-server/     # VPS file storage backend
```

### Root File Descriptions

| File | Purpose | When to Modify |
|------|---------|----------------|
| `.env` | Contains Supabase URL, keys, project ID | **NEVER** - Auto-generated |
| `Dockerfile` | Production Docker image build | Deployment changes |
| `docker-compose.yml` | Multi-container orchestration | Adding services |
| `docker-entrypoint.sh` | Container startup commands | Startup logic changes |
| `eslint.config.js` | Code linting rules | Coding standards |
| `index.html` | SPA entry HTML | Meta tags, fonts |
| `tailwind.config.ts` | Design system colors, fonts | UI theming |
| `vite.config.ts` | Build configuration, plugins | Build process |

---

## Source Code (src/)

```
src/
├── 📄 App.css                 # Global application styles
├── 📄 App.tsx                 # Main application component with routing
├── 📄 index.css               # Tailwind CSS imports and design tokens
├── 📄 main.tsx                # React application entry point
├── 📄 vite-env.d.ts           # Vite TypeScript declarations
├── 📁 assets/                 # Images, icons, static resources
├── 📁 components/             # Reusable UI components
├── 📁 contexts/               # React context providers
├── 📁 hooks/                  # Custom React hooks
├── 📁 integrations/           # Third-party integrations (Supabase)
├── 📁 lib/                    # Utility libraries and services
└── 📁 pages/                  # Route page components
```

### Core Source Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `App.tsx` | Root component, routing setup | Route definitions, theme provider, query client |
| `main.tsx` | React DOM render entry | Mounts App to DOM |
| `index.css` | CSS design tokens | Colors, shadows, animations, Tailwind base |
| `App.css` | Additional global styles | Custom animations, global utilities |

---

## Components (src/components/)

### Directory Overview

```
src/components/
├── 📁 auth/                   # Authentication components
│   └── 📄 ProtectedRoute.tsx  # Route guard for authenticated users
├── 📁 chat/                   # Chat/messaging components
│   ├── 📄 ReadReceipt.tsx     # Message read status indicator
│   └── 📄 TypingIndicator.tsx # "User is typing..." animation
├── 📁 dashboard/              # Dashboard UI components
│   ├── 📄 DashboardLayout.tsx # Main dashboard layout wrapper
│   ├── 📄 MemberChatPanel.tsx # Chat panel for member-guest messaging
│   ├── 📄 NotificationDropdown.tsx # Notification bell dropdown
│   └── 📄 TrialBanner.tsx     # Subscription trial notification
├── 📁 files/                  # File management components
│   ├── 📄 BulkActionsBar.tsx  # Multi-select action toolbar
│   ├── 📄 FilePreviewModal.tsx # File preview dialog
│   ├── 📄 ShareDialog.tsx     # File sharing modal
│   └── 📄 ShareFolderDialog.tsx # Folder sharing modal
├── 📁 guest/                  # Guest portal components
│   ├── 📄 GuestFilePreviewModal.tsx # Guest file preview
│   └── 📄 ZipProgressModal.tsx # ZIP download progress indicator
├── 📁 landing/                # Landing page components
│   ├── 📄 CTA.tsx             # Call-to-action section
│   ├── 📄 Features.tsx        # Features showcase
│   ├── 📄 Footer.tsx          # Page footer
│   ├── 📄 Header.tsx          # Navigation header
│   ├── 📄 Hero.tsx            # Hero banner section
│   └── 📄 RoleHierarchy.tsx   # Role visualization
├── 📁 ui/                     # Shadcn UI components (50+ files)
│   └── [See UI Components section below]
└── 📄 NavLink.tsx             # Navigation link component
```

### Component Details

#### auth/ - Authentication Components

| File | Purpose | Props | Used By |
|------|---------|-------|---------|
| `ProtectedRoute.tsx` | Guards routes requiring authentication | `children`, `requiredRole?` | `App.tsx` routing |

**Debug Tips:**
- Check `useAuth()` hook for authentication state
- Verify role checking logic for admin/owner access

#### chat/ - Chat Components

| File | Purpose | Props | Used By |
|------|---------|-------|---------|
| `ReadReceipt.tsx` | Shows if message was read | `isRead`, `readAt` | Chat messages |
| `TypingIndicator.tsx` | Animated typing dots | `isTyping` | Chat panels |

**Debug Tips:**
- Real-time updates via Supabase `typing_indicators` table
- Check `useTypingIndicator` hook for state management

#### dashboard/ - Dashboard Components

| File | Purpose | Key Features | Used By |
|------|---------|--------------|---------|
| `DashboardLayout.tsx` | Main layout with sidebar | Navigation, responsive sidebar | All dashboard pages |
| `MemberChatPanel.tsx` | Member-guest messaging | Real-time messages, file sharing | `Dashboard.tsx` |
| `NotificationDropdown.tsx` | Notification center | Unread count badge, mark as read | Header |
| `TrialBanner.tsx` | Subscription reminder | Days remaining, upgrade CTA | Dashboard |

**Debug Tips:**
- Layout issues → Check `DashboardLayout.tsx` responsive classes
- Notification not updating → Check `member_notifications` table & RLS

#### files/ - File Management Components

| File | Purpose | Key Features | Used By |
|------|---------|--------------|---------|
| `BulkActionsBar.tsx` | Multi-file actions | Delete, move, download selected | `FileManager.tsx` |
| `FilePreviewModal.tsx` | File viewer dialog | Image/video/PDF preview | `FileManager.tsx` |
| `ShareDialog.tsx` | Single file sharing | Password, expiry, link generation | `FileManager.tsx` |
| `ShareFolderDialog.tsx` | Folder sharing | Share code generation | `FileManager.tsx` |

**Debug Tips:**
- Preview not loading → Check VPS proxy endpoint
- Share link invalid → Verify `shared_links` table entry

#### guest/ - Guest Portal Components

| File | Purpose | Key Features | Used By |
|------|---------|--------------|---------|
| `GuestFilePreviewModal.tsx` | Guest file viewer | Streaming from VPS | `GuestFolderView.tsx` |
| `ZipProgressModal.tsx` | ZIP download progress | File count, size, elapsed time | `GuestFolderView.tsx` |

**Debug Tips:**
- ZIP failing → Check `guest-folder-zip` edge function logs
- Large files → VPS must be used, not Supabase proxy

#### landing/ - Landing Page Components

| File | Purpose | Section |
|------|---------|---------|
| `CTA.tsx` | Call-to-action | Bottom signup prompt |
| `Features.tsx` | Feature cards | Product features grid |
| `Footer.tsx` | Page footer | Links, copyright |
| `Header.tsx` | Navigation | Logo, nav links, auth buttons |
| `Hero.tsx` | Hero section | Main headline, CTA button |
| `RoleHierarchy.tsx` | Role diagram | Owner/Admin/Member/Guest visual |

#### ui/ - Shadcn UI Components

```
src/components/ui/
├── accordion.tsx      # Expandable sections
├── alert-dialog.tsx   # Confirmation dialogs
├── alert.tsx          # Alert banners
├── avatar.tsx         # User avatars
├── badge.tsx          # Status badges
├── breadcrumb.tsx     # Navigation breadcrumbs
├── button.tsx         # Button variants
├── calendar.tsx       # Date picker calendar
├── card.tsx           # Card containers
├── checkbox.tsx       # Checkbox input
├── collapsible.tsx    # Collapsible sections
├── command.tsx        # Command palette
├── context-menu.tsx   # Right-click menus
├── dialog.tsx         # Modal dialogs
├── drawer.tsx         # Slide-out panels
├── dropdown-menu.tsx  # Dropdown menus
├── form.tsx           # Form components
├── hover-card.tsx     # Hover tooltips
├── input-otp.tsx      # OTP input fields
├── input.tsx          # Text inputs
├── label.tsx          # Form labels
├── menubar.tsx        # Menu bar
├── navigation-menu.tsx # Navigation menus
├── pagination.tsx     # Page navigation
├── popover.tsx        # Popover tooltips
├── progress.tsx       # Progress bars
├── radio-group.tsx    # Radio buttons
├── resizable.tsx      # Resizable panels
├── scroll-area.tsx    # Scrollable areas
├── select.tsx         # Select dropdowns
├── separator.tsx      # Divider lines
├── sheet.tsx          # Side sheets
├── sidebar.tsx        # Sidebar navigation
├── skeleton.tsx       # Loading skeletons
├── slider.tsx         # Range sliders
├── sonner.tsx         # Toast notifications
├── switch.tsx         # Toggle switches
├── table.tsx          # Data tables
├── tabs.tsx           # Tab panels
├── textarea.tsx       # Multi-line input
├── toast.tsx          # Toast messages
├── toaster.tsx        # Toast container
├── toggle-group.tsx   # Toggle button groups
├── toggle.tsx         # Toggle buttons
├── tooltip.tsx        # Tooltips
└── use-toast.ts       # Toast hook
```

**UI Component Notes:**
- All components use design tokens from `index.css`
- Customize variants in individual component files
- Never use direct colors like `text-white`, use semantic tokens

---

## Pages (src/pages/)

### Directory Overview

```
src/pages/
├── 📁 admin/                  # Admin-only pages
│   ├── 📄 AdminDashboard.tsx  # Admin overview dashboard
│   ├── 📄 AdminUserManagement.tsx # User management
│   └── 📄 ReportManagement.tsx # Report handling
├── 📁 dashboard/              # Member dashboard pages
│   └── 📄 GuestManagement.tsx # Guest access management
├── 📁 guest/                  # Guest portal pages
│   ├── 📄 GuestAuth.tsx       # Guest login page
│   ├── 📄 GuestFolderView.tsx # Folder browsing
│   ├── 📄 GuestHelpDesk.tsx   # Guest messaging
│   └── 📄 GuestPortal.tsx     # Guest dashboard home
├── 📁 owner/                  # Owner-only pages
│   ├── 📄 AdminPermissions.tsx # Admin permission grants
│   ├── 📄 AuditLogs.tsx       # System audit trail
│   ├── 📄 BillingOverview.tsx # Billing dashboard
│   ├── 📄 OwnerDashboard.tsx  # Owner home
│   ├── 📄 OwnerGuestControls.tsx # Global guest settings
│   ├── 📄 OwnerMemberChat.tsx # Owner-member messaging
│   ├── 📄 SecuritySettings.tsx # Security configuration
│   ├── 📄 StorageSettings.tsx # Storage management
│   ├── 📄 UserAnalytics.tsx   # User statistics
│   └── 📄 UserManagement.tsx  # Full user control
├── 📄 Analytics.tsx           # Usage analytics
├── 📄 Auth.tsx                # Login/signup page
├── 📄 Dashboard.tsx           # Main member dashboard
├── 📄 FileManager.tsx         # File/folder management
├── 📄 Index.tsx               # Landing page
├── 📄 NotFound.tsx            # 404 error page
├── 📄 Plans.tsx               # Subscription plans
├── 📄 Settings.tsx            # User settings
├── 📄 SharedFile.tsx          # Public shared file view
├── 📄 SharedLinks.tsx         # Manage shared links
├── 📄 TelegramGuide.tsx       # Telegram upload guide
└── 📄 TrashBin.tsx            # Deleted files recovery
```

### Page Details

#### Root Pages

| File | Route | Purpose | Auth Required | Role |
|------|-------|---------|---------------|------|
| `Index.tsx` | `/` | Landing page | No | - |
| `Auth.tsx` | `/auth` | Login/Signup | No | - |
| `Dashboard.tsx` | `/dashboard` | Member home | Yes | member+ |
| `FileManager.tsx` | `/files`, `/files/:folderId` | File browser | Yes | member+ |
| `Analytics.tsx` | `/analytics` | Usage stats | Yes | member+ |
| `Settings.tsx` | `/settings` | User settings | Yes | member+ |
| `Plans.tsx` | `/plans` | Subscriptions | Yes | member+ |
| `SharedLinks.tsx` | `/shared-links` | Link management | Yes | member+ |
| `SharedFile.tsx` | `/s/:shortCode` | Public file view | No | - |
| `TrashBin.tsx` | `/trash` | Deleted files | Yes | member+ |
| `TelegramGuide.tsx` | `/telegram-guide` | Upload guide | Yes | member+ |
| `NotFound.tsx` | `*` | 404 page | No | - |

#### admin/ - Admin Pages

| File | Route | Purpose | Features |
|------|-------|---------|----------|
| `AdminDashboard.tsx` | `/admin` | Admin overview | System stats, quick actions |
| `AdminUserManagement.tsx` | `/admin/users` | User control | Suspend, view files |
| `ReportManagement.tsx` | `/admin/reports` | Report handling | Review, resolve reports |

**Admin Access Control:**
- Requires `admin` or `owner` role
- Permissions checked via `admin_permissions` table
- Owner grants specific permissions to admins

#### guest/ - Guest Portal Pages

| File | Route | Purpose | Auth |
|------|-------|---------|------|
| `GuestAuth.tsx` | `/guest/auth` | Guest login | Guest credentials |
| `GuestPortal.tsx` | `/guest/portal` | Guest home | Guest session |
| `GuestFolderView.tsx` | `/guest/folder/:shareId` | Browse files | Guest session |
| `GuestHelpDesk.tsx` | `/guest/help` | Message member | Guest session |

**Guest Auth Flow:**
1. Guest enters share code at `/guest/auth`
2. Calls `guest-signin` edge function
3. Sets session in `GuestAuthContext`
4. Redirects to `/guest/portal`

#### owner/ - Owner Pages

| File | Route | Purpose | Features |
|------|-------|---------|----------|
| `OwnerDashboard.tsx` | `/owner` | Owner home | Full system overview |
| `UserManagement.tsx` | `/owner/users` | All users | CRUD operations |
| `AdminPermissions.tsx` | `/owner/permissions` | Admin grants | Permission toggles |
| `AuditLogs.tsx` | `/owner/audit` | Activity log | Action history |
| `BillingOverview.tsx` | `/owner/billing` | Billing info | Subscription management |
| `SecuritySettings.tsx` | `/owner/security` | Security config | Session, 2FA settings |
| `StorageSettings.tsx` | `/owner/storage` | Storage config | VPS settings, quotas |
| `UserAnalytics.tsx` | `/owner/analytics` | User stats | Charts, metrics |
| `OwnerMemberChat.tsx` | `/owner/chat` | Member messaging | Real-time chat |
| `OwnerGuestControls.tsx` | `/owner/guests` | Guest settings | Global guest policies |

---

## Hooks (src/hooks/)

```
src/hooks/
├── 📄 use-mobile.tsx          # Mobile viewport detection
├── 📄 use-toast.ts            # Toast notification hook
├── 📄 useAuth.tsx             # Authentication state & actions
├── 📄 useStorageNodes.ts      # File/folder data fetching
└── 📄 useTypingIndicator.ts   # Real-time typing state
```

### Hook Details

| Hook | Purpose | Returns | Used By |
|------|---------|---------|---------|
| `useAuth()` | Auth state management | `user`, `role`, `login()`, `logout()` | All authenticated pages |
| `useStorageNodes()` | Fetch files/folders | `files`, `folders`, `isLoading`, `refetch()` | `FileManager.tsx` |
| `useTypingIndicator()` | Typing status | `isTyping`, `setTyping()` | Chat components |
| `useMobile()` | Screen size check | `isMobile: boolean` | Responsive components |
| `useToast()` | Show notifications | `toast()` function | Any component |

### Debug Tips by Hook

**useAuth:**
```typescript
// Check if user is authenticated
const { user, role, isLoading } = useAuth();
console.log('Auth state:', { user?.id, role, isLoading });
```

**useStorageNodes:**
```typescript
// Debug file fetching
const { files, folders, error } = useStorageNodes(folderId);
if (error) console.error('Storage fetch error:', error);
```

---

## Contexts (src/contexts/)

```
src/contexts/
└── 📄 GuestAuthContext.tsx    # Guest authentication context
```

### GuestAuthContext

**Purpose:** Manages guest user authentication separately from main auth

**State:**
```typescript
interface GuestAuthState {
  guest: GuestUser | null;
  isAuthenticated: boolean;
  login: (shareCode: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

**Usage:**
```typescript
import { useGuestAuth } from '@/contexts/GuestAuthContext';

const { guest, isAuthenticated, login, logout } = useGuestAuth();
```

**Debug Tips:**
- Guest session stored in localStorage
- Check `guest_users` table for user data
- Verify `folder_shares` for valid share codes

---

## Libraries (src/lib/)

```
src/lib/
├── 📄 fileService.ts          # File operations service
├── 📄 security.ts             # Security utilities
└── 📄 utils.ts                # General utilities (cn, etc.)
```

### Library Details

| File | Purpose | Key Functions |
|------|---------|---------------|
| `fileService.ts` | File CRUD operations | `uploadFile()`, `deleteFile()`, `moveFile()` |
| `security.ts` | Security helpers | `hashPassword()`, `validateToken()` |
| `utils.ts` | Utility functions | `cn()` for class merging |

---

## Integrations (src/integrations/)

```
src/integrations/
└── 📁 supabase/
    ├── 📄 client.ts           # Supabase client instance (DO NOT EDIT)
    └── 📄 types.ts            # Database types (READ-ONLY, auto-generated)
```

### Supabase Integration

**client.ts** - Auto-generated Supabase client
```typescript
import { supabase } from '@/integrations/supabase/client';

// Use for all database operations
const { data, error } = await supabase.from('files').select('*');
```

**types.ts** - Auto-generated TypeScript types
- Contains all table types, enums, and function types
- **NEVER EDIT** - Generated from database schema
- Import types for type safety:
```typescript
import type { Tables, Enums } from '@/integrations/supabase/types';
```

---

## Backend Functions (supabase/functions/)

### Directory Overview

```
supabase/functions/
├── 📁 admin-suspend-user/     # Suspend user accounts
│   └── 📄 index.ts
├── 📁 create-user/            # Create new users (owner only)
│   └── 📄 index.ts
├── 📁 guest-file-proxy/       # Proxy guest file downloads
│   └── 📄 index.ts
├── 📁 guest-file-stream/      # Stream files to guests
│   └── 📄 index.ts
├── 📁 guest-folder-contents/  # Get folder file list
│   └── 📄 index.ts
├── 📁 guest-folder-zip/       # Create ZIP of folder
│   └── 📄 index.ts
├── 📁 guest-folders/          # List guest folders
│   └── 📄 index.ts
├── 📁 guest-messages/         # Guest messaging API
│   └── 📄 index.ts
├── 📁 guest-register/         # Register new guest
│   └── 📄 index.ts
├── 📁 guest-signin/           # Guest authentication
│   └── 📄 index.ts
├── 📁 owner-update-user/      # Owner user updates
│   └── 📄 index.ts
├── 📁 reset-guest-password/   # Guest password reset
│   └── 📄 index.ts
├── 📁 reset-user-password/    # User password reset
│   └── 📄 index.ts
├── 📁 shared-download/        # Download shared files
│   └── 📄 index.ts
├── 📁 telegram-upload/        # Telegram bot uploads
│   └── 📄 index.ts
├── 📁 verify-share-link/      # Validate share links
│   └── 📄 index.ts
├── 📁 vps-file/               # VPS file operations
│   └── 📄 index.ts
├── 📁 vps-owner-stats/        # VPS storage statistics
│   └── 📄 index.ts
└── 📁 vps-upload/             # Upload files to VPS
    └── 📄 index.ts
```

### Edge Function Details

#### Guest Functions

| Function | Endpoint | Method | Purpose | Auth |
|----------|----------|--------|---------|------|
| `guest-signin` | `/guest-signin` | POST | Authenticate guest | None |
| `guest-register` | `/guest-register` | POST | Register new guest | Share code |
| `guest-folders` | `/guest-folders` | GET | List accessible folders | Guest token |
| `guest-folder-contents` | `/guest-folder-contents` | GET | Get folder files | Guest token |
| `guest-file-proxy` | `/guest-file-proxy` | GET | Download file | Guest token |
| `guest-file-stream` | `/guest-file-stream` | GET | Stream file | Guest token |
| `guest-folder-zip` | `/guest-folder-zip` | GET | Download folder as ZIP | Guest token |
| `guest-messages` | `/guest-messages` | GET/POST | Messaging API | Guest token |
| `reset-guest-password` | `/reset-guest-password` | POST | Reset password | None |

#### Admin Functions

| Function | Endpoint | Method | Purpose | Auth |
|----------|----------|--------|---------|------|
| `admin-suspend-user` | `/admin-suspend-user` | POST | Suspend accounts | Admin JWT |
| `create-user` | `/create-user` | POST | Create users | Owner JWT |
| `owner-update-user` | `/owner-update-user` | POST | Update users | Owner JWT |
| `reset-user-password` | `/reset-user-password` | POST | Reset password | Admin JWT |

#### File Functions

| Function | Endpoint | Method | Purpose | Auth |
|----------|----------|--------|---------|------|
| `vps-upload` | `/vps-upload` | POST | Upload to VPS | User JWT |
| `vps-file` | `/vps-file` | GET/DELETE | VPS file ops | User JWT |
| `vps-owner-stats` | `/vps-owner-stats` | GET | Storage stats | Owner JWT |
| `shared-download` | `/shared-download` | GET | Public download | None/Password |
| `verify-share-link` | `/verify-share-link` | GET | Validate link | None |
| `telegram-upload` | `/telegram-upload` | POST | Telegram uploads | API Token |

### Debugging Edge Functions

**View Logs:**
1. Use Lovable Cloud → Edge Functions → Logs
2. Or use `supabase--edge-function-logs` tool

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing/invalid JWT | Check Authorization header |
| 500 Error | Function crash | Check function logs |
| CORS Error | Missing headers | Add CORS headers to response |
| Timeout | Large file | Use streaming, increase timeout |

---

## VPS Storage Server

```
vps-storage-server/
├── 📄 package.json            # Dependencies
└── 📄 server.js               # Express file server
```

### server.js Features

- **File Upload:** `POST /upload` - Multipart file upload
- **File Download:** `GET /file/:userId/:filename` - Stream files
- **File Delete:** `DELETE /file/:userId/:filename` - Remove files
- **Stats:** `GET /stats/:userId` - Storage usage
- **Health:** `GET /health` - Server status

**Configuration:**
```bash
PORT=3001              # Server port
STORAGE_PATH=/data     # File storage directory
MAX_FILE_SIZE=10GB     # Upload limit
```

---

## Configuration Files

### tailwind.config.ts - Design System

**Key Sections:**
```typescript
theme: {
  extend: {
    colors: {
      // Semantic color tokens
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: { DEFAULT, foreground },
      secondary: { DEFAULT, foreground },
      // ... more tokens
    },
    fontFamily: {
      // Custom fonts
    },
    animation: {
      // Custom animations
    }
  }
}
```

### index.css - CSS Variables

**Key Sections:**
```css
:root {
  /* Light theme tokens */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... more tokens */
}

.dark {
  /* Dark theme tokens */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... more tokens */
}
```

### supabase/config.toml

**Auto-generated** - DO NOT EDIT
- Database configuration
- Auth settings
- Storage settings

---

## 🔧 Quick Debug Reference

### By Feature Area

| Feature | Files to Check | Database Tables |
|---------|----------------|-----------------|
| **Auth Issues** | `useAuth.tsx`, `Auth.tsx` | `profiles`, `user_roles` |
| **File Upload** | `vps-upload/index.ts`, `FileManager.tsx` | `files`, `folders` |
| **Guest Access** | `guest-*.ts`, `GuestAuthContext.tsx` | `guest_users`, `folder_shares`, `guest_folder_access` |
| **Sharing** | `ShareDialog.tsx`, `verify-share-link/` | `shared_links` |
| **Chat** | `MemberChatPanel.tsx`, `guest-messages/` | `guest_messages`, `owner_member_messages` |
| **Admin** | `admin/*.tsx`, `admin-suspend-user/` | `admin_permissions`, `reports` |
| **Subscriptions** | `Plans.tsx`, `TrialBanner.tsx` | `subscriptions` |

### Common Error Patterns

| Error | Likely Cause | Files to Check |
|-------|--------------|----------------|
| "Unauthorized" | JWT expired/missing | `useAuth.tsx`, edge function auth |
| "Not Found" | Wrong route/ID | `App.tsx` routes, database query |
| "CORS Error" | Missing headers | Edge function response headers |
| "RLS Violation" | Policy blocking | Database RLS policies |
| "File Not Found" | VPS path wrong | `vps-file/index.ts`, `storage_path` |

---

## 📝 Maintenance Checklist

### Adding New Feature

1. [ ] Create page in `src/pages/`
2. [ ] Add route in `App.tsx`
3. [ ] Create components in `src/components/`
4. [ ] Add database tables via migration
5. [ ] Create edge functions if needed
6. [ ] Update this documentation

### Modifying Database

1. [ ] Create migration SQL
2. [ ] Add RLS policies
3. [ ] Types auto-regenerate
4. [ ] Update affected queries
5. [ ] Test with different roles

### Debugging Steps

1. [ ] Check browser console
2. [ ] Check network requests
3. [ ] Check edge function logs
4. [ ] Check database data
5. [ ] Check RLS policies
6. [ ] Check VPS server logs

---

*Last updated: December 2024*
*Maintained by: SecureFiles Team*
