# FileCloud Premium Plans Configuration Guide

> **Complete guide for updating and customizing premium plans, pricing, and subscription features**

This document provides detailed instructions for modifying the premium plans chart, pricing, subscription limits, and related configurations. Every file and line number is documented for easy reference.

---

## Table of Contents

1. [Plan System Overview](#plan-system-overview)
2. [Quick Reference - All Plan Locations](#quick-reference---all-plan-locations)
3. [Part 1: Plans Page Configuration](#part-1-plans-page-configuration)
4. [Part 2: Database Schema](#part-2-database-schema)
5. [Part 3: Default Subscription Values](#part-3-default-subscription-values)
6. [Part 4: User Management Integration](#part-4-user-management-integration)
7. [Part 5: Billing & Analytics](#part-5-billing--analytics)
8. [Part 6: Contact Information](#part-6-contact-information)
9. [Part 7: Adding New Plan Tiers](#part-7-adding-new-plan-tiers)
10. [Common Customization Scenarios](#common-customization-scenarios)

---

## Plan System Overview

### Current Plan Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     FILECLOUD PLAN SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐│
│  │  Database   │   │  Frontend   │   │   Owner Controls        ││
│  │  Schema     │──▶│  Display    │──▶│   (Manual Grants)       ││
│  │             │   │  (Plans.tsx)│   │   (UserManagement.tsx)  ││
│  └─────────────┘   └─────────────┘   └─────────────────────────┘│
│                                                                   │
│  Plan Types: free | premium | lifetime                           │
│  Limits: storage_limit_gb | bandwidth_limit_gb | max_active_links│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Current Plans Summary

#### Monthly Plans (src/pages/Plans.tsx, Lines 17-58)

| Plan ID | Name | Storage | Bandwidth | Links | Price (₹) |
|---------|------|---------|-----------|-------|-----------|
| `monthly-100` | 100 GB | 100 GB | 500 GB | 50 | ₹99 |
| `monthly-200` | 200 GB | 200 GB | 1000 GB | 100 | ₹179 |
| `monthly-400` | 400 GB | 400 GB | 2000 GB | 200 | ₹299 |
| `monthly-1tb` | 1 TB | 1000 GB | 5000 GB | 500 | ₹499 |

#### Lifetime Plans (src/pages/Plans.tsx, Lines 60-101)

| Plan ID | Name | Storage | Bandwidth | Links | Price (₹) |
|---------|------|---------|-----------|-------|-----------|
| `lifetime-100` | 100 GB | 100 GB | 500 GB | 50 | ₹999 |
| `lifetime-200` | 200 GB | 200 GB | 1000 GB | 100 | ₹1799 |
| `lifetime-400` | 400 GB | 400 GB | 2000 GB | 200 | ₹2999 |
| `lifetime-1tb` | 1 TB | 1000 GB | 5000 GB | 500 | ₹4999 |

---

## Quick Reference - All Plan Locations

### Plan Display & Pricing

| File | Lines | What to Change |
|------|-------|----------------|
| `src/pages/Plans.tsx` | 17-58 | Monthly plans array |
| `src/pages/Plans.tsx` | 60-101 | Lifetime plans array |
| `src/pages/Plans.tsx` | 114-121 | Premium features list |
| `src/pages/Plans.tsx` | 169 | Price display format (currency symbol) |
| `src/pages/Plans.tsx` | 232 | Lifetime price display format |

### Database Defaults

| File | Lines | What to Change |
|------|-------|----------------|
| Database Function | `handle_new_user_subscription` | Default free plan limits |
| `src/integrations/supabase/types.ts` | 862 | Plan type enum (read-only) |

### User Management

| File | Lines | What to Change |
|------|-------|----------------|
| `src/pages/owner/UserManagement.tsx` | 142-145 | Default plan values |
| `src/pages/owner/UserManagement.tsx` | 164-169 | Edit form defaults |

### Billing Analytics

| File | Lines | What to Change |
|------|-------|----------------|
| `src/pages/owner/BillingOverview.tsx` | 63 | Revenue calculation formula |
| `src/pages/owner/BillingOverview.tsx` | 67-68 | Infrastructure cost rates |

### Contact Information

| File | Lines | What to Change |
|------|-------|----------------|
| `src/pages/Plans.tsx` | 329 | Telegram contact link |
| `src/pages/Plans.tsx` | 339 | Telegram username display |
| `src/pages/Plans.tsx` | 343 | Instagram contact link |
| `src/pages/Plans.tsx` | 355 | Instagram username display |

---

## Part 1: Plans Page Configuration

### Step 1.1: Modify Monthly Plans

**File: `src/pages/Plans.tsx`**

```
Location: src/pages/Plans.tsx
Lines: 17-58
```

**Current Monthly Plans Configuration:**
```typescript
const monthlyPlans = [
  {
    id: 'monthly-100',           // Line 19: Unique identifier
    name: '100 GB',              // Line 20: Display name
    storage: 100,                // Line 21: Storage in GB
    bandwidth: 500,              // Line 22: Bandwidth in GB
    links: 50,                   // Line 23: Max active links
    price: 99,                   // Line 24: Price in ₹
    period: '1 month',           // Line 25: Billing period
    popular: false,              // Line 26: Show \"Popular\" badge
  },
  {
    id: 'monthly-200',           // Line 29
    name: '200 GB',              // Line 30
    storage: 200,                // Line 31
    bandwidth: 1000,             // Line 32
    links: 100,                  // Line 33
    price: 179,                  // Line 34
    period: '1 month',           // Line 35
    popular: true,               // Line 36 - This one shows \"Most Popular\"
  },
  {
    id: 'monthly-400',
    name: '400 GB',
    storage: 400,
    bandwidth: 2000,
    links: 200,
    price: 299,
    period: '1 month',
    popular: false,
  },
  {
    id: 'monthly-1tb',
    name: '1 TB',
    storage: 1000,
    bandwidth: 5000,
    links: 500,
    price: 499,
    period: '1 month',
    popular: false,
  },
];
```

**To Add a New Monthly Plan:**

Insert at the desired position (e.g., after line 47):
```typescript
  {
    id: 'monthly-500',
    name: '500 GB',
    storage: 500,
    bandwidth: 2500,
    links: 250,
    price: 349,
    period: '1 month',
    popular: false,
  },
```

**To Change Pricing:**

Modify the `price` field on the respective line:
- Line 24: 100 GB monthly price
- Line 34: 200 GB monthly price
- Line 44: 400 GB monthly price
- Line 54: 1 TB monthly price

### Step 1.2: Modify Lifetime Plans

**File: `src/pages/Plans.tsx`**

```
Location: src/pages/Plans.tsx
Lines: 60-101
```

**Current Lifetime Plans Configuration:**
```typescript
const lifetimePlans = [
  {
    id: 'lifetime-100',          // Line 62: Unique identifier
    name: '100 GB',              // Line 63: Display name
    storage: 100,                // Line 64: Storage in GB
    bandwidth: 500,              // Line 65: Bandwidth in GB
    links: 50,                   // Line 66: Max active links
    price: 999,                  // Line 67: One-time price in ₹
    period: 'lifetime',          // Line 68: Lifetime billing
    popular: false,              // Line 69: Show badge
  },
  {
    id: 'lifetime-200',          // Line 72
    name: '200 GB',              // Line 73
    storage: 200,                // Line 74
    bandwidth: 1000,             // Line 75
    links: 100,                  // Line 76
    price: 1799,                 // Line 77
    period: 'lifetime',          // Line 78
    popular: true,               // Line 79 - Shows \"Best Value\"
  },
  {
    id: 'lifetime-400',
    name: '400 GB',
    storage: 400,
    bandwidth: 2000,
    links: 200,
    price: 2999,
    period: 'lifetime',
    popular: false,
  },
  {
    id: 'lifetime-1tb',
    name: '1 TB',
    storage: 1000,
    bandwidth: 5000,
    links: 500,
    price: 4999,
    period: 'lifetime',
    popular: false,
  },
];
```

**To Change Lifetime Pricing:**

Modify the `price` field on the respective line:
- Line 67: 100 GB lifetime price
- Line 77: 200 GB lifetime price
- Line 87: 400 GB lifetime price
- Line 97: 1 TB lifetime price

### Step 1.3: Change Currency Symbol

**File: `src/pages/Plans.tsx`**

```
Location: src/pages/Plans.tsx
Lines: 169, 171, 232, 233, 315
```

**Current Currency Display (₹ Indian Rupee):**

```typescript
// Line 169 - Monthly plan price
<span className="text-3xl font-bold text-foreground">₹{plan.price}</span>

// Line 171 - Monthly suffix
<span className="text-muted-foreground">/mo</span>

// Line 232 - Lifetime plan price
<span className="text-3xl font-bold text-foreground">₹{plan.price}</span>

// Line 233 - Lifetime suffix
<span className="text-muted-foreground">/forever</span>

// Line 315 - Purchase dialog
Contact us to complete your purchase for ₹{selectedPlan?.price}
```

**To Change to USD ($):**

Replace `₹` with `$` on lines: 169, 232, 315

### Step 1.4: Modify Premium Features List

**File: `src/pages/Plans.tsx`**

```
Location: src/pages/Plans.tsx
Lines: 114-121
```

**Current Features:**
```typescript
const features = [
  'Secure file storage',              // Line 115
  'Fast CDN delivery',                // Line 116
  'Share links with password protection', // Line 117
  'Download analytics',               // Line 118
  'Priority support',                 // Line 119
  'No ads',                           // Line 120
];
```

**To Add New Features:**

Insert new feature strings in the array:
```typescript
const features = [
  'Secure file storage',
  'Fast CDN delivery',
  'Share links with password protection',
  'Download analytics',
  'Priority support',
  'No ads',
  'API access',                       // Add new feature
  'Custom branding',                  // Add new feature
];
```

### Step 1.5: Change "Popular" Badge

**File: `src/pages/Plans.tsx`**

To change which plan shows as "Most Popular" or "Best Value":

**Monthly Plans:**
- Set `popular: true` on desired plan (Lines 26, 36, 46, or 56)
- Set `popular: false` on all others

**Lifetime Plans:**
- Set `popular: true` on desired plan (Lines 69, 79, 89, or 99)
- Set `popular: false` on all others

---

## Part 2: Database Schema

### Step 2.1: Subscription Plan Types

The database uses an ENUM type for subscription plans. Current values are defined in the database:

```sql
-- Database ENUM type (Cannot be modified via code)
CREATE TYPE subscription_plan AS ENUM ('free', 'premium', 'lifetime');
```

**To Add New Plan Types (Database Migration Required):**

Create a new migration:
```sql
ALTER TYPE subscription_plan ADD VALUE 'enterprise';
ALTER TYPE subscription_plan ADD VALUE 'business';
```

### Step 2.2: Subscription Table Structure

**Table: `subscriptions`**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid | auto | Primary key |
| `user_id` | uuid | required | User reference |
| `plan` | subscription_plan | 'free' | Plan type |
| `storage_limit_gb` | integer | 5 | Storage quota in GB |
| `bandwidth_limit_gb` | integer | 50 | Bandwidth quota in GB |
| `max_active_links` | integer | 10 | Max shared links |
| `valid_until` | timestamp | null | Expiration date |
| `is_active` | boolean | true | Active status |

### Step 2.3: Modify Default Free Plan Limits

The default limits for new users are set in a database function.

**To Change Free Plan Defaults (Database Migration Required):**

```sql
-- Modify the handle_new_user_subscription function
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.subscriptions (
    user_id, 
    plan, 
    storage_limit_gb,        -- Change this value
    bandwidth_limit_gb,      -- Change this value
    max_active_links,        -- Change this value
    valid_until,
    is_active
  )
  VALUES (
    NEW.id, 
    'free', 
    1,                       -- Default: 1GB storage (was 5)
    10,                      -- Default: 10GB bandwidth (was 50)
    5,                       -- Default: 5 links (was 10)
    now() + interval '7 days', -- Demo period
    true
  );
  
  INSERT INTO public.usage_metrics (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$function$;
```

---

## Part 3: Default Subscription Values

### Step 3.1: Type Definitions

**File: `src/hooks/useAuth.tsx`**

```
Location: src/hooks/useAuth.tsx
Lines: 21-26
```

**Current Subscription Interface:**
```typescript
interface Subscription {
  user_id: string;
  plan: 'free' | 'premium' | 'lifetime';  // Line 22
  storage_limit_gb: number;                // Line 23
  bandwidth_limit_gb: number;              // Line 24
  max_active_links: number;                // Line 25
  valid_until: string | null;              // Line 26
}
```

**To Add New Plan Type:**

Modify line 22:
```typescript
plan: 'free' | 'premium' | 'lifetime' | 'enterprise';
```

---

## Part 4: User Management Integration

### Step 4.1: Default Values in User Management

**File: `src/pages/owner/UserManagement.tsx`**

```
Location: src/pages/owner/UserManagement.tsx
Lines: 140-145
```

**Current Default Values (when subscription is null):**
```typescript
{
  role: userRole?.role || "member",
  plan: subscription?.plan || "free",                    // Line 141
  storage_limit_gb: subscription?.storage_limit_gb || 5, // Line 142: Default 5GB
  bandwidth_limit_gb: subscription?.bandwidth_limit_gb || 50, // Line 143: Default 50GB
  max_active_links: subscription?.max_active_links || 10, // Line 144: Default 10 links
  valid_until: subscription?.valid_until,                 // Line 145
}
```

**To Change Fallback Defaults:**

Modify lines 142-144:
```typescript
storage_limit_gb: subscription?.storage_limit_gb || 1,   // Change to 1GB
bandwidth_limit_gb: subscription?.bandwidth_limit_gb || 10, // Change to 10GB
max_active_links: subscription?.max_active_links || 5,    // Change to 5 links
```

### Step 4.2: User Interface Definition

**File: `src/pages/owner/UserManagement.tsx`**

```
Location: src/pages/owner/UserManagement.tsx
Lines: 64-69
```

**Current UserItem Interface:**
```typescript
interface UserItem {
  // ... other fields
  role: string;
  plan: string;                  // Line 65
  storage_limit_gb: number;      // Line 66
  bandwidth_limit_gb: number;    // Line 67
  max_active_links: number;      // Line 68
  valid_until: string | null;    // Line 69
}
```

---

## Part 5: Billing & Analytics

### Step 5.1: Revenue Calculation

**File: `src/pages/owner/BillingOverview.tsx`**

```
Location: src/pages/owner/BillingOverview.tsx
Line: 63
```

**Current Revenue Formula:**
```typescript
totalRevenue: premiumUsers * 9.99 + lifetimeUsers * 99,
```

**To Update Revenue Calculation:**

Modify line 63 with your actual pricing:
```typescript
// Example: ₹179/month for premium, ₹1799 one-time for lifetime
totalRevenue: premiumUsers * 179 + lifetimeUsers * 1799,
```

### Step 5.2: Infrastructure Cost Rates

**File: `src/pages/owner/BillingOverview.tsx`**

```
Location: src/pages/owner/BillingOverview.tsx
Lines: 67-68
```

**Current Cost Rates:**
```typescript
totalStorageCost: storageGB * 0.02,     // Line 67: $0.02 per GB storage
totalBandwidthCost: bandwidthGB * 0.01, // Line 68: $0.01 per GB bandwidth
```

**To Update Cost Rates:**

Modify lines 67-68:
```typescript
totalStorageCost: storageGB * 0.05,     // $0.05 per GB storage
totalBandwidthCost: bandwidthGB * 0.03, // $0.03 per GB bandwidth
```

---

## Part 6: Contact Information

### Step 6.1: Telegram Contact

**File: `src/pages/Plans.tsx`**

```
Location: src/pages/Plans.tsx
Lines: 328-340, 375-388
```

**Current Telegram Configuration:**

```typescript
// Purchase Dialog - Lines 328-340
<a
  href="https://t.me/kartoos0070"           // Line 329: Telegram URL
  target="_blank"
  rel="noopener noreferrer"
  className="..."
>
  {/* ... */}
  <p className="text-sm text-muted-foreground">@kartoos0070</p>  // Line 339
</a>

// Custom Plan Dialog - Lines 375-388
<a
  href="https://t.me/kartoos0070"           // Line 376: Telegram URL
  target="_blank"
  rel="noopener noreferrer"
>
  {/* ... */}
  <p className="text-sm text-muted-foreground">@kartoos0070</p>  // Line 386
</a>
```

**To Change Telegram Contact:**

Update lines 329, 339, 376, 386:
```typescript
href="https://t.me/YOUR_USERNAME"
// and
@YOUR_USERNAME
```

### Step 6.2: Instagram Contact

**File: `src/pages/Plans.tsx`**

```
Location: src/pages/Plans.tsx
Lines: 342-357, 389-404
```

**Current Instagram Configuration:**

```typescript
// Purchase Dialog - Lines 342-357
<a
  href="https://instagram.com/theriturajprince"  // Line 343: Instagram URL
  target="_blank"
  rel="noopener noreferrer"
>
  {/* ... */}
  <p className="text-sm text-muted-foreground">@theriturajprince</p>  // Line 355
</a>

// Custom Plan Dialog - Lines 389-404
<a
  href="https://instagram.com/theriturajprince"  // Line 390: Instagram URL
>
  {/* ... */}
  <p className="text-sm text-muted-foreground">@theriturajprince</p>  // Line 402
</a>
```

**To Change Instagram Contact:**

Update lines 343, 355, 390, 402:
```typescript
href="https://instagram.com/YOUR_USERNAME"
// and
@YOUR_USERNAME
```

---

## Part 7: Adding New Plan Tiers

### Step 7.1: Add New Plan to Frontend

**File: `src/pages/Plans.tsx`**

**Example: Adding a "500 GB" Monthly Plan**

Insert after line 47 (after the 400 GB plan):
```typescript
  {
    id: 'monthly-500',
    name: '500 GB',
    storage: 500,
    bandwidth: 2500,
    links: 250,
    price: 349,
    period: '1 month',
    popular: false,
  },
```

### Step 7.2: Add New Plan Type to Database

If adding a completely new plan category (e.g., "enterprise"):

**1. Create Database Migration:**

```sql
-- Add new plan type to enum
ALTER TYPE subscription_plan ADD VALUE 'enterprise';

-- Update type definition will be auto-generated
```

**2. Update TypeScript Types:**

The `src/integrations/supabase/types.ts` file is auto-generated from the database. After running the migration, the types will update automatically.

**3. Update Frontend Displays:**

Add new plan type handling in:
- `src/pages/owner/UserManagement.tsx`
- `src/pages/owner/BillingOverview.tsx`
- `src/hooks/useAuth.tsx`

---

## Common Customization Scenarios

### Scenario 1: Change All Prices by a Percentage

**Files to Modify:**
- `src/pages/Plans.tsx` - Lines 24, 34, 44, 54 (monthly)
- `src/pages/Plans.tsx` - Lines 67, 77, 87, 97 (lifetime)

**Example: Increase all prices by 20%:**
```typescript
// Monthly Plans (multiply each price by 1.2)
price: 119,   // Was 99
price: 215,   // Was 179
price: 359,   // Was 299
price: 599,   // Was 499

// Lifetime Plans (multiply each price by 1.2)
price: 1199,  // Was 999
price: 2159,  // Was 1799
price: 3599,  // Was 2999
price: 5999,  // Was 4999
```

### Scenario 2: Change Currency from ₹ to $

**Files to Modify:**
- `src/pages/Plans.tsx` - Lines 169, 232, 315

**Changes:**
```typescript
// Line 169
<span className="text-3xl font-bold text-foreground">${plan.price}</span>

// Line 232
<span className="text-3xl font-bold text-foreground">${plan.price}</span>

// Line 315
Contact us to complete your purchase for ${selectedPlan?.price}
```

### Scenario 3: Add Free Trial Period

**Database Migration Required:**

```sql
-- Modify handle_new_user_subscription function
-- Change the valid_until interval from 7 days to desired trial period
valid_until: now() + interval '14 days',  -- 14 day trial
-- or
valid_until: now() + interval '30 days',  -- 30 day trial
```

### Scenario 4: Remove Lifetime Plans

**File: `src/pages/Plans.tsx`**

1. Delete lines 60-101 (lifetimePlans array)
2. Delete lines 202-267 (Lifetime Plans section in JSX)
3. Update `handleSelectPlan` if needed

### Scenario 5: Add New Contact Method (WhatsApp)

**File: `src/pages/Plans.tsx`**

Add after Instagram contact block (around line 357):

```typescript
<a
  href="https://wa.me/YOUR_PHONE_NUMBER"
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
>
  <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
    <MessageCircle className="w-5 h-5 text-white" />
  </div>
  <div>
    <p className="font-medium text-foreground">WhatsApp</p>
    <p className="text-sm text-muted-foreground">+91 XXXXXXXXXX</p>
  </div>
</a>
```

---

## File Change Summary

### Primary Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/pages/Plans.tsx` | Main plans display page | 17-101, 114-121, 169, 232, 329-404 |
| `src/pages/owner/UserManagement.tsx` | Owner grants plans to users | 64-69, 140-145 |
| `src/pages/owner/BillingOverview.tsx` | Revenue analytics | 63, 67-68 |
| `src/hooks/useAuth.tsx` | Subscription type definitions | 21-26 |

### Database (Migrations)

| Entity | Purpose | Location |
|--------|---------|----------|
| `subscription_plan` enum | Plan type values | Database |
| `subscriptions` table | User subscription data | Database |
| `handle_new_user_subscription` | Default plan on signup | Database Function |

---

## Validation Checklist

After making plan changes:

- [ ] Plans display correctly on `/plans` page
- [ ] Prices show correct currency symbol
- [ ] "Popular" badge shows on correct plan
- [ ] Contact links work correctly
- [ ] Owner can still grant plans to users
- [ ] Billing analytics calculate correctly
- [ ] New users get correct default limits
- [ ] Existing subscriptions still work

---

**Last Updated:** December 2024  
**Version:** 1.0.0
