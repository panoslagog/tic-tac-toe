export type Player = 'X' | 'O';

export interface GameState {
  board: (Player | null)[];
  players: {
    X: string | null;  // player token
    O: string | null;
  };
  currentTurn: Player;
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  winLine: number[] | null;
  lastActivity: number;
}

export interface CreateGameResponse {
  roomCode: string;
  playerToken: string;
  player: Player;
}

export interface JoinGameResponse {
  playerToken: string;
  player: Player;
}

export interface PublicGameState {
  board: (Player | null)[];
  currentTurn: Player;
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  winLine: number[] | null;
  players: { X: boolean; O: boolean };
  you: Player | null;
}
