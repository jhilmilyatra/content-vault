import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface IosHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  isScrolled?: boolean;
  large?: boolean;
  className?: string;
}

export function IosHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  isScrolled = false,
  large = true,
  className,
}: IosHeaderProps) {
  return (
    <motion.header
      className={cn(
        "sticky top-0 z-30 transition-all duration-300",
        isScrolled
          ? "bg-black/80 backdrop-blur-xl border-b border-white/[0.08]"
          : "bg-transparent border-b border-transparent",
        className
      )}
    >
      {/* Compact header bar */}
      <div className="flex items-center justify-between h-14 px-4 safe-area-top">
        <div className="w-20 flex justify-start">
          {leftAction}
        </div>
        
        <motion.h1
          initial={false}
          animate={{
            opacity: isScrolled && large ? 1 : 0,
            y: isScrolled && large ? 0 : -8,
          }}
          transition={{ duration: 0.2 }}
          className="text-[17px] font-semibold text-white"
        >
          {title}
        </motion.h1>
        
        <div className="w-20 flex justify-end">
          {rightAction}
        </div>
      </div>

      {/* Large title (iOS style) */}
      {large && (
        <motion.div
          initial={false}
          animate={{
            opacity: isScrolled ? 0 : 1,
            height: isScrolled ? 0 : "auto",
            marginBottom: isScrolled ? 0 : 16,
          }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="px-4 overflow-hidden"
        >
          <h1 className="text-[34px] font-bold text-white tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] text-white/50 mt-1">
              {subtitle}
            </p>
          )}
        </motion.div>
      )}
    </motion.header>
  );
}

export default IosHeader;
