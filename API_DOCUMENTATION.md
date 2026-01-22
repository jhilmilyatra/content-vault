# 🔌 SecureFiles API Documentation

> **Version:** 1.2.0  
> **Last Updated:** January 2026  
> **Base URL:** `https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Guest Authentication APIs](#guest-authentication-apis)
6. [Guest Portal APIs](#guest-portal-apis)
7. [File Management APIs](#file-management-apis)
8. [Sharing APIs](#sharing-apis)
9. [Admin APIs](#admin-apis)
10. [Telegram Integration](#telegram-integration)
11. [VPS Storage APIs](#vps-storage-apis)

---

## Overview

SecureFiles provides a comprehensive REST API for file management, guest access, and administrative operations. All APIs are implemented as Supabase Edge Functions.

### API Conventions

- All endpoints accept and return JSON unless otherwise specified
- Timestamps are in ISO 8601 format (e.g., `2024-12-27T10:30:00.000Z`)
- UUIDs are used for all entity identifiers
- All requests must include appropriate CORS headers

### Common Headers

```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

---

## Authentication

SecureFiles uses multiple authentication mechanisms depending on the API type:

### 1. JWT Authentication (Supabase Auth)

For authenticated user APIs (members, admins, owners):

```http
Authorization: Bearer <jwt_token>
```

**How to obtain:**
```javascript
const { data } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});
const token = data.session.access_token;
```

### 2. Guest Session Authentication

For guest portal APIs, pass guest ID in request body:

```json
{
  "guestId": "uuid-of-guest-user"
}
```

### 3. API Token Authentication

For Telegram and external integrations:

```http
x-api-key: <64-character-api-token>
```

**Token Generation:**
1. Go to Settings → API Tokens in the dashboard
2. Generate a new token
3. Copy the token immediately (shown only once)
4. Token is validated against SHA-256 hash stored in database

### Authentication Matrix

| API Category | Auth Method | Header/Field |
|--------------|-------------|--------------|
| Guest Sign-in | None | - |
| Guest Portal | Guest ID | `guestId` in body |
| Member APIs | JWT | `Authorization: Bearer` |
| Admin APIs | JWT + Role Check | `Authorization: Bearer` |
| Telegram | API Token | `x-api-key` |

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Human-readable error message",
  "details": "Optional technical details"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | Success | Request completed successfully |
| `400` | Bad Request | Missing or invalid parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `410` | Gone | Resource expired (links, downloads) |
| `500` | Server Error | Internal processing failure |

### Common Error Scenarios

```json
// Missing parameters
{
  "error": "Email and password are required"
}

// Invalid credentials
{
  "error": "Invalid email or password"
}

// Banned account
{
  "error": "Your account has been banned: Violation of terms"
}

// Expired link
{
  "error": "This link has expired"
}

// Download limit
{
  "error": "Download limit reached"
}
```

---

## Rate Limiting

Currently, no hard rate limits are enforced. However, the following soft limits apply:

| Operation | Recommended Limit |
|-----------|-------------------|
| API calls per minute | 60 |
| File uploads per minute | 10 |
| ZIP downloads per hour | 20 |
| Authentication attempts per minute | 5 |

---

## Guest Authentication APIs

### POST `/guest-signin`

Authenticate a guest user.

**Authentication:** None (public endpoint)

**Request Body:**

