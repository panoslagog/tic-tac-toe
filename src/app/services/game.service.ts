import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Player = 'X' | 'O';
export type GameType = 'tictactoe' | 'hangman';
export type HangmanCategory = 'animals' | 'food' | 'nature' | 'body' | 'home' | 'places' | 'sports' | 'professions' | 'clothing' | 'music' | 'other';

export interface TicTacToePublicState {
  type: 'tictactoe';
  board: (Player | null)[];
  currentTurn: Player;
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  winLine: number[] | null;
  players: { X: boolean; O: boolean };
  you: Player | null;
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
}

export type PublicGameState = TicTacToePublicState | HangmanPublicState;

interface CreateGameResponse {
  roomCode: string;
  playerToken: string;
  player: Player;
}

interface JoinGameResponse {
  playerToken: string;
  player: Player;
  type: GameType;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private playerToken = signal<string | null>(null);
  private _gameState = signal<PublicGameState | null>(null);
  private _roomCode = signal<string | null>(null);
  private _myPlayer = signal<Player | null>(null);
  private _gameType = signal<GameType | null>(null);
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private _error = signal<string | null>(null);
  private consecutiveFailures = 0;
  private _connectionLost = signal(false);

  gameState = this._gameState.asReadonly();
  roomCode = this._roomCode.asReadonly();
  myPlayer = this._myPlayer.asReadonly();
  gameType = this._gameType.asReadonly();
  error = this._error.asReadonly();
  connectionLost = this._connectionLost.asReadonly();

  isMyTurn = computed(() => {
    const state = this._gameState();
    if (!state || state.type !== 'tictactoe') return false;
    const me = this._myPlayer();
    return state.status === 'playing' && state.currentTurn === me;
  });

  tttState = computed(() => {
    const s = this._gameState();
    return s && s.type === 'tictactoe' ? s as TicTacToePublicState : null;
  });

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    let h = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (this.playerToken()) {
      h = h.set('X-Player-Token', this.playerToken()!);
    }
    return h;
  }

  async createGame(type: GameType = 'tictactoe', language?: 'en' | 'el', category?: string): Promise<{ roomCode: string; type: GameType }> {
    const body: Record<string, string> = { type };
    if (language) body['language'] = language;
    if (category) body['category'] = category;

    const res = await firstValueFrom(
      this.http.post<CreateGameResponse>('/api/game', body)
    );
    this.playerToken.set(res.playerToken);
    this._roomCode.set(res.roomCode);
    this._myPlayer.set(res.player);
    this._gameType.set(type);
    this.startPolling(res.roomCode);
    return { roomCode: res.roomCode, type };
  }

  async joinGame(roomCode: string): Promise<GameType> {
    const code = roomCode.toUpperCase().trim();
    try {
      const res = await firstValueFrom(
        this.http.post<JoinGameResponse>(`/api/game/${code}/join`, {})
      );
      this.playerToken.set(res.playerToken);
      this._roomCode.set(code);
      this._myPlayer.set(res.player);
      this._gameType.set(res.type);
      this._error.set(null);
      this.startPolling(code);
      return res.type;
    } catch (err: any) {
      const msg = err?.error?.error || 'Failed to join game';
      this._error.set(msg);
      throw new Error(msg);
    }
  }

  async rematch(): Promise<void> {
    const code = this._roomCode();
    if (!code) return;
    await firstValueFrom(
      this.http.post(`/api/game/${code}/rematch`, {}, { headers: this.headers() })
    );
  }

  async makeMove(payload: { position: number } | { letter: string } | { word: string }): Promise<void> {
    const code = this._roomCode();
    if (!code) return;
    try {
      const res = await firstValueFrom(
        this.http.post<PublicGameState>(
          `/api/game/${code}/move`,
          payload,
          { headers: this.headers() }
        )
      );
      this._gameState.set(res);
    } catch (err: any) {
      await this.fetchState(code);
    }
  }

  private async fetchState(roomCode: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<PublicGameState>(`/api/game/${roomCode}`, {
          headers: this.headers(),
        })
      );
      this._gameState.set(res);
      this.consecutiveFailures = 0;
      this._connectionLost.set(false);
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 3) {
        this._connectionLost.set(true);
      }
    }
  }

  startPolling(roomCode: string): void {
    this.stopPolling();
    this.fetchState(roomCode);
    this.pollingInterval = setInterval(() => this.fetchState(roomCode), 1500);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  reset(): void {
    this.stopPolling();
    this.playerToken.set(null);
    this._gameState.set(null);
    this._roomCode.set(null);
    this._myPlayer.set(null);
    this._gameType.set(null);
    this._error.set(null);
    this.consecutiveFailures = 0;
    this._connectionLost.set(false);
  }
}
