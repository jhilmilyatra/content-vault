import { memo } from "react";
import logo from "@/assets/logo.png";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const LoadingSpinner = memo(({ size = "md", text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <div className={`${sizeClasses[size]} rounded-lg bg-white p-1 animate-pulse`}>
        <img src={logo} alt="Loading" className="w-full h-full object-contain" />
      </div>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
});

LoadingSpinner.displayName = "LoadingSpinner";

export default LoadingSpinner;
