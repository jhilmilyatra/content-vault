// Apple iOS-style motion presets
// Aligned with Apple Human Interface Guidelines

export const pageTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: {
    duration: 0.45,
    ease: [0.22, 1, 0.36, 1] as const, // Apple-like easing
  },
};

export const cardTap = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.15 },
};

export const cardPress = {
  whileTap: { scale: 0.96, opacity: 0.9 },
  transition: { 
    type: "spring" as const,
    stiffness: 400, 
    damping: 25 
  },
};

export const modalMotion = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.95 },
  transition: { 
    duration: 0.35, 
    ease: [0.22, 1, 0.36, 1] as const 
  },
};

export const slideUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 24 },
  transition: {
    duration: 0.4,
    ease: [0.22, 1, 0.36, 1] as const,
  },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

export const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
    },
  },
};

// iOS-style spring configurations
export const springConfig = {
  gentle: { type: "spring" as const, stiffness: 120, damping: 14 },
  wobbly: { type: "spring" as const, stiffness: 180, damping: 12 },
  stiff: { type: "spring" as const, stiffness: 400, damping: 30 },
  default: { type: "spring" as const, stiffness: 300, damping: 24 },
};

// Tab bar animation
export const tabIndicator = {
  transition: { 
    type: "spring" as const, 
    stiffness: 500, 
    damping: 30 
  },
};