```json
{
  "email": "guest@example.com",
  "password": "password123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "guest": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "guest@example.com",
    "full_name": "John Guest",
    "is_banned": false,
    "ban_reason": null,
    "created_at": "2024-12-27T10:30:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Email and password are required" | Missing fields |
| 401 | "Invalid email or password" | Wrong credentials |
| 403 | "Your account has been banned: [reason]" | Banned guest |
| 500 | "Failed to sign in" | Database error |

**Example:**

```javascript
const response = await fetch('https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1/guest-signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'guest@example.com',
    password: 'password123'
  })
});
const data = await response.json();
// Store guest session
localStorage.setItem('guest', JSON.stringify(data.guest));
```

---

### POST `/guest-register`

Register a new guest user with a share code.

**Authentication:** None (public endpoint)

**Request Body:**

```json
{
  "email": "newguest@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "shareCode": "ABC123XYZ"
}
```

**Field Requirements:**

| Field | Required | Constraints |
|-------|----------|-------------|
| `email` | Yes | Valid email format |
| `password` | Yes | Minimum 6 characters |
| `fullName` | No | Optional display name |
| `shareCode` | Yes | Valid, active share code |

**Success Response (200):**

```json
{
  "success": true,
  "guest": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "newguest@example.com",
    "full_name": "John Doe",
    "is_banned": false,
    "ban_reason": null,
    "created_at": "2024-12-27T10:30:00.000Z"
  }
}
```

**Existing User Response (200):**

```json
{
  "success": false,
  "message": "Folder added to your account. Please sign in.",
  "needsSignIn": true
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Email, password, and share code are required" | Missing fields |
| 400 | "Password must be at least 6 characters" | Weak password |
| 400 | "Invalid or expired folder share link" | Bad share code |
| 400 | "You already have access to this folder" | Duplicate access |
| 500 | "Failed to create account" | Database error |

---

### POST `/reset-guest-password`

Reset a guest user's password.

**Authentication:** JWT (Member or Owner)

**Request Headers:**

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "newPassword": "newpassword123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Authorization Rules:**

- **Owner:** Can reset any guest's password
- **Member:** Can only reset passwords for guests they manage

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Guest ID and new password are required" | Missing fields |
| 400 | "Password must be at least 6 characters" | Weak password |
| 401 | "Authorization required" | Missing JWT |
| 403 | "You don't have permission..." | Not owner/managing member |

---

## Guest Portal APIs

### POST `/guest-folders`

Get all folders accessible to a guest.

**Authentication:** Guest ID

**Request Body:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response (200):**

```json
{
  "folders": [
    {
      "id": "access-record-uuid",
      "folder_share_id": "share-uuid",
      "member_id": "member-uuid",
      "added_at": "2024-12-27T10:30:00.000Z",
      "is_restricted": false,
      "folder_share": {
        "folder_id": "folder-uuid",
        "is_active": true,
        "folder": {
          "name": "Project Files",
          "description": "Files for Q4 project"
        }
      },
      "member_name": "John Member"
    }
  ]
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Guest ID is required" | Missing guestId |
| 403 | "Account is banned" | Banned guest |
| 404 | "Guest not found" | Invalid guestId |

---

### POST `/guest-folder-contents`

Get contents of a specific folder (files and subfolders).

**Authentication:** Guest ID

**Request Body:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "folderId": "folder-uuid",
  "action": "get-contents"
}
```

**Available Actions:**

| Action | Description |
|--------|-------------|
| `verify-access` | Check if guest has access to folder |
| `get-contents` | Get folder contents with files and subfolders |

**Success Response - verify-access (200):**

```json
{
  "hasAccess": true
}
```

**Success Response - get-contents (200):**

```json
{
  "folder": {
    "id": "folder-uuid",
    "name": "Project Files",
    "description": "Files for Q4 project",
    "parent_id": null
  },
  "subfolders": [
    {
      "id": "subfolder-uuid",
      "name": "Documents",
      "description": "Project documents",
      "parent_id": "folder-uuid"
    }
  ],
  "files": [
    {
      "id": "file-uuid",
      "name": "report.pdf",
      "original_name": "report.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 1048576,
      "storage_path": "user-id/unique-file-id.pdf",
      "created_at": "2024-12-27T10:30:00.000Z"
    }
  ],
  "breadcrumbs": [
    { "id": "root-folder-uuid", "name": "Shared Folder" },
    { "id": "folder-uuid", "name": "Project Files" }
  ],
  "rootFolderId": "root-folder-uuid"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Guest ID is required" | Missing guestId |
| 403 | "Access denied" | No folder access |
| 404 | "Folder not found" | Invalid folderId |

---

### GET `/guest-file-proxy`

Download a file for guest users (proxied through VPS).

**Authentication:** Guest ID (query parameter)

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `guestId` | Yes | Guest user UUID |
| `path` | Yes | File storage path |

**Example Request:**

```
GET /guest-file-proxy?guestId=550e8400-e29b-41d4-a716-446655440000&path=user-id/file.pdf
```

**Success Response:**

- **Status:** 200
- **Content-Type:** File's MIME type
- **Content-Disposition:** `inline; filename="original_filename.pdf"`
- **Body:** Binary file data

**Response Headers:**

```http
Content-Type: application/pdf
Content-Disposition: inline; filename="report.pdf"
Cache-Control: public, max-age=3600
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Missing parameters" | Missing guestId or path |
| 403 | "Access denied" | No file access |
| 403 | "Account is banned" | Banned guest |
| 404 | "Guest not found" | Invalid guestId |
| 404 | "File not found" | File doesn't exist |

---

### POST `/guest-folder-zip`

Download entire folder as ZIP archive.

**Authentication:** Guest ID

**Request Body:**

```json
{
  "guestId": "550e8400-e29b-41d4-a716-446655440000",
  "folderId": "folder-uuid"
}
```

**Success Response:**

- **Status:** 200
- **Content-Type:** `application/zip`
- **Content-Disposition:** `attachment; filename="Folder Name.zip"`
- **Body:** Binary ZIP data

**Limitations:**

| Limit | Value |
|-------|-------|
| Maximum folder size | 500 MB |
| Maximum files | Unlimited (within size limit) |
| Subfolder depth | Unlimited |

**ZIP Structure:**

```
FolderName.zip
├── file1.pdf
├── file2.jpg
├── Subfolder/
│   ├── file3.docx
│   └── nested/
│       └── file4.txt
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Guest ID and folder ID are required" | Missing parameters |
| 400 | "No files in folder" | Empty folder |
| 400 | "Folder too large to download as ZIP" | Exceeds 500MB |
| 403 | "Access denied" | No folder access |
| 404 | "Folder not found" | Invalid folderId |

---

### POST `/guest-messages`

Handle guest messaging with members.

**Authentication:** Guest ID

**Request Body (varies by action):**

#### Get Conversations

```json
{
  "action": "getConversations",
  "guestId": "guest-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "conversations": [
    {
      "member_id": "member-uuid",
      "member_name": "John Member",
      "last_message": "Thank you for sharing the files!",
      "last_message_at": "2024-12-27T10:30:00.000Z",
      "unread_count": 2
    }
  ]
}
```

#### Get Messages

```json
{
  "action": "getMessages",
  "guestId": "guest-uuid",
  "memberId": "member-uuid",
  "markAsRead": true
}
```

**Response:**

```json
{
  "success": true,
  "messages": [
    {
      "id": "message-uuid",
      "guest_id": "guest-uuid",
      "member_id": "member-uuid",
      "sender_type": "guest",
      "message": "Hello, I have a question about the files.",
      "is_read": true,
      "read_at": "2024-12-27T10:35:00.000Z",
      "created_at": "2024-12-27T10:30:00.000Z"
    }
  ]
}
```

#### Send Message

```json
{
  "action": "sendMessage",
  "guestId": "guest-uuid",
  "memberId": "member-uuid",
  "message": "Thank you for the files!"
}
```

**Response:**

```json
{
  "success": true,
  "message": {
    "id": "new-message-uuid",
    "guest_id": "guest-uuid",
    "member_id": "member-uuid",
    "sender_type": "guest",
    "message": "Thank you for the files!",
    "is_read": false,
    "created_at": "2024-12-27T10:40:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Guest ID is required" | Missing guestId |
| 400 | "Member ID is required" | Missing memberId |
| 400 | "Member ID and message are required" | Missing for sendMessage |
| 400 | "Invalid action" | Unknown action type |
| 403 | "Access denied" | No access to member |
| 403 | "Your account is banned" | Banned guest |

---

## File Management APIs

### POST `/vps-upload`

Upload a file to VPS storage.

**Authentication:** JWT (Bearer token)

**Content Types Supported:**

- `multipart/form-data` (recommended for large files)
- `application/json` (base64 encoded)

#### Multipart Form Data

```http
POST /vps-upload
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="document.pdf"
Content-Type: application/pdf

[binary file data]
--boundary
Content-Disposition: form-data; name="folderId"

folder-uuid
--boundary--
```

#### JSON (Base64)

```json
{
  "fileName": "document.pdf",
  "fileData": "base64-encoded-file-content",
  "mimeType": "application/pdf",
  "folderId": "folder-uuid"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "file": {
    "id": "file-uuid",
    "user_id": "user-uuid",
    "folder_id": "folder-uuid",
    "name": "document.pdf",
    "original_name": "document.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 1048576,
    "storage_path": "user-uuid/unique-id.pdf",
    "created_at": "2024-12-27T10:30:00.000Z"
  },
  "storageType": "vps",
  "url": "https://cdn.example.com/files/user-uuid/unique-id.pdf",
  "node": "https://cdn.example.com"
}
```

**CDN Support:**

- If `VPS_CDN_URL` is configured, file URLs use the CDN endpoint
- Otherwise, direct VPS IP is used
- CDN provides HTTPS and caching for improved performance

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "No file provided" | Missing file in multipart |
| 401 | "No authorization header" | Missing JWT |
| 401 | "Invalid token" | Expired/invalid JWT |
| 500 | "VPS upload failed" | Storage server error |

---

### GET `/vps-file`

Get, delete, or get URL for a file.

**Authentication:** JWT (Bearer token)

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `path` | Yes | File storage path |
| `action` | No | `get` (default), `delete`, or `url` |

**Actions:**

#### Get File

```
GET /vps-file?path=user-uuid/file.pdf&action=get
Authorization: Bearer <jwt_token>
```

**Response:** Binary file data with appropriate Content-Type

#### Get URL

```
GET /vps-file?path=user-uuid/file.pdf&action=url
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "url": "http://46.38.232.46:4000/files/user-uuid/file.pdf",
  "storage": "vps"
}
```

#### Delete File

```
GET /vps-file?path=user-uuid/file.pdf&action=delete
Authorization: Bearer <jwt_token>
```

**Response:**

```json
{
  "success": true
}
```

**Authorization:**

- User can only access files where `storage_path` starts with their `user_id`
- Attempting to access other users' files returns 403

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "No path provided" | Missing path parameter |
| 400 | "Invalid action" | Unknown action type |
| 401 | "No authorization header" | Missing JWT |
| 403 | "Unauthorized access" | Path doesn't match user ID |

---

## Sharing APIs

### POST `/verify-share-link`

Verify a shared file link and get file info.

**Authentication:** None (public endpoint)

**Request Body:**

```json
{
  "shortCode": "ABC123XYZ",
  "password": "optional-password"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "file": {
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "downloadUrl": "https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1/shared-download?code=ABC123XYZ"
  }
}
```

**Password Required Response (200):**

```json
{
  "requiresPassword": true,
  "fileName": "document.pdf"
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 200 | `{ "error": "Link not found or expired" }` | Invalid short code |
| 200 | `{ "error": "File not found" }` | File deleted |
| 200 | `{ "error": "This link has expired" }` | Past expiry date |
| 200 | `{ "error": "Download limit reached" }` | Max downloads hit |
| 200 | `{ "error": "Invalid password" }` | Wrong password |

*Note: Errors return 200 status for frontend handling convenience*

---

### GET `/shared-download`

Download a shared file.

**Authentication:** None (public endpoint)

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `code` | Yes | Share link short code |

**Example:**

```
GET /shared-download?code=ABC123XYZ
```

**Success Response:**

- **Status:** 200
- **Content-Type:** File's MIME type
- **Content-Disposition:** `attachment; filename="document.pdf"`
- **Body:** Binary file data

**Side Effects:**

- Increments `download_count` on the shared link

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Short code is required" | Missing code parameter |
| 404 | "Link not found or expired" | Invalid/inactive link |
| 404 | "File not found" | File deleted |
| 410 | "This link has expired" | Past expiry date |
| 410 | "Download limit reached" | Max downloads exceeded |

---

## Admin APIs

### POST `/admin-suspend-user`

Suspend or unsuspend a user account.

**Authentication:** JWT (Admin or Owner role)

**Request Body:**

```json
{
  "targetUserId": "user-uuid-to-suspend",
  "suspend": true,
  "reason": "Violation of terms of service"
}
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `targetUserId` | Yes | UUID of user to suspend |
| `suspend` | Yes | `true` to suspend, `false` to unsuspend |
| `reason` | Yes (if suspend=true) | Suspension reason |

**Success Response (200):**

```json
{
  "success": true,
  "message": "User suspended successfully"
}
```

**Authorization Hierarchy:**

| Actor Role | Can Suspend |
|------------|-------------|
| Owner | Admins, Members |
| Admin | Members only |
| Member | ❌ No access |

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Target user ID is required" | Missing targetUserId |
| 400 | "Suspension reason is required" | Missing reason when suspend=true |
| 400 | "Cannot suspend your own account" | Self-suspension attempt |
| 401 | "No authorization header" | Missing JWT |
| 403 | "Insufficient permissions" | Not admin/owner |
| 403 | "Cannot suspend owner accounts" | Admin trying to suspend owner |
| 403 | "Admins cannot suspend other admins" | Admin trying to suspend admin |

**Audit Log:**

This action creates an audit log entry:

```json
{
  "action": "user_suspended",
  "entity_type": "profiles",
  "details": { "reason": "Violation of terms of service" }
}
```

---

### POST `/create-user`

Create a new user (Owner only).

**Authentication:** JWT (Owner role)

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "role": "member",
  "plan": "premium",
  "storageLimit": 100,
  "bandwidthLimit": 500,
  "maxLinks": 100,
  "validUntil": "2025-12-31T23:59:59.000Z"
}
```

**Fields:**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `email` | Yes | - | Valid email address |
| `password` | Yes | - | Min 6 characters |
| `fullName` | No | Email prefix | Display name |
| `role` | Yes | - | `member`, `admin`, or `owner` |
| `plan` | Yes | - | `free`, `premium`, or `lifetime` |
| `storageLimit` | Yes | - | Storage limit in GB |
| `bandwidthLimit` | Yes | - | Bandwidth limit in GB |
| `maxLinks` | Yes | - | Maximum active share links |
| `validUntil` | No | null | Subscription expiry date |

**Success Response (200):**

```json
{
  "success": true,
  "userId": "new-user-uuid"
}
```

**Created Resources:**

1. Auth user in `auth.users`
2. Profile in `public.profiles`
3. Role in `public.user_roles`
4. Subscription in `public.subscriptions`
5. Audit log entry

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Email and password are required" | Missing fields |
| 400 | "Password must be at least 6 characters" | Weak password |
| 401 | "Unauthorized" | Invalid/missing JWT |
| 403 | "Only owners can create users" | Not owner role |
| 500 | "User already exists" | Duplicate email |

---

### POST `/owner-update-user`

Update user details (Owner only).

**Authentication:** JWT (Owner role)

**Request Body:**

```json
{
  "targetUserId": "user-uuid",
  "updates": {
    "fullName": "Updated Name",
    "role": "admin",
    "plan": "lifetime",
    "storageLimit": 500,
    "bandwidthLimit": 1000,
    "maxLinks": 500,
    "validUntil": null
  }
}
```

---

### POST `/reset-user-password`

Reset a user's password (Admin/Owner).

**Authentication:** JWT (Admin or Owner role)

**Request Body:**

```json
{
  "targetUserId": "user-uuid",
  "newPassword": "newpassword123"
}
```

---

## Telegram Integration

### POST `/telegram-upload`

Upload files via Telegram bot.

**Authentication:** API Token (x-api-key header)

**Request Headers:**

```http
x-api-key: <64-character-api-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "file_name": "photo.jpg",
  "file_data": "base64-encoded-file-content",
  "mime_type": "image/jpeg",
  "folder_id": "optional-folder-uuid"
}
```

**Field Constraints:**

| Field | Required | Constraints |
|-------|----------|-------------|
| `file_name` | Yes | Max 255 chars, no path characters |
| `file_data` | Yes | Valid base64 |
| `mime_type` | Yes | Valid MIME type |
| `folder_id` | No | Valid folder UUID |

**File Limits:**

| Limit | Value |
|-------|-------|
| Maximum file size | 50 MB |
| File name length | 255 characters |
| Token length | Minimum 32 characters |

**Success Response (200):**

```json
{
  "success": true,
  "file": {
    "id": "file-uuid",
    "name": "photo.jpg",
    "size_bytes": 1048576,
    "mime_type": "image/jpeg",
    "created_at": "2024-12-27T10:30:00.000Z"
  }
}
```

**Token Validation:**

1. Token is hashed with SHA-256
2. Hash is compared against `api_tokens` table
3. Token must be active and not expired
4. `last_used_at` is updated on each use

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Missing required fields" | file_name, file_data, or mime_type missing |
| 400 | "Invalid file name" | Contains path traversal chars |
| 400 | "File name too long" | Exceeds 255 characters |
| 400 | "Invalid base64 file data" | Malformed base64 |
| 400 | "File too large (max 50MB)" | Exceeds size limit |
| 401 | "Missing API token" | No x-api-key header |
| 401 | "Invalid API token format" | Token too short |
| 401 | "Invalid API token" | Token not in database |
| 401 | "API token has been deactivated" | Token is_active = false |
| 401 | "API token has expired" | Past expires_at |

---

## VPS Storage APIs

### POST `/update-video-metadata`

Update video file metadata including thumbnail and duration.

**Authentication:** JWT (Bearer token)

**Request Body:**

```json
{
  "fileId": "file-uuid",
  "thumbnailDataUrl": "data:image/jpeg;base64,...",
  "durationSeconds": 120.5
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | UUID | The file ID to update (required) |
| `thumbnailUrl` | string | Direct URL to thumbnail image |
| `thumbnailDataUrl` | string | Base64 data URL for thumbnail (uploaded to VPS) |
| `durationSeconds` | number | Video duration in seconds |

**Processing:**

1. If `thumbnailDataUrl` is provided, extracts base64 image data
2. Uploads thumbnail to VPS storage via `/upload-base64`
3. Constructs CDN URL if `VPS_CDN_URL` is configured
4. Updates `files` table with `thumbnail_url` and `duration_seconds`

**Success Response (200):**

```json
{
  "success": true,
  "file": {
    "id": "file-uuid",
    "thumbnail_url": "https://cdn.example.com/files/user-uuid/video_thumb.jpg",
    "duration_seconds": 120.5
  },
  "thumbnailUrl": "https://cdn.example.com/files/user-uuid/video_thumb.jpg",
  "durationSeconds": 120.5
}
```

**Error Responses:**

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "fileId is required" | Missing file ID |
| 401 | "No authorization header" | Missing JWT |
| 401 | "Invalid token" | Expired/invalid JWT |
| 403 | "Unauthorized - not file owner" | User doesn't own file |
| 404 | "File not found" | Invalid file ID |

---

### GET `/vps-owner-stats`

Get storage statistics (Owner only).

**Authentication:** JWT (Owner role)

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalStorage": 1073741824000,
    "usedStorage": 53687091200,
    "fileCount": 1523,
    "userCount": 45
  }
}
```

---

## Appendix

### Database Schema Reference

#### Files Table

```sql
files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_id UUID REFERENCES folders,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
)
```

#### Shared Links Table

```sql
shared_links (
  id UUID PRIMARY KEY,
  file_id UUID REFERENCES files,
  user_id UUID NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  expires_at TIMESTAMP,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
)
```

#### Guest Users Table

```sql
guest_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  banned_at TIMESTAMP,
  banned_by UUID,
  created_at TIMESTAMP DEFAULT now()
)
```

### VPS Server Endpoints

The VPS storage server runs at `http://46.38.232.46:4000`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/upload-base64` | POST | Upload file (base64 encoded) |
| `/upload` | POST | Upload file (multipart form) |
| `/chunk-append` | POST | Append chunk to file (direct assembly) |
| `/finalize-chunks` | POST | Verify and finalize chunked upload |
| `/files/:path` | GET | Download/stream file |
| `/files/:path` | HEAD | Check file exists |
| `/delete` | DELETE | Delete file |
| `/stats/:userId` | GET | User storage stats |
| `/health` | GET | Server health check |

