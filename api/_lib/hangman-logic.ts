import type { HangmanGameState, HangmanPublicState, HangmanPlayerState, Player, HangmanCategory } from './types.js';
import { getPlayerByToken } from './game-logic.js';
import enWords from './words/en.json' with { type: 'json' };
import elWords from './words/el.json' with { type: 'json' };

const INITIAL_LIVES = 6;
const WRONG_WORD_PENALTY = 2;

const ALL_CATEGORIES: HangmanCategory[] = [
  'animals', 'food', 'nature', 'body', 'home', 'places', 'sports',
  'professions', 'clothing', 'music', 'other',
];

export function getCategories(): HangmanCategory[] {
  return ALL_CATEGORIES;
}

export function pickRandomWord(language: 'en' | 'el', category?: HangmanCategory): string {
  const wordMap: Record<string, string[]> = language === 'en'
    ? (enWords as Record<string, string[]>)
    : (elWords as Record<string, string[]>);

  if (category && category !== ('random' as HangmanCategory)) {
    const pool = wordMap[category] ?? [];
    if (pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // No category or empty pool — pick from all words across all categories
  const allWords = Object.values(wordMap).flat();
  return allWords[Math.floor(Math.random() * allWords.length)];
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

export function createHangmanState(playerXToken: string, language: 'en' | 'el', category?: HangmanCategory, username?: string): HangmanGameState {
  const resolvedCategory: HangmanCategory = category ?? 'other';
  return {
    type: 'hangman',
    word: pickRandomWord(language, category),
    language,
    category: resolvedCategory,
    players: { X: playerXToken, O: null },
    usernames: { X: username || null, O: null },
    scores: { X: 0, O: 0 },
    status: 'waiting',
    winner: null,
    lastActivity: Date.now(),
    playerState: {
      X: createPlayerState(),
      O: createPlayerState(),
    },
  };
}

export function giveStartingLetter(state: HangmanGameState): void {
  const uniqueLetters = [...new Set(state.word.split(''))];
  const letter = uniqueLetters[Math.floor(Math.random() * uniqueLetters.length)];
  // Give the same random letter to both players
  for (const player of ['X', 'O'] as Player[]) {
    const ps = state.playerState[player];
    if (!ps.guessedLetters.includes(letter)) {
      ps.guessedLetters.push(letter);
    }
  }
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
    category: state.category,
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
    usernames: state.usernames ?? { X: null, O: null },
    scores: state.scores ?? { X: 0, O: 0 },
  };
}

export function getCategoryWordCounts(language: 'en' | 'el'): Record<string, number> {
  const wordMap = language === 'en' ? enWords : elWords;
  const counts: Record<string, number> = {};
  for (const [cat, words] of Object.entries(wordMap as Record<string, string[]>)) {
    counts[cat] = words.length;
  }
  return counts;
}
