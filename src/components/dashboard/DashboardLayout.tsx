import { useState, useEffect, useCallback, memo } from "react";
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
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import MemberChatPanel from "./MemberChatPanel";
import NotificationDropdown from "./NotificationDropdown";
import MobileBottomNav from "./MobileBottomNav";
import { cn } from "@/lib/utils";

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

const memberBottomNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: FolderOpen, label: "Files", path: "/dashboard/files" },
  { icon: Link2, label: "Links", path: "/dashboard/links" },
  { icon: BarChart3, label: "Stats", path: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Users", path: "/dashboard/admin/users" },
  { icon: FileWarning, label: "Reports", path: "/dashboard/admin/reports" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

const adminBottomNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Users, label: "Users", path: "/dashboard/admin/users" },
  { icon: FileWarning, label: "Reports", path: "/dashboard/admin/reports" },
  { icon: BarChart3, label: "Stats", path: "/dashboard/analytics" },
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

const ownerBottomNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Activity, label: "System", path: "/dashboard/system-monitoring" },
  { icon: Users, label: "Users", path: "/dashboard/users" },
  { icon: Shield, label: "Security", path: "/dashboard/security" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

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
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl",
      "transition-all duration-200 ease-out",
      "touch-manipulation min-h-[44px]",
      "group relative",
      isActive 
        ? "bg-gradient-to-r from-teal-500/20 to-blue-500/10 text-white" 
        : "text-white/50 hover:text-white hover:bg-white/5"
    )}
  >
    {/* Active indicator */}
    {isActive && (
      <motion.div
        layoutId="activeNav"
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-teal-400 to-blue-500 rounded-full"
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    )}
    <item.icon className={cn(
      "w-5 h-5 flex-shrink-0 transition-colors",
      isActive ? "text-teal-400" : "text-white/50 group-hover:text-white/80"
    )} />
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
  const [headerIsGlass, setHeaderIsGlass] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const navItems = role === "owner" ? ownerNavItems : role === "admin" ? adminNavItems : memberNavItems;
  const bottomNavItems = role === "owner" ? ownerBottomNavItems : role === "admin" ? adminBottomNavItems : memberBottomNavItems;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  useEffect(() => {
    const handleScroll = () => {
      setHeaderIsGlass(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="min-h-dvh bg-[#0b0b0d] flex">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Scanline overlay */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={closeMobileMenu}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(!isMobile || mobileMenuOpen) && (
          <motion.aside
            initial={isMobile ? { x: -280, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1, width: isMobile ? 280 : (collapsed ? 72 : 260) }}
            exit={isMobile ? { x: -280, opacity: 0 } : undefined}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              "fixed left-0 top-0 bottom-0 z-50",
              "bg-[#0a0a0c]/95 backdrop-blur-xl border-r border-white/5",
              "flex flex-col"
            )}
          >
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20">
                  <Cloud className="w-6 h-6 text-white" />
                </div>
                {(!collapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="text-lg font-bold text-white"
                  >
                    CloudVault
                  </motion.span>
                )}
              </Link>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/5"
                  onClick={closeMobileMenu}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Role badge */}
            {(!collapsed || isMobile) && (
              <div className="px-4 py-3">
                <div className={cn(
                  "px-3 py-2 rounded-lg text-xs font-semibold text-center uppercase tracking-wider",
                  role === "owner" && "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/20",
                  role === "admin" && "bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-500/20",
                  role === "member" && "bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-teal-400 border border-teal-500/20"
                )}>
                  {role === "owner" ? "Owner Panel" : role === "admin" ? "Admin Panel" : "Member Panel"}
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
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
              <div className="p-3 border-t border-white/5">
                <button
                  onClick={toggleCollapsed}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl",
                    "text-white/50 hover:text-white hover:bg-white/5",
                    "transition-all duration-200"
                  )}
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
        className="flex-1 transition-all duration-300 ease-out min-w-0 relative z-10"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        {/* Top bar */}
        <header 
          className={cn(
            "h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30",
            "transition-all duration-300",
            "border-b",
            headerIsGlass 
              ? "bg-[#0b0b0d]/80 backdrop-blur-xl border-white/10" 
              : "bg-transparent border-transparent"
          )}
        >
          <div className="flex items-center gap-3 flex-1 max-w-md">
            {/* Back button for sub-pages */}
            {location.pathname !== "/dashboard" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 text-white/50 hover:text-white hover:bg-white/5"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            {/* Mobile menu toggle */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 flex-shrink-0 text-white/50 hover:text-white hover:bg-white/5"
                onClick={toggleMobileMenu}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search..."
                className="pl-10 bg-white/5 border-white/10 h-10 text-sm rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-teal-500/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chat button for members */}
            {role === "member" && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleChat}
                className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/5 relative"
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            )}
            
            <NotificationDropdown />
            
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-teal-500/20">
              {getInitials()}
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut} 
              className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className={cn(
          "p-4 sm:p-6",
          isMobile && "pb-24"
        )}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav items={bottomNavItems} />
      )}

      {/* Member Chat Panel */}
      {role === "member" && (
        <MemberChatPanel isOpen={chatOpen} onClose={toggleChat} />
      )}
    </div>
  );
});

DashboardLayout.displayName = "DashboardLayout";

export default DashboardLayout;
