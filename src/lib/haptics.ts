// iOS-style haptic feedback utilities
// Web-safe tactile illusion via vibration API

export function lightHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(8); // Very subtle
  }
}

export function mediumHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(15);
  }
}

export function heavyHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(25);
  }
}

export function successHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([10, 50, 10]); // Double tap pattern
  }
}

export function errorHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([20, 30, 20, 30, 20]); // Triple pattern
  }
}

export function selectionHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(5); // Ultra light
  }
}
