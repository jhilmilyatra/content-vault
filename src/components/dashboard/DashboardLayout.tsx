import { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
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
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import MemberChatPanel from "./MemberChatPanel";
import NotificationDropdown from "./NotificationDropdown";
import IosTabBar from "@/components/ios/IosTabBar";
import { cn } from "@/lib/utils";
import { lightHaptic } from "@/lib/haptics";
import logo from "@/assets/logo.png";

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
  { icon: Plus, label: "Add", path: "/dashboard/files" },
  { icon: BarChart3, label: "Stats", path: "/dashboard/analytics" },
  { icon: Settings, label: "More", path: "/dashboard/settings" },
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
  { icon: Settings, label: "More", path: "/dashboard/settings" },
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
  { icon: Menu, label: "More", path: "/dashboard/settings" },
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
    onClick={() => lightHaptic()}
    className={cn(
      "flex items-center gap-3 px-3 py-3 rounded-xl",
      "transition-all duration-200 ease-out",
      "touch-manipulation min-h-[48px]",
      "group relative",
      "active:scale-[0.98]",
      isActive 
        ? "bg-[#007AFF]/15 text-[#007AFF]" 
        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
    )}
  >
    <item.icon className={cn(
      "w-5 h-5 flex-shrink-0 transition-colors",
      isActive ? "text-[#007AFF]" : "text-white/50 group-hover:text-white/80"
    )} />
    {(!collapsed || isMobile) && (
      <span className="text-[15px] font-medium">{item.label}</span>
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
    lightHaptic();
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
    lightHaptic();
    setMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const toggleChat = useCallback(() => {
    lightHaptic();
    setChatOpen(prev => !prev);
  }, []);

  const sidebarWidth = isMobile ? 280 : (collapsed ? 72 : 260);

  // Get current page title
  const getPageTitle = () => {
    const currentItem = navItems.find(item => item.path === location.pathname);
    return currentItem?.label || "Dashboard";
  };

  return (
    <div className="min-h-dvh bg-black flex">
      {/* iOS-style ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#007AFF]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
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
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed left-0 top-0 bottom-0 z-50",
              "bg-black/90 backdrop-blur-2xl border-r border-white/[0.06]",
              "flex flex-col"
            )}
          >
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06] safe-area-top">
              <Link to="/" className="flex items-center gap-3" onClick={() => lightHaptic()}>
                <div className="h-10 w-10 rounded-lg bg-white p-1 flex items-center justify-center">
                  <img src={logo} alt="CloudVault" className="h-full w-full object-contain" />
                </div>
                {(!collapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-[17px] font-semibold text-white"
                  >
                    CloudVault
                  </motion.span>
                )}
              </Link>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.06] active:scale-95"
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
                  "px-3 py-2.5 rounded-xl text-[13px] font-semibold text-center uppercase tracking-wide",
                  role === "owner" && "bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 border border-amber-500/20",
                  role === "admin" && "bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-400 border border-violet-500/20",
                  role === "member" && "bg-gradient-to-r from-[#007AFF]/15 to-[#5856D6]/15 text-[#007AFF] border border-[#007AFF]/20"
                )}>
                  {role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member"}
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-hide">
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

            {/* User section */}
            {(!collapsed || isMobile) && (
              <div className="p-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white truncate">
                      {profile?.full_name || profile?.email || "User"}
                    </p>
                    <p className="text-[12px] text-white/40 truncate">
                      {profile?.email}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/[0.06] active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Collapse toggle - desktop only */}
            {!isMobile && (
              <div className="p-3 border-t border-white/[0.06]">
                <button
                  onClick={toggleCollapsed}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl",
                    "text-white/40 hover:text-white hover:bg-white/[0.06]",
                    "transition-all duration-200 active:scale-95"
                  )}
                >
                  {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  {!collapsed && <span className="text-[14px]">Collapse</span>}
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
        {/* iOS-style sticky header */}
        <header 
          className={cn(
            "sticky top-0 z-30 transition-all duration-300 safe-area-top",
            headerIsGlass 
              ? "bg-black/80 backdrop-blur-2xl border-b border-white/[0.08]" 
              : "bg-transparent border-b border-transparent"
          )}
        >
          {/* Compact bar */}
          <div className="h-14 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              {/* Back button for sub-pages */}
              {location.pathname !== "/dashboard" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-[#007AFF] hover:bg-white/[0.06] active:scale-95"
                  onClick={() => {
                    lightHaptic();
                    navigate("/dashboard");
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              {/* Mobile menu toggle */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white/60 hover:text-white hover:bg-white/[0.06] active:scale-95"
                  onClick={toggleMobileMenu}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              {/* Compact title (visible on scroll) */}
              <motion.h1
                initial={false}
                animate={{
                  opacity: headerIsGlass ? 1 : 0,
                  x: headerIsGlass ? 0 : -8,
                }}
                transition={{ duration: 0.2 }}
                className="text-[17px] font-semibold text-white"
              >
                {getPageTitle()}
              </motion.h1>
            </div>

            <div className="flex items-center gap-1">
              {/* Chat button for members */}
              {role === "member" && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleChat}
                  className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/[0.06] active:scale-95"
                >
                  <MessageSquare className="w-5 h-5" />
                </Button>
              )}
              
              <NotificationDropdown />
              
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white font-semibold text-[13px] shadow-lg shadow-[#007AFF]/20 ml-1">
                {getInitials()}
              </div>
            </div>
          </div>

          {/* Large title (iOS style) */}
          {!isMobile && (
            <motion.div
              initial={false}
              animate={{
                opacity: headerIsGlass ? 0 : 1,
                height: headerIsGlass ? 0 : "auto",
                paddingBottom: headerIsGlass ? 0 : 16,
              }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="px-4 overflow-hidden"
            >
              <h1 className="text-[34px] font-bold text-white tracking-tight">
                {getPageTitle()}
              </h1>
            </motion.div>
          )}
        </header>

        {/* Page content */}
        <main className={cn(
          "px-4 py-4",
          isMobile && "pb-24"
        )}>
          {/* Large title for mobile (always visible in content) */}
          {isMobile && (
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-[28px] font-bold text-white tracking-tight mb-4"
            >
              {getPageTitle()}
            </motion.h1>
          )}
          {children}
        </main>
      </div>

      {/* iOS-style Bottom Tab Bar */}
      {isMobile && (
        <IosTabBar items={bottomNavItems} />
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
