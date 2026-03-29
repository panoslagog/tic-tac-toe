import { describe, it, expect } from 'vitest';
import { checkWinner, generateRoomCode, validateMove, createTicTacToeState } from '../_lib/game-logic';

describe('checkWinner', () => {
  it('returns null for empty board', () => {
    const board = Array(9).fill(null);
    expect(checkWinner(board)).toBeNull();
  });

  it('detects row win', () => {
    const board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
    expect(checkWinner(board)).toEqual({ winner: 'X', winLine: [0, 1, 2] });
  });

  it('detects column win', () => {
    const board = ['O', 'X', null, 'O', 'X', null, 'O', null, null];
    expect(checkWinner(board)).toEqual({ winner: 'O', winLine: [0, 3, 6] });
  });

  it('detects diagonal win', () => {
    const board = ['X', 'O', null, null, 'X', 'O', null, null, 'X'];
    expect(checkWinner(board)).toEqual({ winner: 'X', winLine: [0, 4, 8] });
  });

  it('detects anti-diagonal win', () => {
    const board = [null, null, 'O', null, 'O', 'X', 'O', 'X', null];
    expect(checkWinner(board)).toEqual({ winner: 'O', winLine: [2, 4, 6] });
  });

  it('returns null for draw (no winner)', () => {
    const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(checkWinner(board)).toBeNull();
  });
});

describe('validateMove', () => {
  it('rejects position out of range', () => {
    const state = createTicTacToeState('token-x');
    expect(validateMove(state, 9, 'token-x')).toBe('Invalid position');
    expect(validateMove(state, -1, 'token-x')).toBe('Invalid position');
  });

  it('rejects move on occupied cell', () => {
    const state = createTicTacToeState('token-x');
    state.board[4] = 'X';
    state.currentTurn = 'O';
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 4, 'token-o')).toBe('Cell already occupied');
  });

  it('rejects move when not your turn', () => {
    const state = createTicTacToeState('token-x');
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 0, 'token-o')).toBe('Not your turn');
  });

  it('rejects move from unknown player', () => {
    const state = createTicTacToeState('token-x');
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 0, 'unknown')).toBe('Not a player in this game');
  });

  it('rejects move when game is not playing', () => {
    const state = createTicTacToeState('token-x');
    expect(validateMove(state, 0, 'token-x')).toBe('Game is not in progress');
  });

  it('accepts valid move', () => {
    const state = createTicTacToeState('token-x');
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 0, 'token-x')).toBeNull();
  });
});

describe('generateRoomCode', () => {
  it('returns a 4-character alphanumeric string', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe('createTicTacToeState', () => {
  it('creates a valid initial state', () => {
    const state = createTicTacToeState('my-token');
    expect(state.type).toBe('tictactoe');
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.players.X).toBe('my-token');
    expect(state.players.O).toBeNull();
    expect(state.currentTurn).toBe('X');
    expect(state.status).toBe('waiting');
    expect(state.winner).toBeNull();
    expect(state.winLine).toBeNull();
  });
});
