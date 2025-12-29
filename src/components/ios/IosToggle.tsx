import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { lightHaptic } from "@/lib/haptics";

interface IosToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  className?: string;
}

export function IosToggle({
  checked,
  onCheckedChange,
  disabled = false,
  size = "md",
  label,
  description,
  className,
}: IosToggleProps) {
  const handleToggle = () => {
    if (!disabled) {
      lightHaptic();
      onCheckedChange(!checked);
    }
  };

  const sizeConfig = {
    sm: {
      track: "w-10 h-6",
      thumb: "w-4 h-4",
      translate: "translate-x-4",
    },
    md: {
      track: "w-12 h-7",
      thumb: "w-5 h-5",
      translate: "translate-x-5",
    },
    lg: {
      track: "w-14 h-8",
      thumb: "w-6 h-6",
      translate: "translate-x-6",
    },
  };

  const config = sizeConfig[size];

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleToggle}
      className={cn(
        "relative inline-flex items-center rounded-full p-1 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        config.track,
        checked
          ? "bg-gradient-to-r from-teal-500 to-teal-400"
          : "bg-white/[0.15]",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer"
      )}
    >
      <motion.span
        className={cn(
          "rounded-full bg-white shadow-lg",
          config.thumb
        )}
        initial={false}
        animate={{
          x: checked ? (size === "sm" ? 16 : size === "md" ? 20 : 24) : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      />
    </button>
  );

  if (!label) {
    return toggle;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-4 rounded-xl",
        "bg-white/[0.04] border border-white/[0.08]",
        "hover:bg-white/[0.06] transition-colors",
        disabled && "opacity-50",
        className
      )}
      onClick={handleToggle}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white">{label}</p>
        {description && (
          <p className="text-sm text-white/50 mt-0.5">{description}</p>
        )}
      </div>
      {toggle}
    </div>
  );
}

export default IosToggle;