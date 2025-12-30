import { useCallback, useRef, useState } from 'react';
import { mediumHaptic } from '@/lib/haptics';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
  shouldPreventDefault?: boolean;
}

interface UseLongPressResult {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  shouldPreventDefault = true,
}: UseLongPressOptions): UseLongPressResult {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<EventTarget | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      // Store the starting position to detect movement
      if ('touches' in event) {
        startPosRef.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
      } else {
        startPosRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
      }

      if (shouldPreventDefault && event.target) {
        targetRef.current = event.target;
      }

      timeoutRef.current = setTimeout(() => {
        mediumHaptic();
        onLongPress();
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (shouldTriggerClick && !longPressTriggered && onClick) {
        onClick();
      }

      setLongPressTriggered(false);
      startPosRef.current = null;
    },
    [onClick, longPressTriggered]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      // If the user moves more than 10px, cancel the long press
      if (startPosRef.current && timeoutRef.current) {
        const moveThreshold = 10;
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
        const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

        if (deltaX > moveThreshold || deltaY > moveThreshold) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    },
    []
  );

  return {
    onTouchStart: (e: React.TouchEvent) => start(e),
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onTouchMove: handleTouchMove,
    onMouseDown: (e: React.MouseEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
  };
}

export default useLongPress;
