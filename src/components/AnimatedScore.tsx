import { AnimatePresence, motion } from 'motion/react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.ts';

interface AnimatedScoreProps {
  score: number;
  lastDelta: number | null;
  showDelta?: boolean;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

export function AnimatedScore({
  score,
  lastDelta,
  showDelta = false,
  size = 'lg',
  className = '',
}: AnimatedScoreProps) {
  const animated = useAnimatedNumber(score, 700);

  const sizeClasses =
    size === 'xl'
      ? 'text-4xl sm:text-5xl font-bold'
      : size === 'lg'
        ? 'text-2xl sm:text-3xl font-bold'
        : 'text-xl font-semibold';

  const deltaText =
    lastDelta === null
      ? null
      : lastDelta > 0
        ? `+${lastDelta}`
        : lastDelta < 0
          ? `${lastDelta}`
          : '±0';

  const deltaColor =
    lastDelta === null
      ? ''
      : lastDelta > 0
        ? 'text-emerald-400'
        : lastDelta < 0
          ? 'text-rose-400'
          : 'text-slate-400';

  return (
    <div className={`relative inline-flex items-baseline gap-2.5 ${className}`}>
      <span className={`font-mono-tabular tracking-tight text-slate-50 ${sizeClasses}`}>
        {animated}
      </span>
      <span className="text-xs font-medium text-slate-400">điểm</span>

      <AnimatePresence mode="wait">
        {showDelta && deltaText !== null && (
          <motion.span
            key={`${score}-${lastDelta}`}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={`font-mono-tabular text-sm font-bold ${deltaColor}`}
          >
            {deltaText}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
