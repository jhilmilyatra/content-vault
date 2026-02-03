import { useState, useEffect, useCallback, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard,
  FolderOpen, 
  Share2, 
  BarChart3, 
  Settings,
  Users,
  Shield,
  FileText,
  LogOut,
  Menu,
  X,
  LucideIcon,
  Activity,
  Bell,
  Plus,
  User,
  ChevronDown,
  CreditCard,
  MessageSquare,
  HelpCircle,
  History,
  Send,
  Palette,
  Mail,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import MemberChatPanel from "./MemberChatPanel";
import NotificationDropdown from "./NotificationDropdown";
import MaintenanceBanner from "./MaintenanceBanner";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

// Consolidated member navigation - max 5 primary items
const memberNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: FolderOpen, label: "Files", path: "/dashboard/files" },
  { icon: Share2, label: "Sharing", path: "/dashboard/links" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

// Mobile bottom nav - max 4 items (FAB is separate)
const memberBottomNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: FolderOpen, label: "Files", path: "/dashboard/files" },
  { icon: User, label: "Profile", path: "/dashboard/settings" },
];

// Owner navigation
const ownerNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Activity, label: "System", path: "/dashboard/system-monitoring" },
  { icon: Users, label: "Users", path: "/dashboard/users" },
  { icon: Shield, label: "Security", path: "/dashboard/security" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

// Owner system settings navigation
const ownerSettingsNavItems: NavItem[] = [
  { icon: Send, label: "Telegram", path: "/dashboard/admin/telegram" },
  { icon: Palette, label: "Branding", path: "/dashboard/admin/branding" },
  { icon: Mail, label: "Email", path: "/dashboard/admin/email" },
  { icon: Zap, label: "Features", path: "/dashboard/admin/features" },
];

const ownerBottomNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Activity, label: "System", path: "/dashboard/system-monitoring" },
  { icon: User, label: "Profile", path: "/dashboard/settings" },
];

// Admin navigation
const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Users, label: "Users", path: "/dashboard/admin/users" },
  { icon: FileText, label: "Reports", path: "/dashboard/admin/reports" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

const adminBottomNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Users, label: "Users", path: "/dashboard/admin/users" },
  { icon: User, label: "Profile", path: "/dashboard/settings" },
];

const NavItemComponent = memo(({ 
  item, 
  isActive, 
}: { 
  item: NavItem; 
  isActive: boolean; 
}) => (
  <Link
    to={item.path}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
      "transition-colors duration-150",
      "min-h-[40px]",
      isActive 
        ? "bg-primary/10 text-primary font-medium" 
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    )}
  >
    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
    <span className="text-sm">{item.label}</span>
  </Link>
));

NavItemComponent.displayName = "NavItemComponent";

const DashboardLayout = memo(({ children }: DashboardLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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

  const getPageTitle = () => {
    const currentItem = navItems.find(item => item.path === location.pathname);
    return currentItem?.label || "Dashboard";
  };

  return (
    <div className="min-h-dvh bg-background flex">
      {/* Mobile Menu Overlay - CSS transition */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity duration-200",
            mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop only */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-muted/30 border-r border-border flex flex-col z-30">
          {/* Logo */}
          <div className="h-14 flex items-center px-4 border-b border-border">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 p-1 flex items-center justify-center">
                <img src={logo} alt="CloudVault" className="h-full w-full object-contain" />
              </div>
              <span className="text-base font-semibold text-foreground">CloudVault</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavItemComponent
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
              />
            ))}
            
            {/* System Settings Section - Owner Only */}
            {role === "owner" && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    System Settings
                  </span>
                </div>
                {ownerSettingsNavItems.map((item) => (
                  <NavItemComponent
                    key={item.path}
                    item={item}
                    isActive={location.pathname === item.path}
                  />
                ))}
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name || profile?.email || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Sidebar - CSS transition */}
      {isMobile && (
        <aside
          className={cn(
            "fixed left-0 top-0 bottom-0 w-[280px] bg-background border-r border-border flex flex-col z-50",
            "transition-transform duration-250 ease-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-border">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 p-1 flex items-center justify-center">
                <img src={logo} alt="CloudVault" className="h-full w-full object-contain" />
              </div>
              <span className="text-base font-semibold text-foreground">CloudVault</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavItemComponent
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
              />
            ))}
            
            {/* System Settings Section - Owner Only */}
            {role === "owner" && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    System Settings
                  </span>
                </div>
                {ownerSettingsNavItems.map((item) => (
                  <NavItemComponent
                    key={item.path}
                    item={item}
                    isActive={location.pathname === item.path}
                  />
                ))}
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name || "User"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div 
        className="flex-1 flex flex-col min-w-0"
        style={{ marginLeft: isMobile ? 0 : 260 }}
      >
        {/* Maintenance Mode Banner */}
        <MaintenanceBanner />
        
        {/* Clean Header - 56px height */}
        <header className="sticky top-0 z-20 h-14 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-base font-medium text-foreground">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <NotificationDropdown />
            
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-9 px-2 gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                    {getInitials()}
                  </div>
                  {!isMobile && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                {role === "member" && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/dashboard/watch-history")}>
                      <History className="mr-2 h-4 w-4" />
                      <span>Watch History</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChatOpen(true)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span>Support Chat</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/dashboard/plans")}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Billing</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className={cn(
          "flex-1 p-4 md:p-6",
          isMobile && "pb-24"
        )}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
          <div className="flex items-center justify-around h-14 px-4">
            {bottomNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[64px] py-2",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
            {/* FAB placeholder for visual balance */}
            <div className="min-w-[64px]" />
          </div>
        </nav>
      )}

      {/* Floating Action Button - Mobile */}
      {isMobile && (
        <Link
          to="/dashboard/files"
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}

      {/* Member Chat Panel */}
      {role === "member" && (
        <MemberChatPanel 
          isOpen={chatOpen} 
          onClose={() => setChatOpen(false)} 
          onOpen={() => setChatOpen(true)}
        />
      )}
    </div>
  );
});

DashboardLayout.displayName = "DashboardLayout";

export default DashboardLayout;
