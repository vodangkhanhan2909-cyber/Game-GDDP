import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Crown,
  Lock,
  Unlock,
  Users,
} from 'lucide-react';
import {
  clampWager,
  computeRankings,
  getActiveQuestions,
  getCurrentQuestion,
  getRemainingProgress,
  getRemainingSeconds,
  TEAM_IDS,
} from '../game/rules.ts';
import type { ClientMessage, GameState, TeamId } from '../game/types.ts';
import { AnimatedScore } from './AnimatedScore.tsx';

interface PlayerInterfaceProps {
  gameState: GameState;
  clockOffsetMs: number;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  selectedTeamId: TeamId | null;
  onSelectTeam: (teamId: TeamId | null) => void;
  send: (msg: ClientMessage) => void;
  onNavigateHost: () => void;
}

export function PlayerInterface({
  gameState,
  clockOffsetMs,
  connectionStatus,
  selectedTeamId,
  onSelectTeam,
  send,
  onNavigateHost,
}: PlayerInterfaceProps) {
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    if (gameState.phase !== 'BETTING') {
      setNowMs(Date.now() + clockOffsetMs);
      return;
    }
    const interval = setInterval(() => {
      setNowMs(Date.now() + clockOffsetMs);
    }, 100);
    return () => clearInterval(interval);
  }, [gameState.phase, clockOffsetMs]);

  const activeQuestions = getActiveQuestions(gameState);
  const currentQuestion = getCurrentQuestion(gameState);
  const team = selectedTeamId ? gameState.teams[selectedTeamId] : null;
  const remainingSec = getRemainingSeconds(gameState.phaseEndsAt, nowMs);
  const remainingProgress = getRemainingProgress(
    gameState.phaseStartedAt,
    gameState.phaseEndsAt,
    nowMs,
  );
  const joinedCount = TEAM_IDS.filter((id) => gameState.teams[id].joined).length;

  const handleJoinTeam = (id: TeamId) => {
    onSelectTeam(id);
    send({ type: 'player:join_team', teamId: id });
  };

  const handleLeaveTeam = () => {
    if (selectedTeamId) {
      send({ type: 'player:leave_team', teamId: selectedTeamId });
    }
    onSelectTeam(null);
  };

  const handleAnswerPick = (optionKey: string) => {
    if (!selectedTeamId || gameState.phase !== 'BETTING') return;
    send({
      type: 'player:submit_action',
      teamId: selectedTeamId,
      selectedAnswer: optionKey,
    });
  };

  const handleWagerChange = (rawAmount: number) => {
    if (!selectedTeamId || !team || gameState.phase !== 'BETTING') return;
    const clamped = clampWager(rawAmount, team.score);
    send({
      type: 'player:submit_action',
      teamId: selectedTeamId,
      wager: clamped,
    });
  };

  const handleToggleLock = () => {
    if (!selectedTeamId || !team || gameState.phase !== 'BETTING') return;
    send({
      type: 'player:submit_action',
      teamId: selectedTeamId,
      lockedIn: !team.lockedIn,
    });
  };

  // Màn hình 2A: Chọn Đội (Sau khi quét mã QR)
  if (!selectedTeamId || !team) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] flex flex-col">
        <header className="border-b border-slate-800/90 px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-display text-lg font-extrabold text-slate-50">
            Đấu Trường Cược Điểm
          </span>
          <button
            type="button"
            onClick={onNavigateHost}
            className="text-xs font-medium text-slate-400 hover:text-slate-100 whitespace-nowrap"
          >
            Màn hình Host
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md space-y-6" data-testid="player-team-select">
            <div className="text-center">
              <p className="text-xs font-medium text-amber-400 mb-1.5">
                Tham gia chơi · Bước 1 / 2
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">
                Chọn Đội Của Bạn
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                Chọn Đội 1, Đội 2 hoặc Đội 3 để vào phòng chờ.
              </p>
            </div>

            <div className="space-y-3">
              {TEAM_IDS.map((id) => {
                const t = gameState.teams[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleJoinTeam(id)}
                    className="w-full min-h-[72px] rounded-2xl border border-slate-800 bg-[#131C31] hover:border-slate-600 hover:bg-slate-800/70 p-4 flex items-center justify-between gap-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-white shrink-0"
                        style={{ backgroundColor: t.accentHex }}
                      >
                        {id === 'team1' ? 'Đ1' : id === 'team2' ? 'Đ2' : 'Đ3'}
                      </div>
                      <div>
                        <div className="font-display text-lg font-bold text-slate-50">
                          {t.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {t.connectedClients > 0
                            ? `${t.connectedClients} người chơi đang kết nối`
                            : t.joined
                              ? 'Đã vào phòng'
                              : 'Sẵn sàng'}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-amber-400 whitespace-nowrap">
                      Tham gia →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Màn hình 2B: Phòng chờ (Trước khi Host bấm Bắt đầu)
  if (gameState.phase === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] flex flex-col">
        <header className="border-b border-slate-800/90 px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: team.accentHex }}
              aria-hidden="true"
            />
            <span className="font-display font-bold text-slate-50">{team.name}</span>
          </div>
          <button
            type="button"
            onClick={handleLeaveTeam}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Đổi đội
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 text-center space-y-6"
            data-testid="player-waiting-room"
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-display text-2xl font-extrabold text-white"
              style={{ backgroundColor: team.accentHex }}
            >
              {team.id === 'team1' ? 'Đ1' : team.id === 'team2' ? 'Đ2' : 'Đ3'}
            </div>

            <div>
              <p className="text-xs font-medium text-emerald-400 mb-1">
                Phòng chờ · Sẵn sàng thi đấu
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
                Đã Vào {team.name}
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                Đang chờ Host nhấn Bắt đầu chơi khi đủ cả 3 đội.
              </p>
            </div>

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">Điểm khởi đầu</span>
              <span className="font-mono-tabular text-lg font-bold text-slate-50">
                100 điểm
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
              <Users className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="font-mono-tabular font-semibold">
                {joinedCount} / 3 đội đã vào
              </span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Màn hình 2C: Tổng kết Game Over
  if (gameState.phase === 'GAME_OVER') {
    const rankings = computeRankings(gameState.teams);
    const myRanking = rankings.find((r) => r.team.id === team.id);
    const rank = myRanking?.rank ?? 3;

    return (
      <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] flex flex-col">
        <header className="border-b border-slate-800/90 px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-display font-bold text-slate-50">{team.name}</span>
          <span className="font-mono-tabular text-sm font-bold text-amber-400">
            Kết quả chung cuộc
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 text-center space-y-6">
            {rank === 1 && (
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 mx-auto flex items-center justify-center">
                <Crown className="w-8 h-8" aria-hidden="true" />
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-amber-400 mb-1">
                {rank === 1 ? 'Quán quân Hạng 1' : rank === 2 ? 'Hạng 2' : 'Hạng 3'}
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">
                {rank === 1 ? 'Nhà Vô Địch!' : 'Hoàn Thành Trò Chơi'}
              </h1>
            </div>

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-5">
              <p className="text-xs text-slate-400 mb-1">Tổng điểm của đội</p>
              <AnimatedScore score={team.score} lastDelta={null} size="xl" />
            </div>

            <button
              type="button"
              onClick={handleLeaveTeam}
              className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold text-slate-200 transition-colors"
            >
              Quay lại chọn đội
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Màn hình 2D: Điều khiển tham gia trực tiếp (BETTING & REVEALED)
  if (!currentQuestion) return null;

  const projectedWin = team.wager * currentQuestion.multiplier;
  const projectedLoss = team.wager;
  const isRevealed = gameState.phase === 'REVEALED';
  const wasCorrect =
    isRevealed && team.currentAnswer === currentQuestion.correctAnswer;

  return (
    <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B1120]/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: team.accentHex }}
              aria-hidden="true"
            />
            <span className="font-display font-bold text-sm sm:text-base text-slate-50 truncate">
              {team.name}
            </span>
            <span className="text-xs text-slate-400 font-mono-tabular whitespace-nowrap">
              · Câu {gameState.currentQuestionIndex + 1}/{activeQuestions.length} · ×
              {currentQuestion.multiplier}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <AnimatedScore
              score={team.score}
              lastDelta={team.lastDelta}
              showDelta={isRevealed}
              size="md"
            />
          </div>
        </div>

        <div className="h-1.5 w-full bg-slate-900">
          <div
            className={`h-full transition-all duration-100 ${
              isRevealed
                ? 'bg-emerald-500 w-full'
                : remainingSec <= 5
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
            }`}
            style={{
              width: isRevealed ? '100%' : `${Math.round(remainingProgress * 100)}%`,
            }}
          />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-5" data-testid="player-controls">
        {connectionStatus === 'reconnecting' && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Đang kết nối lại...
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-amber-400">
            {currentQuestion.multiplier === 0
              ? 'Hệ số ×0 · Không cộng điểm'
              : `Hệ số ×${currentQuestion.multiplier}`}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-mono-tabular text-sm font-bold ${
              isRevealed
                ? 'text-emerald-400'
                : remainingSec <= 5
                  ? 'text-rose-400'
                  : 'text-slate-200'
            }`}
            data-testid="player-timer"
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            {isRevealed ? 'Hết giờ' : `Còn ${remainingSec} giây`}
          </span>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-[#131C31] p-4 sm:p-5 space-y-3">
          {currentQuestion.passage && (
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed border-b border-slate-800 pb-3">
              {currentQuestion.passage}
            </p>
          )}
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-50 leading-snug">
            {currentQuestion.prompt}
          </h1>
        </section>

        {/* Chọn đáp án */}
        <section aria-label="Chọn đáp án" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-300">
              1. Chọn đáp án của bạn
            </h2>
            {team.currentAnswer && (
              <span className="text-xs font-mono-tabular text-amber-400">
                Đã chọn: {team.currentAnswer}
              </span>
            )}
          </div>

          <div
            className={`grid gap-2.5 ${
              currentQuestion.type === 'multiple_choice'
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {currentQuestion.options.map((opt) => {
              const isSelected = team.currentAnswer === opt.key;
              const isCorrectChoice =
                isRevealed && opt.key === currentQuestion.correctAnswer;

              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={isRevealed || team.lockedIn}
                  onClick={() => handleAnswerPick(opt.key)}
                  aria-pressed={isSelected}
                  className={`min-h-[52px] rounded-xl border px-4 py-3 text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    isCorrectChoice
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                      : isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-slate-50'
                        : 'bg-[#131C31] border-slate-800 text-slate-200 hover:border-slate-600'
                  } disabled:cursor-default disabled:opacity-80`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {currentQuestion.type === 'multiple_choice' && (
                      <span
                        className={`font-mono-tabular text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {opt.key}
                      </span>
                    )}
                    <span className="font-display font-semibold text-sm sm:text-base leading-snug">
                      {opt.label}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Điều chỉnh tiền cược trực tiếp */}
        <section
          aria-label="Điều chỉnh mức cược"
          className="rounded-2xl border border-slate-800 bg-[#131C31] p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold text-slate-300">
                2. Đặt mức cược (Không bắt buộc)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tối đa hiện có: <span className="font-mono-tabular">{team.score} điểm</span>
              </p>
            </div>
            <div className="text-right">
              <span
                className="font-mono-tabular text-2xl font-bold text-amber-400"
                data-testid="player-wager-value"
              >
                {team.wager}
              </span>
              <span className="text-xs text-slate-400 ml-1">điểm</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isRevealed || team.lockedIn || team.wager <= 0}
              onClick={() => handleWagerChange(team.wager - 5)}
              aria-label="Giảm cược 5 điểm"
              className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 font-mono-tabular text-sm font-bold text-slate-200 transition-colors"
            >
              -5
            </button>

            <input
              type="range"
              aria-label="Thanh trượt mức cược"
              min={0}
              max={Math.max(0, team.score)}
              step={1}
              value={team.wager}
              disabled={isRevealed || team.lockedIn || team.score <= 0}
              onChange={(e) => handleWagerChange(Number(e.target.value))}
              className="wager-slider flex-1 h-8"
            />

            <button
              type="button"
              disabled={isRevealed || team.lockedIn || team.wager >= team.score}
              onClick={() => handleWagerChange(team.wager + 5)}
              aria-label="Tăng cược 5 điểm"
              className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 font-mono-tabular text-sm font-bold text-slate-200 transition-colors"
            >
              +5
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Không cược', value: 0 },
              { label: '25%', value: Math.round(team.score * 0.25) },
              { label: '50%', value: Math.round(team.score * 0.5) },
              { label: 'Tất tay', value: team.score },
            ].map((preset) => {
              const isActive = team.wager === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isRevealed || team.lockedIn}
                  onClick={() => handleWagerChange(preset.value)}
                  className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-600'
                  } disabled:opacity-50`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-emerald-400 font-mono-tabular">
              Nếu đúng: +{projectedWin} điểm
            </span>
            <span className="text-rose-400 font-mono-tabular">
              Nếu sai: -{projectedLoss} điểm
            </span>
          </div>
        </section>

        {isRevealed ? (
          <div
            data-testid="player-round-result"
            className={`rounded-2xl border p-4 text-center ${
              team.wager === 0
                ? 'border-slate-700 bg-slate-900/80 text-slate-200'
                : wasCorrect
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                  : 'border-rose-500/50 bg-rose-500/15 text-rose-100'
            }`}
          >
            <p className="font-display text-lg font-bold">
              {team.wager === 0
                ? 'Không đặt cược (±0 điểm)'
                : wasCorrect
                  ? `Chính xác! +${team.lastDelta ?? 0} điểm`
                  : `Chưa chính xác (${team.lastDelta ?? 0} điểm)`}
            </p>
            <p className="text-xs opacity-85 mt-1">
              Đáp án đúng: {currentQuestion.correctAnswer} · Đang chờ Host chuyển câu
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleToggleLock}
            className={`w-full min-h-[52px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
              team.lockedIn
                ? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {team.lockedIn ? (
              <>
                <Unlock className="w-4 h-4" aria-hidden="true" />
                Đã chốt (Nhấn để mở khóa)
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" aria-hidden="true" />
                Chốt Đáp Án &amp; Mức Cược
              </>
            )}
          </button>
        )}
      </main>
    </div>
  );
}
