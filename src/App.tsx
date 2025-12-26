import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import FileManager from "./pages/FileManager";
import SharedLinks from "./pages/SharedLinks";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Plans from "./pages/Plans";
import SharedFile from "./pages/SharedFile";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import UserManagement from "./pages/owner/UserManagement";
import UserAnalytics from "./pages/owner/UserAnalytics";
import AuditLogs from "./pages/owner/AuditLogs";
import SecuritySettings from "./pages/owner/SecuritySettings";
import BillingOverview from "./pages/owner/BillingOverview";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUserManagement from "./pages/admin/AdminUserManagement";
import ReportManagement from "./pages/admin/ReportManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/share/:shortCode" element={<SharedFile />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/files" element={<ProtectedRoute><FileManager /></ProtectedRoute>} />
            <Route path="/dashboard/links" element={<ProtectedRoute><SharedLinks /></ProtectedRoute>} />
            <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/dashboard/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
            {/* Admin routes */}
            <Route path="/dashboard/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUserManagement /></ProtectedRoute>} />
            <Route path="/dashboard/admin/reports" element={<ProtectedRoute requiredRole="admin"><ReportManagement /></ProtectedRoute>} />
            {/* Owner routes */}
            <Route path="/dashboard/users" element={<ProtectedRoute requiredRole="owner"><UserManagement /></ProtectedRoute>} />
            <Route path="/dashboard/user-analytics" element={<ProtectedRoute requiredRole="owner"><UserAnalytics /></ProtectedRoute>} />
            <Route path="/dashboard/security" element={<ProtectedRoute requiredRole="owner"><SecuritySettings /></ProtectedRoute>} />
            <Route path="/dashboard/billing" element={<ProtectedRoute requiredRole="owner"><BillingOverview /></ProtectedRoute>} />
            <Route path="/dashboard/audit" element={<ProtectedRoute requiredRole="owner"><AuditLogs /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
