import { useState } from 'react';
import { motion } from 'motion/react';
import { Award, TrendingDown, TrendingUp } from 'lucide-react';
import { computeRankings } from '../game/rules.ts';
import type { TeamId, TeamState } from '../game/types.ts';
import { AnimatedScore } from './AnimatedScore.tsx';

interface ScoreBarChartProps {
  teams: Record<TeamId, TeamState>;
  showDeltas: boolean;
}

const RANK_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Hạng 1',
  2: 'Hạng 2',
  3: 'Hạng 3',
};

export function ScoreBarChart({ teams, showDeltas }: ScoreBarChartProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId | null>(null);
  const rankings = computeRankings(teams);
  const maxScore = Math.max(100, ...rankings.map((r) => r.team.score));

  const inspectedTeam = selectedTeamId ? teams[selectedTeamId] : null;

  return (
    <section
      aria-label="Bảng xếp hạng và biểu đồ điểm trực tiếp"
      className="rounded-2xl border border-slate-800 bg-[#131C31] p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-50">
            Bảng Xếp Hạng &amp; Điểm Số
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Nhấn vào thanh của một đội để xem lịch sử từng câu
          </p>
        </div>
        <span className="text-xs font-mono-tabular text-slate-400 whitespace-nowrap">
          Cao nhất: {maxScore} điểm
        </span>
      </div>

      <div className="space-y-2.5" data-testid="score-bar-chart">
        {rankings.map(({ team, rank }) => {
          const ratio = Math.max(0.03, Math.min(1, team.score / maxScore));
          const isSelected = selectedTeamId === team.id;
          const delta = team.lastDelta;

          return (
            <motion.div
              key={team.id}
              layout
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedTeamId((prev) => (prev === team.id ? null : team.id))
                }
                aria-expanded={isSelected}
                aria-label={`${RANK_LABELS[rank]}: ${team.name} với ${team.score} điểm`}
                className={`w-full text-left rounded-xl px-3.5 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  isSelected
                    ? 'bg-slate-800/90'
                    : 'bg-slate-900/55 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`font-mono-tabular text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                        rank === 1
                          ? 'bg-amber-500/20 text-amber-300'
                          : rank === 2
                            ? 'bg-slate-700/80 text-slate-200'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {RANK_LABELS[rank]}
                    </span>
                    <span
                      className="h-3 w-3 rounded-sm shrink-0"
                      style={{ backgroundColor: team.accentHex }}
                      aria-hidden="true"
                    />
                    <span className="font-display font-semibold text-slate-100 truncate">
                      {team.name}
                    </span>
                    {rank === 1 && (
                      <Award className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {showDeltas && delta !== null && delta !== 0 && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-mono-tabular font-semibold ${
                          delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {delta > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                    <AnimatedScore
                      score={team.score}
                      lastDelta={null}
                      size="md"
                    />
                  </div>
                </div>

                <div className="h-3 w-full rounded-md bg-slate-950/90 overflow-hidden">
                  <motion.div
                    className="h-full w-full origin-left rounded-md"
                    style={{ backgroundColor: team.accentHex }}
                    initial={false}
                    animate={{ scaleX: ratio }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {inspectedTeam && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-200">
              Lịch sử điểm · {inspectedTeam.name}
            </span>
            <button
              type="button"
              onClick={() => setSelectedTeamId(null)}
              className="text-xs text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
            >
              Đóng
            </button>
          </div>
          {inspectedTeam.history.length === 0 ? (
            <p className="text-xs text-slate-400">
              Chưa có câu nào hoàn thành. Lịch sử sẽ hiển thị sau khi mở đáp án Câu 1.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              {inspectedTeam.history.map((entry, idx) => (
                <div
                  key={`${entry.questionId}-${idx}`}
                  className="rounded-lg bg-slate-900/70 border border-slate-800 px-2.5 py-1.5 text-xs flex items-center justify-between"
                >
                  <span className="text-slate-400 font-mono-tabular">
                    Câu {idx + 1} · ×{entry.multiplier}
                  </span>
                  <span
                    className={`font-mono-tabular font-semibold ${
                      entry.delta > 0
                        ? 'text-emerald-400'
                        : entry.delta < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
