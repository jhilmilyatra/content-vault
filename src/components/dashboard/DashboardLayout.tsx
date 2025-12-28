import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Cloud, 
  LayoutDashboard, 
  FolderOpen, 
  Link2, 
  BarChart3, 
  Settings,
  Users,
  Shield,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  FileWarning,
  Trash2,
  HardDrive,
  ShieldCheck,
  UserCheck,
  MessageSquare,
  Menu,
  X,
  LucideIcon,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import MemberChatPanel from "./MemberChatPanel";
import NotificationDropdown from "./NotificationDropdown";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

const memberNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FolderOpen, label: "Files", path: "/dashboard/files" },
  { icon: UserCheck, label: "Guests", path: "/dashboard/guests" },
  { icon: Link2, label: "Share Links", path: "/dashboard/links" },
  { icon: Trash2, label: "Trash", path: "/dashboard/trash" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: CreditCard, label: "Plans", path: "/dashboard/plans" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Users", path: "/dashboard/admin/users" },
  { icon: FileWarning, label: "Reports", path: "/dashboard/admin/reports" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

const ownerNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Activity, label: "System Monitor", path: "/dashboard/system-monitoring" },
  { icon: Users, label: "Users", path: "/dashboard/users" },
  { icon: UserCheck, label: "Guests", path: "/dashboard/guest-controls" },
  { icon: MessageSquare, label: "Member Chat", path: "/dashboard/member-chat" },
  { icon: ShieldCheck, label: "Admin Permissions", path: "/dashboard/admin-permissions" },
  { icon: HardDrive, label: "Storage", path: "/dashboard/storage" },
  { icon: Shield, label: "Security", path: "/dashboard/security" },
  { icon: CreditCard, label: "Billing", path: "/dashboard/billing" },
  { icon: FileWarning, label: "Reports", path: "/dashboard/admin/reports" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: BarChart3, label: "User Stats", path: "/dashboard/user-analytics" },
  { icon: FileText, label: "Audit Logs", path: "/dashboard/audit" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

// Memoized nav item component
const NavItemComponent = memo(({ 
  item, 
  isActive, 
  collapsed, 
  isMobile 
}: { 
  item: NavItem; 
  isActive: boolean; 
  collapsed: boolean;
  isMobile: boolean;
}) => (
  <Link
    to={item.path}
    className={`flex items-center gap-3 px-3 py-2.5 sm:py-2.5 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px]
      ${isActive 
        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70"
      }
    `}
  >
    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
    {(!collapsed || isMobile) && (
      <span className="text-sm font-medium">{item.label}</span>
    )}
  </Link>
));

NavItemComponent.displayName = "NavItemComponent";

const DashboardLayout = memo(({ children }: DashboardLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const navItems = role === "owner" ? ownerNavItems : role === "admin" ? adminNavItems : memberNavItems;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  }, [signOut, toast, navigate]);

  const getInitials = useCallback(() => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return 'U';
  }, [profile]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen(prev => !prev);
  }, []);

  const sidebarWidth = isMobile ? 280 : (collapsed ? 72 : 260);

  return (
    <div className="min-h-dvh bg-background flex">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={closeMobileMenu}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(!isMobile || mobileMenuOpen) && (
          <motion.aside
            initial={isMobile ? { x: -280 } : false}
            animate={{ x: 0, width: isMobile ? 280 : (collapsed ? 72 : 260) }}
            exit={isMobile ? { x: -280 } : undefined}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`${isMobile ? 'fixed' : 'fixed'} left-0 top-0 bottom-0 z-50 bg-sidebar border-r border-sidebar-border flex flex-col safe-area-inset`}
          >
            {/* Logo */}
            <div className="h-14 sm:h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
              <Link to="/" className="flex items-center gap-3 touch-manipulation">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                  <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                {(!collapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-base sm:text-lg font-bold text-sidebar-foreground"
                  >
                    CloudVault
                  </motion.span>
                )}
              </Link>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 touch-manipulation"
                  onClick={closeMobileMenu}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Role badge */}
            {(!collapsed || isMobile) && (
              <div className="px-4 py-3">
                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium text-center
                  ${role === "owner" ? "bg-amber-500/20 text-amber-400" : ""}
                  ${role === "admin" ? "bg-violet-500/20 text-violet-400" : ""}
                  ${role === "member" ? "bg-primary/20 text-primary" : ""}
                `}>
                  {role === "owner" ? "Owner Panel" : role === "admin" ? "Admin Panel" : "Member Panel"}
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scroll-smooth">
              {navItems.map((item) => (
                <NavItemComponent
                  key={item.path}
                  item={item}
                  isActive={location.pathname === item.path}
                  collapsed={collapsed}
                  isMobile={isMobile}
                />
              ))}
            </nav>

            {/* Collapse toggle - desktop only */}
            {!isMobile && (
              <div className="p-3 border-t border-sidebar-border">
                <button
                  onClick={toggleCollapsed}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors touch-manipulation"
                >
                  {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  {!collapsed && <span className="text-sm">Collapse</span>}
                </button>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div 
        className="flex-1 transition-all duration-200 min-w-0"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        {/* Top bar */}
        <header className="h-14 sm:h-16 bg-background/80 backdrop-blur-lg border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30 safe-area-inset">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-md">
            {/* Mobile menu toggle */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 flex-shrink-0 touch-manipulation"
                onClick={toggleMobileMenu}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-10 bg-muted border-border h-9 sm:h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationDropdown />
            
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs sm:text-sm">
              {getInitials()}
            </div>

            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 touch-manipulation">
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 sm:p-6">
          {children}
        </main>
      </div>

      {/* Member Chat Panel */}
      {role === "member" && (
        <MemberChatPanel isOpen={chatOpen} onClose={toggleChat} />
      )}
    </div>
  );
});

DashboardLayout.displayName = "DashboardLayout";

export default DashboardLayout;
