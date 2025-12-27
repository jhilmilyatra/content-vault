# FileVault - Enterprise Cloud File Storage & Sharing Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ecf8e)](https://supabase.com/)

A modern, self-hostable file storage and sharing platform built with React, TypeScript, and Supabase. Features a multi-tenant architecture with role-based access control, guest portal system, and VPS storage integration.

---

## 📋 Table of Contents

- [Features Overview](#-features-overview)
- [Architecture](#-architecture)
- [Project Structure](#-complete-project-structure)
- [User Roles & Permissions](#-user-roles--permissions)
- [Feature Documentation](#-feature-documentation)
- [Database Schema](#-database-schema)
- [Edge Functions Reference](#-edge-functions-reference)
- [Quick Start](#-quick-start)
- [Deployment Guide](#-deployment-guide)
- [VPS Storage Setup](#-vps-storage-setup)
- [Environment Variables](#-environment-variables)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## ✨ Features Overview

### Core Features
- 📁 **File Management** - Upload, organize, and manage files with nested folders
- 🔗 **Shareable Links** - Create password-protected or public share links with expiry
- 👥 **Role-Based Access** - Owner, Admin, and Member roles with granular permissions
- 📊 **Analytics Dashboard** - Track downloads, bandwidth, and storage usage
- 🗑️ **Trash & Recovery** - Soft delete with 30-day recovery period
- 🔒 **Security** - Row-level security with Supabase RLS policies

### Guest Portal System
- 👤 **Guest Accounts** - Separate authentication system for external users
- 📂 **Folder Sharing** - Share specific folders with guest users
- 💬 **Real-time Chat** - Guest-to-member messaging with typing indicators
- 📥 **Bulk Download** - Download entire folders as ZIP with progress tracking
- 📱 **Mobile Optimized** - Full mobile-responsive guest experience

### Advanced Features
- 📱 **Telegram Integration** - Upload files via Telegram bot
- 💾 **VPS Storage Extension** - Connect additional VPS storage nodes
- 🔔 **Real-time Notifications** - Live updates for messages and activities
- 📈 **Usage Analytics** - Detailed usage metrics and reporting

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                   │
├─────────────────────────────────────────────────────────────────┤
│  Landing Page  │  Member Dashboard  │  Guest Portal  │  Admin   │
└────────┬───────┴────────┬───────────┴───────┬────────┴────┬─────┘
         │                │                   │              │
         ▼                ▼                   ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                        │
│  (Authentication, File Operations, Guest APIs, Telegram Bot)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
│  Supabase DB    │  │  Supabase    │  │  VPS Storage    │
│  (PostgreSQL)   │  │  Storage     │  │  (Optional)     │
└─────────────────┘  └──────────────┘  └─────────────────┘
```

---

## 📁 Complete Project Structure

```
filevault/
├── 📄 README.md                    # This documentation file
├── 📄 package.json                 # NPM dependencies and scripts
├── 📄 vite.config.ts               # Vite build configuration
├── 📄 tailwind.config.ts           # Tailwind CSS configuration
├── 📄 tsconfig.json                # TypeScript configuration
├── 📄 index.html                   # HTML entry point
├── 📄 .env                         # Environment variables (git-ignored)
├── 📄 Dockerfile                   # Docker containerization
├── 📄 docker-compose.yml           # Docker Compose configuration
├── 📄 docker-entrypoint.sh         # Docker startup script
│
├── 📂 public/                      # Static assets
│   ├── favicon.ico                 # Site favicon
│   ├── robots.txt                  # SEO robots configuration
│   └── placeholder.svg             # Placeholder images
│
├── 📂 src/                         # Frontend source code
│   ├── 📄 main.tsx                 # React app entry point
│   ├── 📄 App.tsx                  # Main App component with routing
│   ├── 📄 App.css                  # Global app styles
│   ├── 📄 index.css                # Tailwind CSS imports + design tokens
│   ├── 📄 vite-env.d.ts            # Vite type declarations
│   │
│   ├── 📂 components/              # Reusable React components
│   │   ├── 📂 auth/                # Authentication components
│   │   ├── 📂 chat/                # Chat/messaging components
│   │   ├── 📂 dashboard/           # Dashboard layout components
│   │   ├── 📂 files/               # File management components
│   │   ├── 📂 guest/               # Guest portal components
│   │   ├── 📂 landing/             # Landing page sections
│   │   ├── 📂 ui/                  # Shadcn/UI base components
│   │   └── 📄 NavLink.tsx          # Navigation link component
│   │
│   ├── 📂 contexts/                # React context providers
│   ├── 📂 hooks/                   # Custom React hooks
│   ├── 📂 integrations/            # Third-party integrations
│   ├── 📂 lib/                     # Utility functions
│   └── 📂 pages/                   # Page components (routes)
│
├── 📂 supabase/                    # Backend configuration
│   ├── 📄 config.toml              # Supabase project config
│   ├── 📂 functions/               # Edge Functions (serverless)
│   └── 📂 migrations/              # Database migration files
│
└── 📂 vps-storage-server/          # VPS storage node server
    ├── 📄 package.json             # Server dependencies
    └── 📄 server.js                # Express.js storage server
```

---

## 📂 Detailed Component Reference

### `src/components/` - UI Components

#### `auth/` - Authentication Components
| File | Purpose | Used By |
|------|---------|---------|
| `ProtectedRoute.tsx` | Route wrapper that requires authentication | All protected pages |

#### `chat/` - Messaging Components
| File | Purpose | Used By |
|------|---------|---------|
| `ReadReceipt.tsx` | Shows message read status (sent/delivered/read) | Chat interfaces |
| `TypingIndicator.tsx` | Animated "user is typing..." indicator | Chat interfaces |

#### `dashboard/` - Dashboard Layout
| File | Purpose | Used By |
|------|---------|---------|
| `DashboardLayout.tsx` | Main dashboard wrapper with sidebar navigation | All dashboard pages |
| `MemberChatPanel.tsx` | Sliding chat panel for member-guest messaging | Member dashboard |
| `NotificationDropdown.tsx` | Notification bell with dropdown list | Dashboard header |
| `TrialBanner.tsx` | Trial expiration warning banner | Dashboard layout |

#### `files/` - File Management
| File | Purpose | Used By |
|------|---------|---------|
| `BulkActionsBar.tsx` | Multi-select actions bar (delete, move, share) | FileManager |
| `FilePreviewModal.tsx` | File preview dialog (images, videos, PDFs) | FileManager |
| `ShareDialog.tsx` | Create/manage shareable file links | FileManager |
| `ShareFolderDialog.tsx` | Share folders with guests dialog | FileManager |

#### `guest/` - Guest Portal Components
| File | Purpose | Used By |
|------|---------|---------|
| `GuestFilePreviewModal.tsx` | File preview for guest users (video streaming) | GuestFolderView |
| `ZipProgressModal.tsx` | Enterprise-grade ZIP download progress modal | GuestFolderView |

#### `landing/` - Landing Page
| File | Purpose | Used By |
|------|---------|---------|
| `CTA.tsx` | Call-to-action section | Index page |
| `Features.tsx` | Features grid section | Index page |
| `Footer.tsx` | Site footer with links | Index page |
| `Header.tsx` | Landing page header/navbar | Index page |
| `Hero.tsx` | Hero section with main headline | Index page |
| `RoleHierarchy.tsx` | Visual role hierarchy explanation | Index page |

#### `ui/` - Shadcn/UI Base Components
Base UI components from [shadcn/ui](https://ui.shadcn.com/):
`accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`

---

### `src/pages/` - Route Pages

#### Root Pages
| File | Route | Purpose |
|------|-------|---------|
| `Index.tsx` | `/` | Landing page for unauthenticated users |
| `Auth.tsx` | `/auth` | Login/signup page |
| `Dashboard.tsx` | `/dashboard` | Main member dashboard |
| `FileManager.tsx` | `/files` | File browser and management |
| `SharedLinks.tsx` | `/shared-links` | Manage created share links |
| `SharedFile.tsx` | `/s/:shortCode` | Public file access via share link |
| `Analytics.tsx` | `/analytics` | Usage analytics and charts |
| `Settings.tsx` | `/settings` | User profile settings |
| `Plans.tsx` | `/plans` | Subscription plans |
| `TrashBin.tsx` | `/trash` | Deleted files recovery |
| `TelegramGuide.tsx` | `/telegram-guide` | Telegram bot setup guide |
| `NotFound.tsx` | `*` | 404 error page |

#### `admin/` - Admin Pages (Role: Admin)
| File | Route | Purpose |
|------|-------|---------|
| `AdminDashboard.tsx` | `/admin` | Admin overview dashboard |
| `AdminUserManagement.tsx` | `/admin/users` | Manage all users (suspend, etc.) |
| `ReportManagement.tsx` | `/admin/reports` | Handle user reports |

#### `owner/` - Owner Pages (Role: Owner)
| File | Route | Purpose |
|------|-------|---------|
| `OwnerDashboard.tsx` | `/owner` | Owner control center |
| `UserManagement.tsx` | `/owner/users` | Full user management |
| `UserAnalytics.tsx` | `/owner/analytics` | Detailed user analytics |
| `AdminPermissions.tsx` | `/owner/admins` | Manage admin permissions |
| `AuditLogs.tsx` | `/owner/audit` | System audit logs |
| `BillingOverview.tsx` | `/owner/billing` | Billing and subscriptions |
| `StorageSettings.tsx` | `/owner/storage` | VPS storage configuration |
| `SecuritySettings.tsx` | `/owner/security` | Security settings |
| `OwnerGuestControls.tsx` | `/owner/guests` | Guest user management |
| `OwnerMemberChat.tsx` | `/owner/chat` | Chat with members |

#### `dashboard/` - Member Dashboard Pages
| File | Route | Purpose |
|------|-------|---------|
| `GuestManagement.tsx` | `/dashboard/guests` | Member's guest management |

#### `guest/` - Guest Portal Pages
| File | Route | Purpose |
|------|-------|---------|
| `GuestAuth.tsx` | `/guest-auth` | Guest login/register page |
| `GuestPortal.tsx` | `/guest-portal` | Guest dashboard home |
| `GuestFolderView.tsx` | `/guest-portal/folder/:folderId` | Browse shared folder contents |
| `GuestHelpDesk.tsx` | `/guest-portal/help` | Guest-to-member chat |

---

### `src/hooks/` - Custom React Hooks

| File | Purpose | Example Usage |
|------|---------|---------------|
| `useAuth.tsx` | Authentication state and methods | `const { user, signOut } = useAuth()` |
| `use-mobile.tsx` | Detect mobile viewport | `const isMobile = useIsMobile()` |
| `use-toast.ts` | Toast notification system | `const { toast } = useToast()` |
| `useStorageNodes.ts` | VPS storage node management | Owner storage settings |
| `useTypingIndicator.ts` | Real-time typing indicator | Chat components |

---

### `src/contexts/` - React Contexts

| File | Purpose | Provider Location |
|------|---------|-------------------|
| `GuestAuthContext.tsx` | Guest authentication state | App.tsx (guest routes) |

---

### `src/lib/` - Utility Functions

| File | Purpose | Key Functions |
|------|---------|---------------|
| `fileService.ts` | File operations and formatting | `formatFileSize()`, `getFileIcon()`, VPS upload |
| `security.ts` | Security utilities | Password hashing, validation |
| `utils.ts` | General utilities | `cn()` for classNames |

---

### `src/integrations/` - External Integrations

| File | Purpose |
|------|---------|
| `supabase/client.ts` | Supabase client instance |
| `supabase/types.ts` | Auto-generated TypeScript types |

---

## 🔐 User Roles & Permissions

### Role Hierarchy

```
Owner (1 per instance)
  │
  ├── Full system access
  ├── Manage all users and admins
  ├── Configure storage settings
  ├── View audit logs
  └── Billing management
  
Admin (Multiple)
  │
  ├── User suspension
  ├── Report resolution
  ├── File moderation
  └── Limited by Owner permissions
  
Member (Multiple)
  │
  ├── File upload/download
  ├── Create share links
  ├── Share folders with guests
  └── Chat with guests
  
Guest (External, unlimited)
  │
  ├── View shared folders
  ├── Download files
  ├── Chat with folder owner
  └── No authentication needed
```

### Admin Permission Matrix

| Permission | Description | Database Column |
|------------|-------------|-----------------|
| View Emails | See user email addresses | `can_view_emails` |
| Suspend Users | Suspend/unsuspend users | `can_suspend_users` |
| View Reports | Access report queue | `can_view_reports` |
| Resolve Reports | Close/resolve reports | `can_resolve_reports` |
| View Files | Browse user files | `can_view_files` |
| Delete Files | Remove reported files | `can_delete_files` |

---

## 📚 Feature Documentation

### File Management

**File Upload Flow:**
1. User selects files in `FileManager.tsx`
2. `fileService.ts` handles chunked upload
3. Files go to VPS (primary) or Supabase Storage (fallback)
4. Metadata stored in `files` table

**Supported Operations:**
- Upload (single/bulk)
- Download (single/folder as ZIP)
- Preview (images, videos, PDFs, audio)
- Move to folders
- Rename
- Soft delete (trash)
- Permanent delete

### Guest Portal System

**Guest Registration Flow:**
1. Member creates folder share via `ShareFolderDialog.tsx`
2. Guest accesses share link → `guest-register` edge function
3. Guest account created in `guest_users` table
4. Access granted via `guest_folder_access` table

**Guest Features:**
- Browse shared folders (`GuestFolderView.tsx`)
- Preview files with streaming (`GuestFilePreviewModal.tsx`)
- Download individual files or folders as ZIP
- Real-time chat with folder owner (`GuestHelpDesk.tsx`)

### Real-time Messaging

**Chat Architecture:**
- `guest_messages` table for guest↔member
- `owner_member_messages` table for owner↔member
- Real-time via Supabase Realtime subscriptions
- Typing indicators stored in `typing_indicators` table
- Read receipts with `is_read` and `read_at` fields

### Share Links

**Types of Shares:**
1. **File Share** - Direct link to single file (`shared_links` table)
2. **Folder Share** - Share entire folder with guests (`folder_shares` table)

**Share Options:**
- Password protection (hashed)
- Expiry date
- Download limit
- Active/inactive toggle

---

## 🗄 Database Schema

### Core Tables

```sql
-- User Profiles (extends auth.users)
profiles (
  id, user_id, email, full_name, avatar_url,
  is_suspended, suspended_at, suspension_reason
)

-- User Roles
user_roles (
  id, user_id, role ['owner'|'admin'|'member']
)

-- Admin Permissions
admin_permissions (
  id, user_id,
  can_view_emails, can_suspend_users,
  can_view_reports, can_resolve_reports,
  can_view_files, can_delete_files
)
```

### File Storage

```sql
-- Folders
folders (
  id, user_id, name, description, parent_id, thumbnail_url
)

-- Files
files (
  id, user_id, folder_id, name, original_name,
  storage_path, mime_type, size_bytes,
  is_deleted, deleted_at
)

-- Share Links (single files)
shared_links (
  id, user_id, file_id, short_code,
  password_hash, expires_at, max_downloads,
  download_count, is_active
)
```

### Guest System

```sql
-- Guest Users (separate auth)
guest_users (
  id, email, password_hash, full_name,
  is_banned, ban_reason, banned_at
)

-- Folder Shares (for guests)
folder_shares (
  id, member_id, folder_id, share_code, is_active
)

-- Guest Access Records
guest_folder_access (
  id, guest_id, folder_share_id, member_id,
  is_restricted, restricted_at
)

-- Guest Messages
guest_messages (
  id, guest_id, member_id, message,
  sender_type, is_read, read_at
)
```

### Analytics & Audit

```sql
-- Usage Metrics
usage_metrics (
  id, user_id, storage_used_bytes, bandwidth_used_bytes,
  total_downloads, total_views, active_links_count
)

-- Subscriptions
subscriptions (
  id, user_id, plan ['free'|'premium'|'lifetime'],
  storage_limit_gb, bandwidth_limit_gb, valid_until
)

-- Audit Logs
audit_logs (
  id, entity_type, action, actor_id,
  target_user_id, entity_id, details, ip_address
)
```

---

## ⚡ Edge Functions Reference

### Guest Authentication & Portal

| Function | Route | Purpose |
|----------|-------|---------|
| `guest-register` | POST | Register new guest via share code |
| `guest-signin` | POST | Guest login authentication |
| `reset-guest-password` | POST | Reset guest password |
| `guest-folders` | POST | List accessible folders for guest |
| `guest-folder-contents` | POST | Get folder files and subfolders |
| `guest-file-stream` | POST | Get signed URL for file streaming |
| `guest-file-proxy` | GET | Proxy file download from VPS |
| `guest-folder-zip` | POST | Create ZIP of folder contents |
| `guest-messages` | POST | Send/receive guest messages |

### File Operations

| Function | Route | Purpose |
|----------|-------|---------|
| `vps-upload` | POST | Upload file to VPS storage |
| `vps-file` | GET/DELETE | Get or delete VPS files |
| `shared-download` | GET | Download shared file |
| `verify-share-link` | POST | Validate share link credentials |

### User Management

| Function | Route | Purpose |
|----------|-------|---------|
| `create-user` | POST | Create new user (owner only) |
| `admin-suspend-user` | POST | Suspend/unsuspend user |
| `owner-update-user` | POST | Update user details |
| `reset-user-password` | POST | Admin password reset |

### Integration

| Function | Route | Purpose |
|----------|-------|---------|
| `telegram-upload` | POST | Handle Telegram bot uploads |
| `vps-owner-stats` | POST | Get VPS storage statistics |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Git](https://git-scm.com/)
- [Supabase](https://supabase.com/) account (or Lovable Cloud)

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/filevault.git
cd filevault

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
```

### Environment Setup

Create `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

---

## ☁️ Deployment Guide

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Then:
# 1. Import repo at vercel.com
# 2. Add environment variables
# 3. Deploy!
```

### Railway

```bash
# Settings → Build
npm run build

# Settings → Start
npm run preview -- --host --port $PORT
```

### Docker

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=your_url \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=your_key \
  -t filevault .

docker run -d -p 80:80 filevault
```

### VPS with PM2

```bash
# On server
npm install -g pm2 serve
npm run build
pm2 start "serve -s dist -l 3000" --name filevault
pm2 startup && pm2 save
```

---

## 💾 VPS Storage Setup

### Why VPS Storage?

- **Cost**: Cheaper than cloud storage for large volumes
- **Speed**: Direct file streaming without intermediaries
- **Control**: Full ownership of your data
- **Scalability**: Add multiple storage nodes

### Quick Setup

```bash
# On your VPS
mkdir -p /opt/filevault-storage
cd /opt/filevault-storage

# Create server files (copy from vps-storage-server/)
npm install

# Generate API key
export VPS_STORAGE_API_KEY=$(openssl rand -hex 16)
echo "Your API key: $VPS_STORAGE_API_KEY"

# Start with PM2
pm2 start server.js --name storage
pm2 save
```

### Configure in App

Add to Supabase secrets:
| Secret | Value |
|--------|-------|
| `VPS_STORAGE_ENDPOINT` | `http://your-vps-ip:4000` |
| `VPS_STORAGE_API_KEY` | Your generated key |

---

## 🔧 Environment Variables

### Frontend (Vite)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | Project identifier |

### Edge Function Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `SUPABASE_URL` | Auto | Set by Lovable Cloud |
| `SUPABASE_ANON_KEY` | Auto | Set by Lovable Cloud |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Set by Lovable Cloud |
| `VPS_STORAGE_ENDPOINT` | ❌ | VPS storage URL |
| `VPS_STORAGE_API_KEY` | ❌ | VPS authentication key |

---

## 🔍 Troubleshooting

### Common Issues

**"Failed to connect to Supabase"**
- Verify `.env` values are correct
- No spaces around `=` in env file
- Restart dev server after changes

**"CORS error"**
- Add domain to Supabase Auth → URL Configuration
- Check edge function CORS headers

**"File upload failed"**
- Check VPS storage server is running
- Verify API key matches
- Check firewall allows port 4000

**"Guest can't access folder"**
- Verify `guest_folder_access` record exists
- Check `is_restricted` is false
- Confirm `folder_shares.is_active` is true

**"ZIP download fails for large folders"**
- 500MB limit per ZIP
- VPS connection required for large files
- Check edge function logs

### Debug Commands

```bash
# Check VPS storage health
curl http://your-vps:4000/health

# View edge function logs
# In Lovable: Settings → Cloud → Functions → Logs

# Check database
# In Lovable: Settings → Cloud → Database → Tables
```

---

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes following existing patterns
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open Pull Request

### Code Style

- TypeScript strict mode
- Functional components with hooks
- Tailwind CSS for styling
- Shadcn/UI for base components
- ESLint configuration followed

### Adding New Features

1. **New Page**: Add to `src/pages/`, update routes in `App.tsx`
2. **New Component**: Add to appropriate `src/components/` subfolder
3. **New Hook**: Add to `src/hooks/`
4. **New Edge Function**: Add to `supabase/functions/`, update `config.toml`
5. **Database Changes**: Create migration in `supabase/migrations/`

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI Framework
- [Vite](https://vitejs.dev/) - Build Tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Shadcn/UI](https://ui.shadcn.com/) - Component Library
- [Supabase](https://supabase.com/) - Backend as a Service
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide Icons](https://lucide.dev/) - Icon Set

---

**Built with ❤️ using [Lovable](https://lovable.dev)**
