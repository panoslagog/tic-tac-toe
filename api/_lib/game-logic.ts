import type { TicTacToeGameState, TicTacToePublicState, GameState, Player } from './types.js';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function checkWinner(board: (Player | null)[]): { winner: Player; winLine: number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a]!, winLine: line };
    }
  }
  return null;
}

export function isDraw(board: (Player | null)[]): boolean {
  return board.every((cell) => cell !== null) && checkWinner(board) === null;
}

export function validateMove(state: TicTacToeGameState, position: number, playerToken: string): string | null {
  if (position < 0 || position > 8 || !Number.isInteger(position)) return 'Invalid position';
  if (state.status !== 'playing') return 'Game is not in progress';

  const player = getPlayerByToken(state, playerToken);
  if (!player) return 'Not a player in this game';
  if (state.currentTurn !== player) return 'Not your turn';
  if (state.board[position] !== null) return 'Cell already occupied';

  return null;
}

export function getPlayerByToken(state: GameState, token: string): Player | null {
  if (state.players.X === token) return 'X';
  if (state.players.O === token) return 'O';
  return null;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ2345679';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createTicTacToeState(playerXToken: string): TicTacToeGameState {
  return {
    type: 'tictactoe',
    board: Array(9).fill(null),
    players: { X: playerXToken, O: null },
    currentTurn: 'X',
    status: 'waiting',
    winner: null,
    winLine: null,
    lastActivity: Date.now(),
  };
}

export function toTicTacToePublicState(state: TicTacToeGameState, playerToken: string | null): TicTacToePublicState {
  const you = playerToken ? getPlayerByToken(state, playerToken) : null;
  return {
    type: 'tictactoe',
    board: state.board,
    currentTurn: state.currentTurn,
    status: state.status,
    winner: state.winner,
    winLine: state.winLine,
    players: { X: !!state.players.X, O: !!state.players.O },
    you,
  };
}
