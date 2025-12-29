// iOS-style skeleton loaders with Apple shimmer effect
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg skeleton-shimmer",
        className
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl ios-glass p-5 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="rounded-2xl ios-glass overflow-hidden divide-y divide-white/[0.06]">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="p-4 flex items-center gap-3 animate-fade-up"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full"
          )} 
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <Skeleton className={cn("rounded-full", sizeClasses[size])} />
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl ios-glass overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32 flex-1" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          className="px-4 py-3 border-b border-white/[0.06] last:border-b-0 flex gap-4 animate-fade-up"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          className="rounded-2xl ios-glass p-5"
        >
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="w-12 h-12 rounded-xl" />
          </div>
          <Skeleton className="h-3 w-1/2 mb-2" />
          <Skeleton className="h-7 w-1/3" />
        </motion.div>
      ))}
    </div>
  );
}

export function SkeletonChatList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="p-4 rounded-xl ios-glass flex items-center gap-3 animate-fade-up"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonButton() {
  return <Skeleton className="h-10 w-24 rounded-xl" />;
}

export default Skeleton;
