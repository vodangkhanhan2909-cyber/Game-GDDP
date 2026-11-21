import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_QUESTIONS } from './questions.ts';
import {
  advanceToNextQuestion,
  applyTeamAction,
  calculateRoundDelta,
  canStartGame,
  clampWager,
  computeRankings,
  createInitialGameState,
  getActiveQuestions,
  getRemainingSeconds,
  revealCurrentQuestion,
  startGame,
} from './rules.ts';

test('initial state has 18 default questions (15-20 range) and 3 teams at 100 pts', () => {
  const state = createInitialGameState();
  assert.equal(state.phase, 'LOBBY');
  assert.ok(state.questions.length >= 15 && state.questions.length <= 20);
  assert.equal(state.teams.team1.score, 100);
  assert.equal(state.teams.team2.score, 100);
  assert.equal(state.teams.team3.score, 100);
  assert.equal(state.bettingDurationSec, 15);
});

test('scoring math handles x0, x1, x2, x3 multipliers and no-wager decisions', () => {
  // Correct answers multiply wager by multiplier
  assert.equal(
    calculateRoundDelta({ wager: 40, multiplier: 1, selectedAnswer: 'A', correctAnswer: 'A' }),
    40,
  );
  assert.equal(
    calculateRoundDelta({ wager: 40, multiplier: 2, selectedAnswer: 'B', correctAnswer: 'B' }),
    80,
  );
  assert.equal(
    calculateRoundDelta({ wager: 25, multiplier: 3, selectedAnswer: 'Đúng', correctAnswer: 'Đúng' }),
    75,
  );
  assert.equal(
    calculateRoundDelta({ wager: 50, multiplier: 0, selectedAnswer: 'C', correctAnswer: 'C' }),
    0,
  );

  // Incorrect answers deduct ONLY the wagered amount regardless of multiplier
  assert.equal(
    calculateRoundDelta({ wager: 40, multiplier: 3, selectedAnswer: 'A', correctAnswer: 'B' }),
    -40,
  );
  assert.equal(
    calculateRoundDelta({ wager: 30, multiplier: 0, selectedAnswer: 'A', correctAnswer: 'B' }),
    -30,
  );

  // Unanswered with wager deducts wager; 0 wager yields 0 change
  assert.equal(
    calculateRoundDelta({ wager: 20, multiplier: 2, selectedAnswer: null, correctAnswer: 'B' }),
    -20,
  );
  assert.equal(
    calculateRoundDelta({ wager: 0, multiplier: 3, selectedAnswer: 'A', correctAnswer: 'B' }),
    0,
  );
});

test('clampWager constrains wagers between 0 and current team score', () => {
  assert.equal(clampWager(-10, 100), 0);
  assert.equal(clampWager(150, 100), 100);
  assert.equal(clampWager(45.8, 100), 45);
  assert.equal(clampWager(20, 0), 0);
});

test('cannot start game until all 3 teams join unless forced', () => {
  let state = createInitialGameState();
  assert.equal(canStartGame(state), false);

  state.teams.team1.joined = true;
  state.teams.team2.joined = true;
  assert.equal(canStartGame(state), false);
  assert.equal(canStartGame(state, true), true);

  state.teams.team3.joined = true;
  assert.equal(canStartGame(state), true);
});

test('full round progression updates scores, deltas, rankings, and supports T/F/NM questions', () => {
  const twoQuestions = DEFAULT_QUESTIONS.slice(0, 2);
  twoQuestions[0] = { ...twoQuestions[0], multiplier: 2, correctAnswer: 'B' };
  twoQuestions[1] = { ...twoQuestions[1], multiplier: 3, correctAnswer: 'Không được đề cập' };

  let state = createInitialGameState(twoQuestions, 1000);
  state.teams.team1.joined = true;
  state.teams.team2.joined = true;
  state.teams.team3.joined = true;

  // Start Question 1 (Multiple Choice, x2)
  state = startGame(state, 2000);
  assert.equal(state.phase, 'BETTING');
  assert.equal(state.phaseEndsAt, 17000);
  assert.equal(getRemainingSeconds(state.phaseEndsAt, 10000), 7);

  // Team 1 bets 50 on B (correct -> +100 -> 200)
  state = applyTeamAction(state, 'team1', { selectedAnswer: 'B', wager: 50 }, 3000);
  // Team 2 bets 30 on A (incorrect -> -30 -> 70)
  state = applyTeamAction(state, 'team2', { selectedAnswer: 'A', wager: 30 }, 4000);
  // Team 3 chooses not to wager (0 -> 100)
  state = applyTeamAction(state, 'team3', { selectedAnswer: 'C', wager: 0 }, 5000);

  state = revealCurrentQuestion(state, 17000);
  assert.equal(state.phase, 'REVEALED');
  assert.equal(state.teams.team1.score, 200);
  assert.equal(state.teams.team1.lastDelta, 100);
  assert.equal(state.teams.team2.score, 70);
  assert.equal(state.teams.team2.lastDelta, -30);
  assert.equal(state.teams.team3.score, 100);
  assert.equal(state.teams.team3.lastDelta, 0);

  const rankings = computeRankings(state.teams);
  assert.deepEqual(
    rankings.map((r) => [r.team.id, r.rank]),
    [
      ['team1', 1],
      ['team3', 2],
      ['team2', 3],
    ],
  );

  // Advance to Question 2 (True / False / Not Mentioned, x3)
  state = advanceToNextQuestion(state, 20000);
  assert.equal(state.phase, 'BETTING');
  assert.equal(state.currentQuestionIndex, 1);

  state = applyTeamAction(state, 'team2', { selectedAnswer: 'Không được đề cập', wager: 60 }, 21000);
  state = revealCurrentQuestion(state, 35000);
  // Team 2 had 70 + 60*3 = 250!
  assert.equal(state.teams.team2.score, 250);

  const finalRankings = computeRankings(state.teams);
  assert.equal(finalRankings[0].team.id, 'team2');
  assert.equal(finalRankings[0].rank, 1);

  // Advance past last question -> GAME_OVER
  state = advanceToNextQuestion(state, 36000);
  assert.equal(state.phase, 'GAME_OVER');
  assert.equal(getActiveQuestions(state).length, 2);
});
