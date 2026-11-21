import { DEFAULT_QUESTIONS } from './questions.ts';
import type {
  GameState,
  Multiplier,
  Question,
  RankedTeam,
  TeamId,
  TeamState,
} from './types.ts';

export const STARTING_SCORE = 100;
export const BETTING_DURATION_SEC = 15;
export const TEAM_IDS: TeamId[] = ['team1', 'team2', 'team3'];

export function createInitialTeams(): Record<TeamId, TeamState> {
  return {
    team1: {
      id: 'team1',
      name: 'Đội 1',
      accentHex: '#3B82F6',
      score: STARTING_SCORE,
      previousScore: STARTING_SCORE,
      lastDelta: null,
      joined: false,
      connectedClients: 0,
      currentAnswer: null,
      wager: 0,
      lockedIn: false,
      history: [],
    },
    team2: {
      id: 'team2',
      name: 'Đội 2',
      accentHex: '#10B981',
      score: STARTING_SCORE,
      previousScore: STARTING_SCORE,
      lastDelta: null,
      joined: false,
      connectedClients: 0,
      currentAnswer: null,
      wager: 0,
      lockedIn: false,
      history: [],
    },
    team3: {
      id: 'team3',
      name: 'Đội 3',
      accentHex: '#F43F5E',
      score: STARTING_SCORE,
      previousScore: STARTING_SCORE,
      lastDelta: null,
      joined: false,
      connectedClients: 0,
      currentAnswer: null,
      wager: 0,
      lockedIn: false,
      history: [],
    },
  };
}

export function cloneQuestions(questions: Question[]): Question[] {
  return questions.map((q) => ({
    ...q,
    options: q.options.map((opt) => ({ ...opt })),
  }));
}

export function createInitialGameState(
  questions: Question[] = DEFAULT_QUESTIONS,
  now: number = Date.now(),
): GameState {
  return {
    phase: 'LOBBY',
    currentQuestionIndex: 0,
    bettingDurationSec: BETTING_DURATION_SEC,
    phaseStartedAt: null,
    phaseEndsAt: null,
    questions: cloneQuestions(questions),
    teams: createInitialTeams(),
    serverTime: now,
  };
}

export function getActiveQuestions(state: GameState): Question[] {
  return state.questions.filter((q) => q.enabled);
}

export function getCurrentQuestion(state: GameState): Question | null {
  const active = getActiveQuestions(state);
  if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= active.length) {
    return null;
  }
  return active[state.currentQuestionIndex];
}

export function clampWager(rawWager: number, teamScore: number): number {
  if (!Number.isFinite(rawWager)) return 0;
  const maxWager = Math.max(0, Math.floor(teamScore));
  const rounded = Math.floor(rawWager);
  return Math.max(0, Math.min(maxWager, rounded));
}

export interface RoundCalculationParams {
  wager: number;
  multiplier: Multiplier;
  selectedAnswer: string | null;
  correctAnswer: string;
}

/**
 * Pure scoring rule:
 * - Teams may choose not to wager (wager === 0) -> 0 change regardless of answer.
 * - If a team answers correctly -> earns (wager * multiplier) points. (x0 yields 0).
 * - If a team answers incorrectly (or fails to select an answer when wagering > 0) ->
 *   only the wagered points are deducted (-wager).
 */
export function calculateRoundDelta(params: RoundCalculationParams): number {
  const safeWager = Math.max(0, Math.floor(params.wager));
  if (safeWager === 0) {
    return 0;
  }
  if (params.selectedAnswer !== null && params.selectedAnswer === params.correctAnswer) {
    return safeWager * params.multiplier;
  }
  return -safeWager;
}

