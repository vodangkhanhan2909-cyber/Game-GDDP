import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  advanceToNextQuestion,
  applyTeamAction,
  cloneQuestions,
  createInitialGameState,
  resetGame,
  revealCurrentQuestion,
  startGame,
  TEAM_IDS,
} from './src/game/rules.ts';
import type {
  ClientMessage,
  GameState,
  Multiplier,
  Question,
  ServerMessage,
  TeamId,
} from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface ClientMeta {
  role: 'host' | 'player';
  teamId?: TeamId;
}

let gameState: GameState = createInitialGameState();
let roundTimer: ReturnType<typeof setTimeout> | null = null;
const clientMetaMap = new Map<WebSocket, ClientMeta>();

function clearRoundTimer(): void {
  if (roundTimer !== null) {
    clearTimeout(roundTimer);
    roundTimer = null;
  }
}

function scheduleRoundTimerIfNeeded(): void {
  clearRoundTimer();
  if (gameState.phase === 'BETTING' && gameState.phaseEndsAt !== null) {
    const delayMs = Math.max(0, gameState.phaseEndsAt - Date.now());
    roundTimer = setTimeout(() => {
      roundTimer = null;
      if (gameState.phase === 'BETTING') {
        gameState = revealCurrentQuestion(gameState, Date.now());
        broadcastState();
      }
    }, delayMs);
  }
}

function recalculateConnections(): void {
  const counts: Record<TeamId, number> = {
    team1: 0,
    team2: 0,
    team3: 0,
  };
  for (const meta of clientMetaMap.values()) {
    if (meta.role === 'player' && meta.teamId) {
      counts[meta.teamId] += 1;
    }
  }
  const nextTeams = { ...gameState.teams };
  for (const id of TEAM_IDS) {
    nextTeams[id] = {
      ...nextTeams[id],
      connectedClients: counts[id],
    };
  }
  gameState = {
    ...gameState,
    teams: nextTeams,
  };
}

let wss: WebSocketServer | null = null;

