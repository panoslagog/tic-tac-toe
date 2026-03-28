import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Player = 'X' | 'O';

export interface PublicGameState {
  board: (Player | null)[];
  currentTurn: Player;
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  winLine: number[] | null;
  players: { X: boolean; O: boolean };
  you: Player | null;
}

interface CreateGameResponse {
  roomCode: string;
  playerToken: string;
  player: Player;
}

interface JoinGameResponse {
  playerToken: string;
  player: Player;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private playerToken = signal<string | null>(null);
  private _gameState = signal<PublicGameState | null>(null);
  private _roomCode = signal<string | null>(null);
  private _myPlayer = signal<Player | null>(null);
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private _error = signal<string | null>(null);
  private consecutiveFailures = 0;
  private _connectionLost = signal(false);

  gameState = this._gameState.asReadonly();
  roomCode = this._roomCode.asReadonly();
  myPlayer = this._myPlayer.asReadonly();
  error = this._error.asReadonly();
  connectionLost = this._connectionLost.asReadonly();

  isMyTurn = computed(() => {
    const state = this._gameState();
    const me = this._myPlayer();
    return state?.status === 'playing' && state.currentTurn === me;
  });

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    let h = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (this.playerToken()) {
      h = h.set('X-Player-Token', this.playerToken()!);
    }
    return h;
  }

  async createGame(): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<CreateGameResponse>('/api/game', {})
    );
    this.playerToken.set(res.playerToken);
    this._roomCode.set(res.roomCode);
    this._myPlayer.set(res.player);
    this.startPolling(res.roomCode);
    return res.roomCode;
  }

  async joinGame(roomCode: string): Promise<void> {
    const code = roomCode.toUpperCase().trim();
    try {
      const res = await firstValueFrom(
        this.http.post<JoinGameResponse>(`/api/game/${code}/join`, {})
      );
      this.playerToken.set(res.playerToken);
      this._roomCode.set(code);
      this._myPlayer.set(res.player);
      this._error.set(null);
      this.startPolling(code);
    } catch (err: any) {
      const msg = err?.error?.error || 'Failed to join game';
      this._error.set(msg);
      throw new Error(msg);
    }
  }

  async makeMove(position: number): Promise<void> {
    const code = this._roomCode();
    if (!code) return;
    try {
      const res = await firstValueFrom(
        this.http.post<PublicGameState>(
          `/api/game/${code}/move`,
          { position },
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
    this._error.set(null);
    this.consecutiveFailures = 0;
    this._connectionLost.set(false);
  }
}