export function computeRankings(teams: Record<TeamId, TeamState>): RankedTeam[] {
  const list = TEAM_IDS.map((id) => teams[id]);
  const sorted = [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  let currentRank: 1 | 2 | 3 = 1;
  return sorted.map((team, idx) => {
    if (idx > 0 && team.score < sorted[idx - 1].score) {
      currentRank = (idx + 1) as 1 | 2 | 3;
    }
    return { team, rank: currentRank };
  });
}

export function areAllTeamsJoined(teams: Record<TeamId, TeamState>): boolean {
  return TEAM_IDS.every((id) => teams[id].joined);
}

export function canStartGame(state: GameState, force = false): boolean {
  if (state.phase !== 'LOBBY') return false;
  if (getActiveQuestions(state).length === 0) return false;
  return force || areAllTeamsJoined(state.teams);
}

export function startGame(state: GameState, now: number = Date.now(), force = false): GameState {
  if (!canStartGame(state, force)) return state;
  const durationMs = state.bettingDurationSec * 1000;
  const nextTeams = { ...state.teams };
  for (const id of TEAM_IDS) {
    nextTeams[id] = {
      ...nextTeams[id],
      score: STARTING_SCORE,
      previousScore: STARTING_SCORE,
      lastDelta: null,
      currentAnswer: null,
      wager: 0,
      lockedIn: false,
      history: [],
    };
  }
  return {
    ...state,
    phase: 'BETTING',
    currentQuestionIndex: 0,
    phaseStartedAt: now,
    phaseEndsAt: now + durationMs,
    teams: nextTeams,
    serverTime: now,
  };
}

export function applyTeamAction(
  state: GameState,
  teamId: TeamId,
  payload: {
    selectedAnswer?: string | null;
    wager?: number;
    lockedIn?: boolean;
  },
  now: number = Date.now(),
): GameState {
  if (state.phase !== 'BETTING') return state;
  const question = getCurrentQuestion(state);
  if (!question) return state;

  const team = state.teams[teamId];
  let nextAnswer = team.currentAnswer;
  if (payload.selectedAnswer !== undefined) {
    if (
      payload.selectedAnswer === null ||
      question.options.some((opt) => opt.key === payload.selectedAnswer)
    ) {
      nextAnswer = payload.selectedAnswer;
    }
  }

  const nextWager =
    payload.wager !== undefined ? clampWager(payload.wager, team.score) : team.wager;
  const nextLockedIn = payload.lockedIn !== undefined ? payload.lockedIn : team.lockedIn;

  return {
    ...state,
    serverTime: now,
    teams: {
      ...state.teams,
      [teamId]: {
        ...team,
        currentAnswer: nextAnswer,
        wager: nextWager,
        lockedIn: nextLockedIn,
      },
    },
  };
}

export function revealCurrentQuestion(state: GameState, now: number = Date.now()): GameState {
  if (state.phase !== 'BETTING') return state;
  const question = getCurrentQuestion(state);
  if (!question) return state;

  const nextTeams = { ...state.teams };
  for (const id of TEAM_IDS) {
    const team = state.teams[id];
    const safeWager = clampWager(team.wager, team.score);
    const delta = calculateRoundDelta({
      wager: safeWager,
      multiplier: question.multiplier,
      selectedAnswer: team.currentAnswer,
      correctAnswer: question.correctAnswer,
    });
    const nextScore = Math.max(0, team.score + delta);
    nextTeams[id] = {
      ...team,
      previousScore: team.score,
      score: nextScore,
      lastDelta: delta,
      wager: safeWager,
      history: [
        ...team.history,
        {
          questionId: question.id,
          selectedAnswer: team.currentAnswer,
          correctAnswer: question.correctAnswer,
          wager: safeWager,
          multiplier: question.multiplier,
          delta,
          scoreAfter: nextScore,
        },
      ],
    };
  }

  return {
    ...state,
    phase: 'REVEALED',
    phaseStartedAt: now,
    phaseEndsAt: null,
    teams: nextTeams,
    serverTime: now,
  };
}

export function advanceToNextQuestion(state: GameState, now: number = Date.now()): GameState {
  if (state.phase !== 'REVEALED') return state;
  const activeQuestions = getActiveQuestions(state);
  const nextIndex = state.currentQuestionIndex + 1;

  if (nextIndex >= activeQuestions.length) {
    return {
      ...state,
      phase: 'GAME_OVER',
      phaseStartedAt: now,
      phaseEndsAt: null,
      serverTime: now,
    };
  }

  const nextTeams = { ...state.teams };
  for (const id of TEAM_IDS) {
    nextTeams[id] = {
      ...state.teams[id],
      previousScore: state.teams[id].score,
      lastDelta: null,
      currentAnswer: null,
      wager: 0,
      lockedIn: false,
    };
  }

  return {
    ...state,
    phase: 'BETTING',
    currentQuestionIndex: nextIndex,
    phaseStartedAt: now,
    phaseEndsAt: now + state.bettingDurationSec * 1000,
    teams: nextTeams,
    serverTime: now,
  };
}

export function resetGame(
  state: GameState,
  keepQuestions = true,
  now: number = Date.now(),
): GameState {
  const base = createInitialGameState(
    keepQuestions ? state.questions : DEFAULT_QUESTIONS,
    now,
  );
  // Preserve joined team connection counts while resetting game scores/answers
  const nextTeams = { ...base.teams };
  for (const id of TEAM_IDS) {
    nextTeams[id] = {
      ...nextTeams[id],
      joined: state.teams[id].connectedClients > 0,
      connectedClients: state.teams[id].connectedClients,
    };
  }
  return {
    ...base,
    teams: nextTeams,
  };
}

export function getRemainingSeconds(phaseEndsAt: number | null, now: number): number {
  if (phaseEndsAt === null) return 0;
  return Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
}

export function getRemainingProgress(
  phaseStartedAt: number | null,
  phaseEndsAt: number | null,
  now: number,
): number {
  if (phaseStartedAt === null || phaseEndsAt === null) return 0;
  const total = phaseEndsAt - phaseStartedAt;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (phaseEndsAt - now) / total));
}