### Chunked Upload Edge Function

The `vps-chunked-upload` edge function supports resumable uploads:

| Action | Description |
|--------|-------------|
| `init` | Initialize upload session, returns `uploadId` and `storageFileName` |
| `status` | Get current upload progress with uploaded chunk indices |
| `chunk` | Upload a single 5MB chunk |
| `finalize` | Verify all chunks and create final file record |

**Example Chunked Upload Flow:**

```javascript
// 1. Initialize
const initRes = await supabase.functions.invoke('vps-chunked-upload', {
  body: { fileName, mimeType, totalSize, totalChunks, folderId },
  headers: { 'action': 'init' }
});
const { uploadId, storageFileName } = initRes.data;

// 2. Upload chunks
for (let i = 0; i < totalChunks; i++) {
  const formData = new FormData();
  formData.append('chunk', chunkBlob);
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', i.toString());
  formData.append('storageFileName', storageFileName);
  
  await fetch(url + '?action=chunk', { method: 'POST', body: formData });
}

// 3. Finalize
await supabase.functions.invoke('vps-chunked-upload', {
  body: { uploadId, storageFileName },
  headers: { 'action': 'finalize' }
});
```

### Security Considerations

1. **Password Hashing:** All passwords use SHA-256 hashing
2. **JWT Validation:** Tokens verified against Supabase Auth
3. **RLS Policies:** Database-level access control
4. **Path Traversal:** File names validated to prevent directory access
5. **CORS:** All endpoints include permissive CORS for web access
6. **API Tokens:** 32+ character tokens required, hashed storage
7. **Guest Validation:** Guest IDs verified against folder access records

### Webhook Integration

For real-time updates, use Supabase Realtime:

```javascript
const channel = supabase
  .channel('files')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'files'
  }, (payload) => {
    console.log('File change:', payload);
  })
  .subscribe();
```

---

*Last updated: December 2024*
*API Version: 1.1.0*
