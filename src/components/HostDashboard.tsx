import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  ListChecks,
  Lock,
  Play,
  RotateCcw,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  areAllTeamsJoined,
  getActiveQuestions,
  getCurrentQuestion,
  getRemainingProgress,
  getRemainingSeconds,
  TEAM_IDS,
} from '../game/rules.ts';
import type { ClientMessage, GameState, Multiplier } from '../game/types.ts';
import { playRevealFx, playTickFx, playVictoryFx } from '../utils/soundFx.ts';
import { AnimatedScore } from './AnimatedScore.tsx';
import { FireworksCelebration } from './FireworksCelebration.tsx';
import { QuestionManagerModal } from './QuestionManagerModal.tsx';
import { ScoreBarChart } from './ScoreBarChart.tsx';

interface HostDashboardProps {
  gameState: GameState;
  clockOffsetMs: number;
  connectionStatus: 'connecting' | 'connected' | 'reconnecting';
  send: (msg: ClientMessage) => void;
  onNavigatePlayer: () => void;
}

const MULTIPLIER_LABELS: Record<Multiplier, string> = {
  0: '×0 · Không cộng điểm',
  1: '×1 · Điểm chuẩn',
  2: '×2 · Nhân đôi',
  3: '×3 · Nhân ba',
};

export function HostDashboard({
  gameState,
  clockOffsetMs,
  connectionStatus,
  send,
  onNavigatePlayer,
}: HostDashboardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  const prevPhaseRef = useRef(gameState.phase);
  const prevSecRef = useRef<number>(15);

  const joinUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/play` : '/play';

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0B1120',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [joinUrl]);

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

  const remainingSec = getRemainingSeconds(gameState.phaseEndsAt, nowMs);
  const remainingProgress = getRemainingProgress(
    gameState.phaseStartedAt,
    gameState.phaseEndsAt,
    nowMs,
  );

  useEffect(() => {
    if (!soundEnabled) {
      prevPhaseRef.current = gameState.phase;
      return;
    }
    if (prevPhaseRef.current !== gameState.phase) {
      if (gameState.phase === 'REVEALED') {
        playRevealFx();
      } else if (gameState.phase === 'GAME_OVER') {
        playVictoryFx();
      }
      prevPhaseRef.current = gameState.phase;
    }
  }, [gameState.phase, soundEnabled]);

  useEffect(() => {
    if (
      soundEnabled &&
      gameState.phase === 'BETTING' &&
      remainingSec <= 3 &&
      remainingSec > 0 &&
      remainingSec !== prevSecRef.current
    ) {
      playTickFx();
    }
    prevSecRef.current = remainingSec;
  }, [remainingSec, gameState.phase, soundEnabled]);

  const activeQuestions = getActiveQuestions(gameState);
  const currentQuestion = getCurrentQuestion(gameState);
  const allJoined = areAllTeamsJoined(gameState.teams);
  const joinedCount = TEAM_IDS.filter((id) => gameState.teams[id].joined).length;
  const isLastQuestion =
    gameState.currentQuestionIndex >= Math.max(0, activeQuestions.length - 1);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Bỏ qua nếu trình duyệt chặn clipboard
    }
  };

  const renderPrimaryAction = () => {
    if (gameState.phase === 'LOBBY') {
      return (
        <button
          type="button"
          onClick={() => send({ type: 'host:start_game' })}
          disabled={!allJoined || activeQuestions.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          {allJoined ? 'Bắt đầu chơi' : `Đang chờ (${joinedCount}/3)`}
        </button>
      );
    }

    if (gameState.phase === 'BETTING') {
      return (
        <button
          type="button"
          onClick={() => send({ type: 'host:reveal_answer' })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-sm transition-colors whitespace-nowrap shrink-0"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          Mở đáp án
        </button>
      );
    }

    if (gameState.phase === 'REVEALED') {
      return (
        <button
          type="button"
          onClick={() => send({ type: 'host:next_question' })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-sm transition-colors whitespace-nowrap shrink-0"
        >
          {isLastQuestion ? (
            <>
              <Trophy className="w-4 h-4" aria-hidden="true" />
              Xem Đội Thắng
            </>
          ) : (
            <>
              <Play className="w-4 h-4" aria-hidden="true" />
              Câu tiếp theo
            </>
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => send({ type: 'host:reset_game', keepQuestions: true })}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-sm transition-colors whitespace-nowrap shrink-0"
      >
        <RotateCcw className="w-4 h-4" aria-hidden="true" />
        Chơi lại
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC] flex flex-col">
      {/* Thanh điều hướng 3 vùng */}
      <header className="border-b border-slate-800/90 bg-[#0B1120]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="/"
            className="font-display text-xl font-extrabold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
          >
            Đấu Trường Cược Điểm
          </a>

          <nav
            aria-label="Điều khiển Host"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => setIsQuestionModalOpen(true)}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Câu hỏi ({activeQuestions.length})
            </button>
            <button
              type="button"
              onClick={onNavigatePlayer}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Màn hình Đội chơi
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-slate-400" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" aria-hidden="true" />
              )}
              <span>{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
            </button>
            {gameState.phase !== 'LOBBY' && (
              <button
                type="button"
                onClick={() => send({ type: 'host:reset_game', keepQuestions: true })}
                className="hover:text-rose-300 transition-colors whitespace-nowrap shrink-0"
              >
                Đặt lại
              </button>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">{renderPrimaryAction()}</div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {connectionStatus === 'reconnecting' && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            Đang kết nối lại tới máy chủ trò chơi...
          </div>
        )}

        {/* MÀN HÌNH PHÒNG CHỜ (LOBBY) */}
        {gameState.phase === 'LOBBY' && (
          <div className="space-y-8" data-testid="host-lobby">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-amber-400 mb-1.5">
                  Phòng chờ Host · Cuộc thi 3 đội chơi trực tiếp
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-50 tracking-tight [text-wrap:balance]">
                  Quét Mã QR Để Tham Gia &amp; Chọn Bộ Câu Hỏi
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-[#131C31] hover:bg-slate-800 text-sm font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <ListChecks className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  Câu hỏi &amp; Hệ số ({activeQuestions.length})
                </button>
                <button
                  type="button"
                  onClick={onNavigatePlayer}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-[#131C31] hover:bg-slate-800 text-sm font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0 md:hidden"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  Màn hình Đội chơi
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Cổng quét mã QR */}
              <section
                aria-label="Mã QR tham gia cho đội chơi"
                className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 flex flex-col justify-between"
              >
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-50">
                    Mã QR Tham Gia Trò Chơi
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Các đội quét mã để mở trang người chơi, chọn Đội 1, Đội 2 hoặc Đội 3 rồi vào phòng chờ.
                  </p>
                </div>

                <div className="my-6 flex flex-col items-center">
                  <div className="rounded-2xl bg-white p-4 shadow-lg">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Mã QR tham gia giao diện đội chơi"
                        className="w-48 h-48 sm:w-52 sm:h-52 block"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-lg" />
                    )}
                  </div>
                  <p className="mt-4 text-xs font-mono-tabular text-slate-300 text-center break-all max-w-xs">
                    {joinUrl}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        Sao chép liên kết
                      </>
                    )}
                  </button>
                  <a
                    href="/play"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    Mở tab Đội chơi
                  </a>
                </div>
              </section>

              {/* Danh sách 3 đội */}
              <section
                aria-label="Trạng thái phòng chờ của 3 đội"
                className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-8 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-50">
                        Danh Sách Đội Chơi &amp; Trạng Thái
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Mỗi đội bắt đầu với 100 điểm. Nút Bắt đầu sẽ mở khi cả 3 đội đã tham gia.
                      </p>
                    </div>
                    <span className="font-mono-tabular text-sm font-bold text-slate-200 whitespace-nowrap">
                      {joinedCount} / 3 Đã vào
                    </span>
                  </div>

                  <div className="space-y-4">
                    {TEAM_IDS.map((id) => {
                      const team = gameState.teams[id];
                      return (
                        <div
                          key={id}
                          className={`rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors ${
                            team.joined ? 'bg-slate-900/85' : 'bg-slate-950/55'
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-white shrink-0"
                              style={{ backgroundColor: team.accentHex }}
                            >
                              {id === 'team1' ? 'Đ1' : id === 'team2' ? 'Đ2' : 'Đ3'}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display text-lg font-bold text-slate-100">
                                {team.name}
                              </h3>
                              <p className="text-xs text-slate-400">
                                {team.joined
                                  ? team.connectedClients > 0
                                    ? `${team.connectedClients} thiết bị trong phòng chờ`
                                    : 'Đã sẵn sàng trong phòng chờ'
                                  : 'Đang chờ đội quét mã để tham gia...'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <span className="font-mono-tabular text-sm text-slate-300 hidden sm:inline">
                              100 điểm
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
                                team.joined ? 'text-emerald-400' : 'text-slate-500'
                              }`}
                            >
                              {team.joined ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                  Đã vào
                                </>
                              ) : (
                                <>
                                  <Clock className="w-4 h-4" aria-hidden="true" />
                                  Đang chờ
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    Đã chọn {activeQuestions.length} câu hỏi · 15 giây đặt cược mỗi câu
                  </div>
                  {!allJoined && (
                    <button
                      type="button"
                      onClick={() => send({ type: 'host:fill_demo_teams' })}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-amber-300 underline underline-offset-4 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      Đánh dấu cả 3 đội sẵn sàng (thử nghiệm)
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* SÂN KHẤU TRỰC TIẾP (BETTING & REVEALED) */}
        {(gameState.phase === 'BETTING' || gameState.phase === 'REVEALED') &&
          currentQuestion && (
            <div className="space-y-6" data-testid="host-live-stage">
              {/* Thanh tiến trình & Đếm ngược 15 giây */}
              <div className="rounded-2xl border border-slate-800 bg-[#131C31] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                    <span className="font-mono-tabular font-bold text-slate-50">
                      Câu {gameState.currentQuestionIndex + 1} / {activeQuestions.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentQuestion.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {currentQuestion.type === 'multiple_choice'
                        ? 'Trắc nghiệm'
                        : 'Đúng / Sai / Không được đề cập'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Hệ số:</span>
                      <div
                        className="inline-flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800"
                        role="group"
                        aria-label="Hệ số câu hỏi hiện tại"
                      >
                        {([0, 1, 2, 3] as Multiplier[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={gameState.phase !== 'BETTING'}
                            onClick={() =>
                              send({
                                type: 'host:set_multiplier',
                                questionId: currentQuestion.id,
                                multiplier: m,
                              })
                            }
                            className={`px-2.5 py-1 rounded-md text-xs font-mono-tabular font-bold transition-colors ${
                              currentQuestion.multiplier === m
                                ? m === 0
                                  ? 'bg-slate-700 text-white'
                                  : m === 3
                                    ? 'bg-amber-500 text-slate-950'
                                    : m === 2
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-slate-100 disabled:opacity-40'
                            }`}
                          >
                            ×{m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`inline-flex items-center gap-2 font-mono-tabular text-lg font-bold whitespace-nowrap ${
                        gameState.phase === 'REVEALED'
                          ? 'text-emerald-400'
                          : remainingSec <= 5
                            ? 'text-rose-400'
                            : 'text-amber-400'
                      }`}
                      data-testid="host-timer"
                    >
                      <Clock className="w-4 h-4" aria-hidden="true" />
                      {gameState.phase === 'BETTING' ? `${remainingSec} giây` : 'Đã mở đáp án'}
                    </div>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      gameState.phase === 'REVEALED'
                        ? 'bg-emerald-500 w-full'
                        : remainingSec <= 5
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                    }`}
                    style={{
                      width:
                        gameState.phase === 'REVEALED'
                          ? '100%'
                          : `${Math.round(remainingProgress * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Bố cục 2 cột vừa màn hình 1440x900 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-5">
                  <section
                    aria-label="Hiển thị câu hỏi hiện tại"
                    className="rounded-2xl border border-slate-800 bg-[#131C31] p-6 sm:p-7"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs font-mono-tabular font-bold tracking-wide text-amber-400">
                        {MULTIPLIER_LABELS[currentQuestion.multiplier]}
                      </span>
                      <span className="text-xs text-slate-400">
                        {gameState.phase === 'BETTING'
                          ? 'Đang mở đặt cược'
                          : 'Đã chấm điểm'}
                      </span>
                    </div>

                    {currentQuestion.passage && (
                      <blockquote className="mb-4 rounded-xl bg-slate-900/80 p-3.5 text-sm text-slate-300 leading-relaxed">
                        {currentQuestion.passage}
                      </blockquote>
                    )}

                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 leading-snug mb-6 [text-wrap:balance]">
                      {currentQuestion.prompt}
                    </h1>

                    <div
                      className={`grid gap-3.5 ${
                        currentQuestion.type === 'multiple_choice'
                          ? 'grid-cols-1 sm:grid-cols-2'
                          : 'grid-cols-1 sm:grid-cols-3'
                      }`}
                    >
                      {currentQuestion.options.map((opt) => {
                        const isCorrect =
                          gameState.phase === 'REVEALED' &&
                          opt.key === currentQuestion.correctAnswer;
                        const isDimmed =
                          gameState.phase === 'REVEALED' &&
                          opt.key !== currentQuestion.correctAnswer;

                        const teamsPickingThis = TEAM_IDS.filter(
                          (id) => gameState.teams[id].currentAnswer === opt.key,
                        );

                        return (
                          <div
                            key={opt.key}
                            className={`rounded-xl p-4 transition-all ${
                              isCorrect
                                ? 'bg-emerald-500/15 ring-1 ring-emerald-400 shadow-lg shadow-emerald-500/10'
                                : isDimmed
                                  ? 'bg-slate-950/50 opacity-55'
                                  : 'bg-slate-900/75'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                {currentQuestion.type === 'multiple_choice' && (
                                  <span
                                    className={`font-mono-tabular text-sm font-bold w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isCorrect
                                        ? 'bg-emerald-500 text-slate-950'
                                        : 'bg-slate-800 text-slate-200'
                                    }`}
                                  >
                                    {opt.key}
                                  </span>
                                )}
                                <span className="font-display text-base sm:text-lg font-semibold text-slate-50 leading-snug">
                                  {opt.label}
                                </span>
                              </div>

                              {isCorrect && (
                                <CheckCircle2
                                  className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
                                  aria-label="Đáp án đúng"
                                />
                              )}
                            </div>

                            {teamsPickingThis.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
                                {teamsPickingThis.map((tid) => (
                                  <span
                                    key={tid}
                                    className="inline-flex items-center gap-1.5 font-medium text-slate-200"
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-sm"
                                      style={{
                                        backgroundColor: gameState.teams[tid].accentHex,
                                      }}
                                      aria-hidden="true"
                                    />
                                    {gameState.teams[tid].name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Hàng 3 thẻ cược & lựa chọn của các đội */}
                  <section aria-label="Tiền cược và lựa chọn của các đội">
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <h2 className="font-display text-sm font-bold text-slate-300">
                        Cược &amp; Lựa Chọn Trực Tiếp
                      </h2>
                      <span className="text-xs text-slate-400">
                        Cập nhật tức thì khi các đội điều chỉnh mức cược
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {TEAM_IDS.map((id) => {
                        const team = gameState.teams[id];
                        const isCorrect =
                          gameState.phase === 'REVEALED' &&
                          team.currentAnswer === currentQuestion.correctAnswer;

                        return (
                          <div
                            key={id}
                            data-testid={`host-team-card-${id}`}
                            className="rounded-xl border border-slate-800 bg-[#131C31] p-4 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-3 h-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: team.accentHex }}
                                  aria-hidden="true"
                                />
                                <span className="font-display font-bold text-sm text-slate-100 truncate">
                                  {team.name}
                                </span>
                              </div>
                              {team.lockedIn && gameState.phase === 'BETTING' && (
                                <Lock
                                  className="w-3.5 h-3.5 text-emerald-400 shrink-0"
                                  aria-label="Đã chốt"
                                />
                              )}
                            </div>

                            <AnimatedScore
                              score={team.score}
                              lastDelta={team.lastDelta}
                              showDelta={gameState.phase === 'REVEALED'}
                              size="md"
                            />

                            <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400 shrink-0">Đáp án</span>
                                <span
                                  className={`font-mono-tabular font-bold truncate ${
                                    gameState.phase === 'REVEALED'
                                      ? isCorrect
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                      : team.currentAnswer
                                        ? 'text-slate-100'
                                        : 'text-slate-500'
                                  }`}
                                >
                                  {team.currentAnswer ?? 'Chưa chọn'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400 shrink-0">Tiền cược</span>
                                <span className="font-mono-tabular font-bold text-amber-300">
                                  {team.wager > 0 ? `${team.wager} điểm` : 'Không cược (0)'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="lg:col-span-5">
                  <ScoreBarChart
                    teams={gameState.teams}
                    showDeltas={gameState.phase === 'REVEALED'}
                  />
                </div>
              </div>
            </div>
          )}

        {/* MÀN HÌNH VINH DANH ĐỘI THẮNG */}
        {gameState.phase === 'GAME_OVER' && (
          <FireworksCelebration
            teams={gameState.teams}
            onPlayAgain={() => send({ type: 'host:reset_game', keepQuestions: true })}
          />
        )}
      </main>

      <QuestionManagerModal
        isOpen={isQuestionModalOpen}
        questions={gameState.questions}
        canEditDeck={gameState.phase === 'LOBBY'}
        onClose={() => setIsQuestionModalOpen(false)}
        onSetMultiplier={(questionId, multiplier) =>
          send({ type: 'host:set_multiplier', questionId, multiplier })
        }
        onToggleQuestion={(questionId, enabled) =>
          send({ type: 'host:toggle_question', questionId, enabled })
        }
        onUpdateQuestion={(question) => send({ type: 'host:update_question', question })}
        onAddQuestion={(question) => send({ type: 'host:add_question', question })}
        onDeleteQuestion={(questionId) =>
          send({ type: 'host:delete_question', questionId })
        }
      />
    </div>
  );
}
