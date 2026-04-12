import { useMemo } from 'react';

interface DeviceCapability {
  isLowEnd: boolean;
  prefersReducedMotion: boolean;
  effectiveType: string;
  hardwareConcurrency: number;
  deviceMemory: number;
}

/**
 * Detect device capabilities for adaptive rendering
 */
export function useDeviceCapability(): DeviceCapability {
  return useMemo(() => {
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType || '4g';
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const deviceMemory = (navigator as any).deviceMemory || 4;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isLowEnd =
      effectiveType === 'slow-2g' ||
      effectiveType === '2g' ||
      hardwareConcurrency <= 2 ||
      deviceMemory <= 2 ||
      prefersReducedMotion;

    return {
      isLowEnd,
      prefersReducedMotion,
      effectiveType,
      hardwareConcurrency,
      deviceMemory,
    };
  }, []);
}

/**
 * Get adaptive IntersectionObserver rootMargin based on device/network
 */
export function getAdaptiveRootMargin(): string {
  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType || '4g';
  const cores = navigator.hardwareConcurrency || 4;

  if (cores <= 2 || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return '100px';
  }
  if (effectiveType === '4g' && cores >= 4) {
    return '400px';
  }
  return '150px';
}
