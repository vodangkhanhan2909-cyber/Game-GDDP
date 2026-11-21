import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, durationMs = 650): number {
  const [displayValue, setDisplayValue] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const startValue = currentRef.current;
    if (startValue === target) return;

    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(startValue + (target - startValue) * eased);
      currentRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplayValue(target);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return displayValue;
}
