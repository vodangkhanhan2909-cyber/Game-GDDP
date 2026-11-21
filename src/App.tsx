import { useEffect, useRef, useState } from 'react';
import { HostDashboard } from './components/HostDashboard.tsx';
import { PlayerInterface } from './components/PlayerInterface.tsx';
import type { TeamId } from './game/types.ts';
import { useGameSocket } from './hooks/useGameSocket.ts';

type ScreenMode = 'host' | 'player';

function detectModeFromLocation(): ScreenMode {
  if (typeof window === 'undefined') return 'host';
  if (window.location.pathname.startsWith('/play')) return 'player';
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'player') return 'player';
  return 'host';
}

function getInitialTeamId(): TeamId | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const queryTeam = params.get('team');
  if (queryTeam === 'team1' || queryTeam === 'team2' || queryTeam === 'team3') {
    return queryTeam;
  }
  const saved = window.sessionStorage.getItem('grand_wager_team');
  if (saved === 'team1' || saved === 'team2' || saved === 'team3') {
    return saved;
  }
  return null;
}

export default function App() {
  const [mode, setMode] = useState<ScreenMode>(() => detectModeFromLocation());
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId | null>(() =>
    getInitialTeamId(),
  );
  const autostartDoneRef = useRef(false);

  const { gameState, connectionStatus, clockOffsetMs, lastError, clearError, send } =
    useGameSocket({
      role: mode,
      teamId: mode === 'player' ? (selectedTeamId ?? undefined) : undefined,
    });

  useEffect(() => {
    const onPopState = () => {
      setMode(detectModeFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (nextMode: ScreenMode) => {
    const targetPath = nextMode === 'player' ? '/play' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setMode(nextMode);
  };

  const handleSelectTeam = (teamId: TeamId | null) => {
    setSelectedTeamId(teamId);
    if (teamId) {
      window.sessionStorage.setItem('grand_wager_team', teamId);
    } else {
      window.sessionStorage.removeItem('grand_wager_team');
    }
  };

  // Support ?autostart=1 on Host view for quick automated verification
  useEffect(() => {
    if (
      mode === 'host' &&
      !autostartDoneRef.current &&
      connectionStatus === 'connected' &&
      gameState?.phase === 'LOBBY'
    ) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        autostartDoneRef.current = true;
        send({ type: 'host:fill_demo_teams' });
        send({ type: 'host:start_game', force: true });
      }
    }
  }, [mode, connectionStatus, gameState?.phase, send]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-200 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-bold text-slate-50">
            Đấu Trường Cược Điểm
          </h1>
          <p className="text-sm text-slate-400">Đang kết nối tới phiên chơi trực tiếp...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-game-phase={gameState.phase}>
      {lastError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 rounded-xl border border-rose-500/40 bg-rose-950/90 px-4 py-3 text-xs text-rose-100 shadow-xl flex items-center gap-3"
        >
          <span>{lastError}</span>
          <button
            type="button"
            onClick={clearError}
            className="font-bold underline underline-offset-2"
          >
            Đóng
          </button>
        </div>
      )}

      {mode === 'host' ? (
        <HostDashboard
          gameState={gameState}
          clockOffsetMs={clockOffsetMs}
          connectionStatus={connectionStatus}
          send={send}
          onNavigatePlayer={() => navigateTo('player')}
        />
      ) : (
        <PlayerInterface
          gameState={gameState}
          clockOffsetMs={clockOffsetMs}
          connectionStatus={connectionStatus}
          selectedTeamId={selectedTeamId}
          onSelectTeam={handleSelectTeam}
          send={send}
          onNavigateHost={() => navigateTo('host')}
        />
      )}
    </div>
  );
}
