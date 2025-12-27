import { motion } from "framer-motion";

interface TypingIndicatorProps {
  name?: string;
  compact?: boolean;
}

const TypingIndicator = ({ name, compact = false }: TypingIndicatorProps) => {
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-[10px]" : "text-xs"} text-muted-foreground`}>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`rounded-full bg-muted-foreground ${compact ? "w-1 h-1" : "w-1.5 h-1.5"}`}
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {name && <span>{name} is typing...</span>}
      {!name && <span>typing...</span>}
    </div>
  );
};

export default TypingIndicator;
