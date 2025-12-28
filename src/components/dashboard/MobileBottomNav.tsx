import { memo, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface MobileBottomNavProps {
  items: NavItem[];
  maxVisibleItems?: number;
}

const MobileBottomNav = memo(({ items, maxVisibleItems = 5 }: MobileBottomNavProps) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Show/hide on scroll with smooth behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY;

      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Hide on scroll down, show on scroll up
      if (scrollDelta > 10 && currentScrollY > 100) {
        setIsVisible(false);
      } else if (scrollDelta < -5) {
        setIsVisible(true);
      }

      // Always show after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 300);

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [lastScrollY]);

  // Slice to max visible items
  const visibleItems = items.slice(0, maxVisibleItems);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8,
          }}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-40",
            "glass-elevated safe-area-bottom",
            "border-t border-border/30",
            "px-2 pt-2 pb-1"
          )}
        >
          <div className="flex items-center justify-around max-w-md mx-auto">
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "min-w-[56px] py-2 px-3 rounded-xl",
                    "touch-manipulation select-none-touch",
                    "transition-all duration-fast ease-natural",
                    "active:scale-95",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <motion.div
                    initial={false}
                    animate={isActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="relative"
                  >
                    <Icon className="w-5 h-5" />
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavIndicator"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.div>
                  <span
                    className={cn(
                      "text-[10px] mt-1 font-medium transition-colors duration-fast",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";

export default MobileBottomNav;