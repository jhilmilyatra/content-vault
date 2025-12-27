import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'owner' | 'admin' | 'member';
}

/**
 * ProtectedRoute - Client-side route protection component
 * 
 * SECURITY NOTE: This component provides client-side role checks for UX purposes only.
 * It prevents unauthorized users from seeing restricted UI, but it is NOT a security boundary.
 * 
 * All sensitive operations are protected server-side through:
 * 1. Database RLS (Row Level Security) policies that validate user roles
 * 2. Edge functions (admin-suspend-user, owner-update-user, create-user, reset-user-password)
 *    that validate roles server-side before performing any operations
 * 3. The has_role() SECURITY DEFINER function for role verification in RLS policies
 * 
 * Client-side checks can be bypassed by determined attackers, so we never rely on them
 * for actual security - only for improving user experience by hiding inaccessible UI.
 */

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Role hierarchy: owner > admin > member
  if (requiredRole) {
    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    const userLevel = role ? roleHierarchy[role] : 0;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
