import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { lightHaptic } from "@/lib/haptics";
import { cardPress } from "@/lib/motion";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  variant?: "default" | "elevated" | "inset" | "subtle";
}

export function GlassCard({ 
  children, 
  className, 
  interactive = false,
  variant = "default",
  onClick,
  ...props 
}: GlassCardProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interactive) {
      lightHaptic();
    }
    onClick?.(e);
  };

  const variantClasses = {
    default: "ios-glass",
    elevated: "ios-glass-elevated",
    inset: "bg-black/[0.3] border-white/[0.05]",
    subtle: "ios-glass-light",
  };

  return (
    <motion.div
      {...(interactive ? cardPress : {})}
      onClick={handleClick}
      className={cn(
        "rounded-2xl p-5",
        "transition-all duration-300",
        variantClasses[variant],
        interactive && "cursor-pointer ios-press ios-card-hover",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface GlassCardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function GlassCardHeader({ title, subtitle, icon, action }: GlassCardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-xl bg-white/[0.08] border border-white/[0.1]">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function StatCard({ title, value, icon, trend, trendValue, className, style }: StatCardProps) {
  return (
    <GlassCard className={className} style={style}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/50">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trendValue && (
            <p className={cn(
              "text-xs font-medium mt-2",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-white/40"
            )}>
              {trend === "up" && "↑ "}
              {trend === "down" && "↓ "}
              {trendValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-white/[0.1] to-white/[0.05] border border-white/[0.1]">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default GlassCard;
