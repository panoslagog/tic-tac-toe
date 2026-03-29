import type { HangmanGameState, HangmanPublicState, HangmanPlayerState, Player } from './types.js';
import { getPlayerByToken } from './game-logic.js';
import enWords from './words/en.json' with { type: 'json' };
import elWords from './words/el.json' with { type: 'json' };

const INITIAL_LIVES = 6;
const WRONG_WORD_PENALTY = 2;

export function pickRandomWord(language: 'en' | 'el'): string {
  const words = language === 'en' ? enWords : elWords;
  return words[Math.floor(Math.random() * words.length)];
}

export function normalizeInput(input: string): string {
  return input
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getMaskedWord(word: string, guessedLetters: string[]): string {
  return word
    .split('')
    .map((ch) => guessedLetters.includes(ch) ? ch : '_')
    .join('');
}

function createPlayerState(): HangmanPlayerState {
  return {
    guessedLetters: [],
    wrongGuesses: [],
    lives: INITIAL_LIVES,
    solved: false,
    solvedAt: null,
  };
}

export function createHangmanState(playerXToken: string, language: 'en' | 'el'): HangmanGameState {
  return {
    type: 'hangman',
    word: pickRandomWord(language),
    language,
    players: { X: playerXToken, O: null },
    status: 'waiting',
    winner: null,
    lastActivity: Date.now(),
    playerState: {
      X: createPlayerState(),
      O: createPlayerState(),
    },
  };
}

function checkSolved(word: string, ps: HangmanPlayerState): boolean {
  const wordLetters = new Set(word.split(''));
  return [...wordLetters].every((ch) => ps.guessedLetters.includes(ch));
}

export function processLetterGuess(
  state: HangmanGameState,
  player: Player,
  letter: string,
): 'correct' | 'wrong' | 'already-guessed' | 'no-lives' {
  const ps = state.playerState[player];

  if (ps.lives <= 0) return 'no-lives';
  if (ps.solved) return 'already-guessed';
  if (ps.guessedLetters.includes(letter)) return 'already-guessed';

  ps.guessedLetters.push(letter);

  if (state.word.includes(letter)) {
    if (checkSolved(state.word, ps)) {
      ps.solved = true;
      ps.solvedAt = Date.now();
    }
    return 'correct';
  }

  ps.wrongGuesses.push(letter);
  ps.lives = Math.max(0, ps.lives - 1);
  return 'wrong';
}

export function processWordGuess(
  state: HangmanGameState,
  player: Player,
  word: string,
): 'correct' | 'wrong' | 'no-lives' {
  const ps = state.playerState[player];

  if (ps.lives <= 0) return 'no-lives';
  if (ps.solved) return 'correct';

  if (word === state.word) {
    ps.solved = true;
    ps.solvedAt = Date.now();
    return 'correct';
  }

  ps.lives = Math.max(0, ps.lives - WRONG_WORD_PENALTY);
  return 'wrong';
}

export function resolveHangmanOutcome(state: HangmanGameState): void {
  const xSolved = state.playerState.X.solved;
  const oSolved = state.playerState.O.solved;
  const xDead = state.playerState.X.lives <= 0;
  const oDead = state.playerState.O.lives <= 0;

  if (xSolved && oSolved) {
    const xTime = state.playerState.X.solvedAt!;
    const oTime = state.playerState.O.solvedAt!;
    if (xTime < oTime) {
      state.status = 'won';
      state.winner = 'X';
    } else if (oTime < xTime) {
      state.status = 'won';
      state.winner = 'O';
    } else {
      state.status = 'draw';
    }
  } else if (xSolved) {
    state.status = 'won';
    state.winner = 'X';
  } else if (oSolved) {
    state.status = 'won';
    state.winner = 'O';
  } else if (xDead && oDead) {
    state.status = 'draw';
  }
}

export function toHangmanPublicState(state: HangmanGameState, playerToken: string | null): HangmanPublicState {
  const you = playerToken ? getPlayerByToken(state, playerToken) : null;
  const myState = you ? state.playerState[you] : createPlayerState();
  const opponent: Player = you === 'X' ? 'O' : 'X';
  const opponentState = you ? state.playerState[opponent] : createPlayerState();

  const gameOver = state.status === 'won' || state.status === 'draw';

  return {
    type: 'hangman',
    language: state.language,
    status: state.status,
    winner: state.winner,
    you,
    players: { X: !!state.players.X, O: !!state.players.O },
    maskedWord: getMaskedWord(state.word, myState.guessedLetters),
    guessedLetters: myState.guessedLetters,
    wrongGuesses: myState.wrongGuesses,
    lives: myState.lives,
    opponentLives: opponentState.lives,
    opponentSolved: opponentState.solved,
    revealedWord: gameOver ? state.word : null,
  };
}
