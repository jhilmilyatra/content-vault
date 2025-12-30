import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { GuestAuthProvider } from "@/contexts/GuestAuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useCacheInvalidation } from "@/hooks/useCacheInvalidation";

// Eagerly loaded routes (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy loaded routes - Dashboard
const Dashboard = lazy(() => import("./pages/Dashboard"));
const FileManager = lazy(() => import("./pages/FileManager"));
const SharedLinks = lazy(() => import("./pages/SharedLinks"));
const TrashBin = lazy(() => import("./pages/TrashBin"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Plans = lazy(() => import("./pages/Plans"));
const SharedFile = lazy(() => import("./pages/SharedFile"));
const TelegramGuide = lazy(() => import("./pages/TelegramGuide"));
const UploadHistory = lazy(() => import("./pages/UploadHistory"));
const Documentation = lazy(() => import("./pages/Documentation"));

// Lazy loaded routes - Owner
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard"));
const UserManagement = lazy(() => import("./pages/owner/UserManagement"));
const UserAnalytics = lazy(() => import("./pages/owner/UserAnalytics"));
const AuditLogs = lazy(() => import("./pages/owner/AuditLogs"));
const SecuritySettings = lazy(() => import("./pages/owner/SecuritySettings"));
const BillingOverview = lazy(() => import("./pages/owner/BillingOverview"));
const StorageSettings = lazy(() => import("./pages/owner/StorageSettings"));
const AdminPermissions = lazy(() => import("./pages/owner/AdminPermissions"));
const OwnerGuestControls = lazy(() => import("./pages/owner/OwnerGuestControls"));
const OwnerMemberChat = lazy(() => import("./pages/owner/OwnerMemberChat"));
const SystemMonitoring = lazy(() => import("./pages/owner/SystemMonitoring"));

// Lazy loaded routes - Admin
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUserManagement = lazy(() => import("./pages/admin/AdminUserManagement"));
const ReportManagement = lazy(() => import("./pages/admin/ReportManagement"));

// Lazy loaded routes - Guest
const GuestAuth = lazy(() => import("./pages/guest/GuestAuth"));
const GuestPortal = lazy(() => import("./pages/guest/GuestPortal"));
const GuestFolderView = lazy(() => import("./pages/guest/GuestFolderView"));
const GuestHelpDesk = lazy(() => import("./pages/guest/GuestHelpDesk"));

// Lazy loaded routes - Dashboard sub-pages
const GuestManagement = lazy(() => import("./pages/dashboard/GuestManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

// QueryClient with aggressive caching for fast performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - data considered fresh
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Don't refetch on mount if data exists
      refetchOnReconnect: false, // Don't refetch on reconnect
      networkMode: 'offlineFirst', // Use cached data first
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// Suspense fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <LoadingSpinner size="lg" text="Loading..." />
  </div>
);

// Component to initialize global hooks
function GlobalHooks() {
  useCacheInvalidation();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <GuestAuthProvider>
              <GlobalHooks />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/documentation" element={<Documentation />} />
                  <Route path="/share/:shortCode" element={<SharedFile />} />
                  
                  {/* Guest Portal Routes */}
                  <Route path="/guest-auth" element={<GuestAuth />} />
                  <Route path="/guest-portal" element={<GuestPortal />} />
                  <Route path="/guest-portal/folder/:folderId" element={<GuestFolderView />} />
                  <Route path="/guest-portal/help" element={<GuestHelpDesk />} />
                  
                  {/* Member Dashboard Routes */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/dashboard/files" element={<ProtectedRoute><FileManager /></ProtectedRoute>} />
                  <Route path="/dashboard/guests" element={<ProtectedRoute><GuestManagement /></ProtectedRoute>} />
                  <Route path="/dashboard/links" element={<ProtectedRoute><SharedLinks /></ProtectedRoute>} />
                  <Route path="/dashboard/trash" element={<ProtectedRoute><TrashBin /></ProtectedRoute>} />
                  <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/dashboard/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
                  <Route path="/dashboard/telegram-guide" element={<ProtectedRoute><TelegramGuide /></ProtectedRoute>} />
                  <Route path="/dashboard/upload-history" element={<ProtectedRoute><UploadHistory /></ProtectedRoute>} />
                  <Route path="/dashboard/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUserManagement /></ProtectedRoute>} />
                  <Route path="/dashboard/admin/reports" element={<ProtectedRoute requiredRole="admin"><ReportManagement /></ProtectedRoute>} />
                  
                  {/* Owner routes */}
                  <Route path="/dashboard/users" element={<ProtectedRoute requiredRole="owner"><UserManagement /></ProtectedRoute>} />
                  <Route path="/dashboard/user-analytics" element={<ProtectedRoute requiredRole="owner"><UserAnalytics /></ProtectedRoute>} />
                  <Route path="/dashboard/security" element={<ProtectedRoute requiredRole="owner"><SecuritySettings /></ProtectedRoute>} />
                  <Route path="/dashboard/billing" element={<ProtectedRoute requiredRole="owner"><BillingOverview /></ProtectedRoute>} />
                  <Route path="/dashboard/audit" element={<ProtectedRoute requiredRole="owner"><AuditLogs /></ProtectedRoute>} />
                  <Route path="/dashboard/storage" element={<ProtectedRoute requiredRole="owner"><StorageSettings /></ProtectedRoute>} />
                  <Route path="/dashboard/admin-permissions" element={<ProtectedRoute requiredRole="owner"><AdminPermissions /></ProtectedRoute>} />
                  <Route path="/dashboard/guest-controls" element={<ProtectedRoute requiredRole="owner"><OwnerGuestControls /></ProtectedRoute>} />
                  <Route path="/dashboard/member-chat" element={<ProtectedRoute requiredRole="owner"><OwnerMemberChat /></ProtectedRoute>} />
                  <Route path="/dashboard/system-monitoring" element={<ProtectedRoute requiredRole="owner"><SystemMonitoring /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </GuestAuthProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
