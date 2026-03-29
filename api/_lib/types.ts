export type Player = 'X' | 'O';
export type GameType = 'tictactoe' | 'hangman';
export type HangmanCategory = 'animals' | 'food' | 'nature' | 'body' | 'home' | 'places' | 'sports' | 'professions' | 'clothing' | 'music' | 'other';

// --- Base ---

interface BaseGameState {
  type: GameType;
  players: { X: string | null; O: string | null };
  usernames: { X: string | null; O: string | null };
  scores: { X: number; O: number };
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  lastActivity: number;
}

// --- Tic-Tac-Toe ---

export interface TicTacToeGameState extends BaseGameState {
  type: 'tictactoe';
  board: (Player | null)[];
  currentTurn: Player;
  winLine: number[] | null;
}

export interface TicTacToePublicState {
  type: 'tictactoe';
  board: (Player | null)[];
  currentTurn: Player;
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  winLine: number[] | null;
  players: { X: boolean; O: boolean };
  you: Player | null;
  usernames: { X: string | null; O: string | null };
  scores: { X: number; O: number };
}

// --- Hangman ---

export interface HangmanPlayerState {
  guessedLetters: string[];
  wrongGuesses: string[];
  lives: number;
  solved: boolean;
  solvedAt: number | null;
}

export interface HangmanGameState extends BaseGameState {
  type: 'hangman';
  word: string;
  language: 'en' | 'el';
  category: HangmanCategory;
  playerState: {
    X: HangmanPlayerState;
    O: HangmanPlayerState;
  };
}

export interface HangmanPublicState {
  type: 'hangman';
  language: 'en' | 'el';
  category: HangmanCategory;
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  you: Player | null;
  players: { X: boolean; O: boolean };
  maskedWord: string;
  guessedLetters: string[];
  wrongGuesses: string[];
  lives: number;
  opponentLives: number;
  opponentSolved: boolean;
  revealedWord: string | null;
  usernames: { X: string | null; O: string | null };
  scores: { X: number; O: number };
}

// --- Union ---

export type GameState = TicTacToeGameState | HangmanGameState;
export type PublicGameState = TicTacToePublicState | HangmanPublicState;

// --- API Responses ---

export interface CreateGameResponse {
  roomCode: string;
  playerToken: string;
  player: Player;
}

export interface JoinGameResponse {
  playerToken: string;
  player: Player;
  type: GameType;
}
