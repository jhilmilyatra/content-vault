import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { lightHaptic } from "@/lib/haptics";

interface Segment {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface IosSegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function IosSegmentedControl({
  segments,
  value,
  onChange,
  size = "md",
  className,
}: IosSegmentedControlProps) {
  const selectedIndex = segments.findIndex((s) => s.value === value);

  const handleSelect = (segmentValue: string) => {
    if (segmentValue !== value) {
      lightHaptic();
      onChange(segmentValue);
    }
  };

  const sizeClasses = {
    sm: "h-8 text-xs",
    md: "h-10 text-sm",
    lg: "h-12 text-base",
  };

  const paddingClasses = {
    sm: "px-3",
    md: "px-4",
    lg: "px-5",
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center p-1 rounded-xl",
        "bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]",
        sizeClasses[size],
        className
      )}
    >
      {/* Animated Background Indicator */}
      <motion.div
        className="absolute inset-y-1 rounded-lg bg-white/[0.12] border border-white/[0.1] shadow-lg"
        initial={false}
        animate={{
          x: `calc(${selectedIndex * 100}% + ${selectedIndex * 4}px)`,
          width: `calc(${100 / segments.length}% - ${(segments.length - 1) * 4 / segments.length}px)`,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
        }}
        style={{
          left: 4,
        }}
      />

      {/* Segments */}
      {segments.map((segment) => (
        <button
          key={segment.value}
          onClick={() => handleSelect(segment.value)}
          className={cn(
            "relative z-10 flex items-center justify-center gap-2 font-medium transition-colors duration-200",
            paddingClasses[size],
            "flex-1 min-w-0",
            segment.value === value
              ? "text-white"
              : "text-white/50 hover:text-white/70"
          )}
        >
          {segment.icon}
          <span className="truncate">{segment.label}</span>
        </button>
      ))}
    </div>
  );
}

export default IosSegmentedControl;