import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { Crown, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { computeRankings } from '../game/rules.ts';
import type { TeamId, TeamState } from '../game/types.ts';
import { AnimatedScore } from './AnimatedScore.tsx';

interface FireworksCelebrationProps {
  teams: Record<TeamId, TeamState>;
  onPlayAgain: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
}

const FIREWORK_COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#10B981',
  '#F43F5E',
  '#A855F7',
  '#FDE047',
];

export function FireworksCelebration({ teams, onPlayAgain }: FireworksCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rankings = computeRankings(teams);
  const topScore = rankings[0]?.team.score ?? 0;
  const winners = rankings.filter((r) => r.team.score === topScore);
  const isTie = winners.length > 1;

  const fireConfettiBurst = () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    confetti({
      particleCount: 85,
      angle: 60,
      spread: 65,
      origin: { x: 0.08, y: 0.72 },
      colors: FIREWORK_COLORS,
    });
    confetti({
      particleCount: 85,
      angle: 120,
      spread: 65,
      origin: { x: 0.92, y: 0.72 },
      colors: FIREWORK_COLORS,
    });
  };

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    fireConfettiBurst();
    const confettiTimer = setInterval(fireConfettiBurst, 2800);

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => clearInterval(confettiTimer);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return () => clearInterval(confettiTimer);
    }

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const rockets: Rocket[] = [];
    const particles: Particle[] = [];
    let rafId = 0;
    let lastSpawn = 0;

    const explode = (x: number, y: number, color: string) => {
      const count = 42;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.18;
        const speed = 1.6 + Math.random() * 4.2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color,
          size: 2 + Math.random() * 2.2,
        });
      }
    };

    const tick = (time: number) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      if (time - lastSpawn > 520) {
        lastSpawn = time;
        rockets.push({
          x: width * (0.15 + Math.random() * 0.7),
          y: height,
          vy: -(6.5 + Math.random() * 3.5),
          targetY: height * (0.15 + Math.random() * 0.35),
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        });
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.targetY) {
          explode(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.055;
        p.vx *= 0.985;
        p.alpha -= 0.015;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(confettiTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const podiumOrder = [rankings[1], rankings[0], rankings[2]].filter(Boolean);

  return (
    <section
      aria-label="Vinh danh đội chiến thắng"
      data-testid="winner-screen"
      className="relative min-h-[680px] rounded-3xl border border-slate-800 bg-[#0B1120] overflow-hidden p-6 sm:p-10 flex flex-col items-center justify-between"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full"
      />

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400 mb-5"
        >
          <Trophy className="w-8 h-8" aria-hidden="true" />
        </motion.div>

        <p className="text-sm font-medium text-amber-400 tracking-wide mb-2">
          Chung Kết · Đội Giành Giải Thưởng
        </p>

        <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-slate-50 tracking-tight [text-wrap:balance]">
          {isTie
            ? `Đồng Hạng Nhất: ${winners.map((w) => w.team.name).join(' & ')}`
            : `${winners[0].team.name} Giành Chiến Thắng`}
        </h1>

        <p className="text-slate-300 mt-3 text-base sm:text-lg">
          Tổng điểm chung cuộc:{' '}
          <span className="font-mono-tabular font-bold text-amber-300">
            {topScore} điểm
          </span>
        </p>
      </div>

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end my-8">
        {podiumOrder.map(({ team, rank }) => {
          const isFirst = rank === 1;
          const heightClass = isFirst
            ? 'md:min-h-[260px]'
            : rank === 2
              ? 'md:min-h-[210px]'
              : 'md:min-h-[180px]';

          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: rank * 0.1 }}
              className={`rounded-2xl border p-6 flex flex-col justify-between ${heightClass} ${
                isFirst
                  ? 'bg-[#17233D] border-amber-400/50 shadow-xl shadow-amber-500/10'
                  : 'bg-[#131C31]/95 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono-tabular text-sm font-bold ${
                    isFirst ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {rank === 1 ? 'Hạng 1' : rank === 2 ? 'Hạng 2' : 'Hạng 3'}
                </span>
                {isFirst && <Crown className="w-5 h-5 text-amber-400" aria-hidden="true" />}
              </div>

              <div className="my-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <span
                    className="h-3.5 w-3.5 rounded-sm shrink-0"
                    style={{ backgroundColor: team.accentHex }}
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-2xl font-bold text-slate-50">
                    {team.name}
                  </h2>
                </div>
                <AnimatedScore score={team.score} lastDelta={null} size="xl" />
              </div>

              <div className="text-xs text-slate-400 pt-3 border-t border-slate-800/90 flex items-center justify-between">
                <span>Số câu đã chơi</span>
                <span className="font-mono-tabular text-slate-200">
                  {team.history.length}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={fireConfettiBurst}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-slate-200 hover:bg-slate-800 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
          Bắn pháo giấy
        </button>
        <button
          type="button"
          onClick={onPlayAgain}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-sm font-bold transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Chơi lại
        </button>
      </div>
    </section>
  );
}
