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
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import UserManagement from "./pages/owner/UserManagement";
import AuditLogs from "./pages/owner/AuditLogs";
import SecuritySettings from "./pages/owner/SecuritySettings";
import BillingOverview from "./pages/owner/BillingOverview";
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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            {/* Owner routes */}
            <Route path="/dashboard/users" element={<ProtectedRoute requiredRole="owner"><UserManagement /></ProtectedRoute>} />
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