function sendToClient(ws: WebSocket, payload: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastState(): void {
  if (!wss) return;
  gameState = { ...gameState, serverTime: Date.now() };
  const msg: ServerMessage = { type: 'state:sync', state: gameState };
  const serialized = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function sanitizeMultiplier(m: number): Multiplier {
  if (m === 0 || m === 1 || m === 2 || m === 3) return m;
  return 1;
}

function handleClientMessage(ws: WebSocket, raw: string): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    sendToClient(ws, { type: 'error', message: 'Dữ liệu gửi lên không hợp lệ.' });
    return;
  }

  const now = Date.now();

  switch (msg.type) {
    case 'client:register': {
      clientMetaMap.set(ws, { role: msg.role, teamId: msg.teamId });
      if (msg.role === 'player' && msg.teamId) {
        const target = gameState.teams[msg.teamId];
        if (target) {
          gameState = {
            ...gameState,
            teams: {
              ...gameState.teams,
              [msg.teamId]: { ...target, joined: true },
            },
          };
        }
      }
      recalculateConnections();
      broadcastState();
      break;
    }

    case 'sync:request': {
      sendToClient(ws, {
        type: 'state:sync',
        state: { ...gameState, serverTime: now },
      });
      break;
    }

    case 'player:join_team': {
      const target = gameState.teams[msg.teamId];
      if (!target) return;
      clientMetaMap.set(ws, { role: 'player', teamId: msg.teamId });
      gameState = {
        ...gameState,
        teams: {
          ...gameState.teams,
          [msg.teamId]: { ...target, joined: true },
        },
      };
      recalculateConnections();
      broadcastState();
      break;
    }

    case 'player:leave_team': {
      const target = gameState.teams[msg.teamId];
      if (!target) return;
      clientMetaMap.set(ws, { role: 'player', teamId: undefined });
      recalculateConnections();
      const updated = gameState.teams[msg.teamId];
      if (gameState.phase === 'LOBBY' && updated.connectedClients === 0) {
        gameState = {
          ...gameState,
          teams: {
            ...gameState.teams,
            [msg.teamId]: { ...updated, joined: false },
          },
        };
      }
      broadcastState();
      break;
    }

    case 'player:submit_action': {
      if (!gameState.teams[msg.teamId]) return;
      gameState = applyTeamAction(
        gameState,
        msg.teamId,
        {
          selectedAnswer: msg.selectedAnswer,
          wager: msg.wager,
          lockedIn: msg.lockedIn,
        },
        now,
      );
      broadcastState();
      break;
    }

    case 'host:fill_demo_teams': {
      if (gameState.phase !== 'LOBBY') return;
      const nextTeams = { ...gameState.teams };
      for (const id of TEAM_IDS) {
        nextTeams[id] = { ...nextTeams[id], joined: true };
      }
      gameState = { ...gameState, teams: nextTeams };
      broadcastState();
      break;
    }

    case 'host:start_game': {
      const next = startGame(gameState, now, Boolean(msg.force));
      if (next !== gameState) {
        gameState = next;
        scheduleRoundTimerIfNeeded();
        broadcastState();
      }
      break;
    }

    case 'host:reveal_answer': {
      if (gameState.phase !== 'BETTING') return;
      clearRoundTimer();
      gameState = revealCurrentQuestion(gameState, now);
      broadcastState();
      break;
    }

    case 'host:next_question': {
      if (gameState.phase !== 'REVEALED') return;
      clearRoundTimer();
      gameState = advanceToNextQuestion(gameState, now);
      scheduleRoundTimerIfNeeded();
      broadcastState();
      break;
    }

    case 'host:reset_game': {
      clearRoundTimer();
      gameState = resetGame(gameState, msg.keepQuestions ?? true, now);
      recalculateConnections();
      broadcastState();
      break;
    }

    case 'host:set_multiplier': {
      const multiplier = sanitizeMultiplier(msg.multiplier);
      gameState = {
        ...gameState,
        questions: gameState.questions.map((q) =>
          q.id === msg.questionId ? { ...q, multiplier } : q,
        ),
      };
      broadcastState();
      break;
    }

    case 'host:toggle_question': {
      const enabledCount = gameState.questions.filter((q) => q.enabled).length;
      if (!msg.enabled && enabledCount <= 1) {
        sendToClient(ws, {
          type: 'error',
          message: 'Cần giữ lại ít nhất 1 câu hỏi được bật.',
        });
        return;
      }
      gameState = {
        ...gameState,
        questions: gameState.questions.map((q) =>
          q.id === msg.questionId ? { ...q, enabled: msg.enabled } : q,
        ),
      };
      broadcastState();
      break;
    }

    case 'host:update_question': {
      const updated = msg.question;
      gameState = {
        ...gameState,
        questions: cloneQuestions(
          gameState.questions.map((q) => (q.id === updated.id ? updated : q)),
        ),
      };
      broadcastState();
      break;
    }

    case 'host:add_question': {
      const newQuestion: Question = {
        ...msg.question,
        id: `q_${Date.now().toString(36)}`,
        multiplier: sanitizeMultiplier(msg.question.multiplier),
      };
      gameState = {
        ...gameState,
        questions: [...gameState.questions, newQuestion],
      };
      broadcastState();
      break;
    }

    case 'host:delete_question': {
      if (gameState.questions.length <= 1) return;
      const remaining = gameState.questions.filter((q) => q.id !== msg.questionId);
      if (remaining.every((q) => !q.enabled)) {
        remaining[0] = { ...remaining[0], enabled: true };
      }
      gameState = {
        ...gameState,
        questions: remaining,
      };
      broadcastState();
      break;
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, phase: gameState.phase });
  });

  app.get('/api/state', (_req, res) => {
    res.json({ ...gameState, serverTime: Date.now() });
  });

  const server = http.createServer(app);
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clientMetaMap.set(ws, { role: 'player' });
    sendToClient(ws, {
      type: 'state:sync',
      state: { ...gameState, serverTime: Date.now() },
    });

    ws.on('message', (data) => {
      handleClientMessage(ws, data.toString());
    });

    ws.on('close', () => {
      clientMetaMap.delete(ws);
      recalculateConnections();
      broadcastState();
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Grand Wager server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
