import { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightHaptic, selectionHaptic } from "@/lib/haptics";
import { listItem } from "@/lib/motion";

interface IosListProps {
  children: ReactNode;
  className?: string;
}

export function IosList({ children, className }: IosListProps) {
  return (
    <div
      className={cn(
        "rounded-2xl backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface IosListItemProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string | ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function IosListItem({
  icon,
  title,
  subtitle,
  value,
  showChevron = false,
  destructive = false,
  disabled = false,
  onClick,
  className,
}: IosListItemProps) {
  const handleClick = () => {
    if (disabled) return;
    selectionHaptic();
    onClick?.();
  };

  return (
    <motion.div
      variants={listItem}
      whileTap={!disabled ? { scale: 0.98, backgroundColor: "rgba(255,255,255,0.06)" } : undefined}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 min-h-[52px]",
        "transition-colors duration-150",
        !disabled && onClick && "cursor-pointer active:bg-white/[0.06]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {icon && (
        <div className={cn(
          "p-2 rounded-xl",
          destructive 
            ? "bg-red-500/20 text-red-400" 
            : "bg-white/[0.08] text-white/70"
        )}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[15px] font-medium leading-tight",
          destructive ? "text-red-400" : "text-white"
        )}>
          {title}
        </p>
        {subtitle && (
          <p className="text-[13px] text-white/50 mt-0.5 leading-tight truncate">
            {subtitle}
          </p>
        )}
      </div>
      {value && (
        <div className="text-[15px] text-white/50 flex-shrink-0">
          {value}
        </div>
      )}
      {showChevron && (
        <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
      )}
    </motion.div>
  );
}

interface IosListHeaderProps {
  title: string;
  className?: string;
}

export function IosListHeader({ title, className }: IosListHeaderProps) {
  return (
    <div className={cn(
      "px-4 py-2 text-[13px] font-medium text-white/40 uppercase tracking-wider",
      className
    )}>
      {title}
    </div>
  );
}

interface IosListSectionProps {
  header?: string;
  children: ReactNode;
  className?: string;
}

export function IosListSection({ header, children, className }: IosListSectionProps) {
  return (
    <div className={cn("mb-6", className)}>
      {header && <IosListHeader title={header} />}
      <IosList>{children}</IosList>
    </div>
  );
}

export default IosList;
