import { memo, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectionHaptic } from "@/lib/haptics";

interface TabItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface IosTabBarProps {
  items: TabItem[];
  maxItems?: number;
}

const IosTabBar = memo(({ items, maxItems = 5 }: IosTabBarProps) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      if (scrollDelta > 15 && currentScrollY > 100) {
        setIsVisible(false);
      } else if (scrollDelta < -10) {
        setIsVisible(true);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 400);

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

  const visibleItems = items.slice(0, maxItems);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 35,
            mass: 0.8,
          }}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "bg-black/70 backdrop-blur-2xl",
            "border-t border-white/[0.08]",
            "safe-area-bottom"
          )}
        >
          <div className="flex items-center justify-around max-w-lg mx-auto px-2 pt-2 pb-1">
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => selectionHaptic()}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "min-w-[64px] py-1.5 rounded-xl",
                    "touch-manipulation select-none",
                    "transition-all duration-200",
                    "active:scale-90"
                  )}
                >
                  <motion.div
                    initial={false}
                    animate={isActive ? { scale: 1.05, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="relative"
                  >
                    <Icon 
                      className={cn(
                        "w-6 h-6 transition-colors duration-200",
                        isActive ? "text-[#007AFF]" : "text-white/40"
                      )} 
                    />
                  </motion.div>
                  <span
                    className={cn(
                      "text-[10px] font-medium mt-0.5 transition-colors duration-200",
                      isActive ? "text-[#007AFF]" : "text-white/40"
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

IosTabBar.displayName = "IosTabBar";

export default IosTabBar;
