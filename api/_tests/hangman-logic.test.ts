import { describe, it, expect } from 'vitest';
import {
  createHangmanState,
  pickRandomWord,
  normalizeInput,
  processLetterGuess,
  processWordGuess,
  getMaskedWord,
  toHangmanPublicState,
} from '../_lib/hangman-logic';

describe('pickRandomWord', () => {
  it('returns an uppercase English word', () => {
    const word = pickRandomWord('en');
    expect(word).toMatch(/^[A-Z]+$/);
    expect(word.length).toBeGreaterThanOrEqual(4);
  });

  it('returns an uppercase Greek word', () => {
    const word = pickRandomWord('el');
    expect(word.length).toBeGreaterThanOrEqual(3);
    expect(word).toMatch(/^[\u0391-\u03A9]+$/);
  });

  it('returns a word from the specified category', () => {
    const word = pickRandomWord('en', 'animals');
    expect(word).toMatch(/^[A-Z]+$/);
    expect(word.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back to all words when category is not provided', () => {
    const word = pickRandomWord('en', undefined);
    expect(word).toMatch(/^[A-Z]+$/);
    expect(word.length).toBeGreaterThanOrEqual(4);
  });
});

describe('normalizeInput', () => {
  it('uppercases latin input', () => {
    expect(normalizeInput('hello')).toBe('HELLO');
  });

  it('uppercases and strips accents from Greek input', () => {
    expect(normalizeInput('ελληνικά')).toBe('ΕΛΛΗΝΙΚΑ');
    expect(normalizeInput('Άλφα')).toBe('ΑΛΦΑ');
  });
});

describe('getMaskedWord', () => {
  it('masks unrevealed letters', () => {
    expect(getMaskedWord('HELLO', ['H', 'L'])).toBe('H_LL_');
  });

  it('shows fully revealed word', () => {
    expect(getMaskedWord('HELLO', ['H', 'E', 'L', 'O'])).toBe('HELLO');
  });

  it('shows all underscores for no guesses', () => {
    expect(getMaskedWord('CAT', [])).toBe('___');
  });
});

describe('processLetterGuess', () => {
  it('reveals correct letter and does not lose a life', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    const result = processLetterGuess(state, 'X', 'H');
    expect(result).toBe('correct');
    expect(state.playerState.X.guessedLetters).toContain('H');
    expect(state.playerState.X.wrongGuesses).not.toContain('H');
    expect(state.playerState.X.lives).toBe(6);
  });

  it('penalizes wrong letter with 1 life', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    const result = processLetterGuess(state, 'X', 'Z');
    expect(result).toBe('wrong');
    expect(state.playerState.X.wrongGuesses).toContain('Z');
    expect(state.playerState.X.lives).toBe(5);
  });

  it('ignores already-guessed letter', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    processLetterGuess(state, 'X', 'H');
    const result = processLetterGuess(state, 'X', 'H');
    expect(result).toBe('already-guessed');
    expect(state.playerState.X.lives).toBe(6);
  });

  it('marks player as solved when all letters revealed', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HI';

    processLetterGuess(state, 'X', 'H');
    processLetterGuess(state, 'X', 'I');
    expect(state.playerState.X.solved).toBe(true);
    expect(state.playerState.X.solvedAt).not.toBeNull();
  });
});

describe('processWordGuess', () => {
  it('solves immediately on correct word', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    const result = processWordGuess(state, 'X', 'HELLO');
    expect(result).toBe('correct');
    expect(state.playerState.X.solved).toBe(true);
    expect(state.playerState.X.lives).toBe(6);
  });

  it('penalizes wrong word guess with 2 lives', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    const result = processWordGuess(state, 'X', 'WORLD');
    expect(result).toBe('wrong');
    expect(state.playerState.X.solved).toBe(false);
    expect(state.playerState.X.lives).toBe(4);
  });
});

describe('toHangmanPublicState', () => {
  it('masks word based on player guesses', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';
    state.playerState.X.guessedLetters = ['H', 'L'];

    const pub = toHangmanPublicState(state, 'token-x');
    expect(pub.maskedWord).toBe('H_LL_');
    expect(pub.lives).toBe(6);
    expect(pub.revealedWord).toBeNull();
  });

  it('reveals word when game is over', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'draw';
    (state as any).word = 'HELLO';

    const pub = toHangmanPublicState(state, 'token-x');
    expect(pub.revealedWord).toBe('HELLO');
  });

  it('shows opponent lives but not their letters', () => {
    const state = createHangmanState('token-x', 'en', 'other');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';
    state.playerState.O.lives = 3;
    state.playerState.O.guessedLetters = ['A', 'B', 'C'];

    const pub = toHangmanPublicState(state, 'token-x');
    expect(pub.opponentLives).toBe(3);
    expect(pub.guessedLetters).toEqual([]);
  });
});
