export type TeamId = 'team1' | 'team2' | 'team3';

export type Multiplier = 0 | 1 | 2 | 3;

export type QuestionType = 'multiple_choice' | 'true_false_nm';

export interface QuestionOption {
  key: string; // 'A' | 'B' | 'C' | 'D' or 'True' | 'False' | 'Not Mentioned'
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  category: string;
  prompt: string;
  passage?: string;
  options: QuestionOption[];
  correctAnswer: string;
  multiplier: Multiplier;
  enabled: boolean;
}

export interface RoundHistoryEntry {
  questionId: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  wager: number;
  multiplier: Multiplier;
  delta: number;
  scoreAfter: number;
}

export interface TeamState {
  id: TeamId;
  name: string;
  accentHex: string;
  score: number;
  previousScore: number;
  lastDelta: number | null;
  joined: boolean;
  connectedClients: number;
  currentAnswer: string | null;
  wager: number;
  lockedIn: boolean;
  history: RoundHistoryEntry[];
}

export type GamePhase = 'LOBBY' | 'BETTING' | 'REVEALED' | 'GAME_OVER';

export interface GameState {
  phase: GamePhase;
  currentQuestionIndex: number;
  bettingDurationSec: number;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  questions: Question[];
  teams: Record<TeamId, TeamState>;
  serverTime: number;
}

export interface RankedTeam {
  team: TeamState;
  rank: 1 | 2 | 3;
}

export type ClientMessage =
  | { type: 'client:register'; role: 'host' | 'player'; teamId?: TeamId }
  | { type: 'player:join_team'; teamId: TeamId }
  | { type: 'player:leave_team'; teamId: TeamId }
  | {
      type: 'player:submit_action';
      teamId: TeamId;
      selectedAnswer?: string | null;
      wager?: number;
      lockedIn?: boolean;
    }
  | { type: 'host:start_game'; force?: boolean }
  | { type: 'host:reveal_answer' }
  | { type: 'host:next_question' }
  | { type: 'host:reset_game'; keepQuestions?: boolean }
  | { type: 'host:update_question'; question: Question }
  | { type: 'host:add_question'; question: Omit<Question, 'id'> }
  | { type: 'host:delete_question'; questionId: string }
  | { type: 'host:set_multiplier'; questionId: string; multiplier: Multiplier }
  | { type: 'host:toggle_question'; questionId: string; enabled: boolean }
  | { type: 'host:fill_demo_teams' }
  | { type: 'sync:request' };

export type ServerMessage =
  | { type: 'state:sync'; state: GameState }
  | { type: 'error'; message: string };
