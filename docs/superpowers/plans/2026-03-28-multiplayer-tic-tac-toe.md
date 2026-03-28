# Multiplayer Tic-Tac-Toe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-player online tic-tac-toe game with room-based multiplayer, animated UI, and Vercel deployment.

**Architecture:** Angular 19 SPA with standalone components and Angular Animations for the frontend. Vercel Serverless Functions (TypeScript) for the backend API. Upstash Redis for game state storage with HTTP polling for real-time sync.

**Tech Stack:** Angular 19, TypeScript, Vercel Serverless Functions, Upstash Redis (@upstash/redis), Angular Animations, Canvas API (confetti)

---

## File Structure

```
tic-tac-toe/
├── api/                              # Vercel Serverless Functions
│   ├── _lib/
│   │   ├── redis.ts                  # Upstash Redis client singleton
│   │   ├── game-logic.ts             # Win detection, move validation, room codes
│   │   └── types.ts                  # Shared types (GameState, etc.)
│   ├── game/
│   │   └── index.ts                  # POST /api/game — create game
│   ├── game/
│   │   └── [id]/
│   │       ├── index.ts              # GET /api/game/:id — get state
│   │       ├── join.ts               # POST /api/game/:id/join
│   │       └── move.ts              # POST /api/game/:id/move
│   └── _tests/
│       └── game-logic.test.ts        # Unit tests for game logic
├── src/
│   ├── app/
│   │   ├── app.component.ts          # Root component
│   │   ├── app.routes.ts             # Route definitions
│   │   ├── services/
│   │   │   └── game.service.ts       # HTTP client + polling + state
│   │   ├── home/
│   │   │   └── home.component.ts     # Landing page (create/join)
│   │   └── game/
│   │       ├── game.component.ts     # Game orchestrator (polling, status)
│   │       ├── board/
│   │       │   └── board.component.ts # 3x3 grid
│   │       ├── cell/
│   │       │   └── cell.component.ts  # Individual cell with SVG X/O
│   │       ├── win-line/
│   │       │   └── win-line.component.ts # SVG win line overlay
│   │       └── confetti/
│   │           └── confetti.component.ts # Canvas confetti burst
│   ├── styles.css                    # Global styles (dark theme)
│   ├── index.html
│   └── main.ts
├── vercel.json                       # Vercel config (SPA rewrite)
├── angular.json
├── package.json
└── tsconfig.json
```

---

## Task 1: Scaffold Angular Project + Vercel Config

**Files:**
- Create: `package.json`, `angular.json`, `tsconfig.json`, `tsconfig.app.json`, `src/main.ts`, `src/index.html`, `src/styles.css`, `src/app/app.component.ts`, `src/app/app.routes.ts`, `vercel.json`, `.gitignore`

- [ ] **Step 1: Scaffold Angular 19 project**

```bash
npx @angular/cli@latest new tic-tac-toe --directory . --style css --ssr false --routing true --standalone --skip-git
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @upstash/redis uuid
npm install -D @types/uuid vitest
```

- [ ] **Step 3: Create vercel.json**

Create `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: Add api tsconfig**

Create `api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "../dist/api",
    "rootDir": ".",
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["_tests"]
}
```

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:
```
.vercel
.env*.local
```

- [ ] **Step 6: Verify Angular builds**

```bash
npx ng build
```

Expected: Build succeeds, output in `dist/tic-tac-toe/browser/`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Angular 19 project with Vercel config"
```

---

## Task 2: Backend — Shared Types and Redis Client

**Files:**
- Create: `api/_lib/types.ts`, `api/_lib/redis.ts`

- [ ] **Step 1: Create shared types**

Create `api/_lib/types.ts`:
```typescript
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
```

- [ ] **Step 2: Create Redis client**

Create `api/_lib/redis.ts`:
```typescript
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const GAME_TTL = 3600; // 1 hour

export async function getGame(roomCode: string): Promise<import('./types').GameState | null> {
  const data = await redis.get<import('./types').GameState>(`game:${roomCode}`);
  return data;
}

export async function setGame(roomCode: string, state: import('./types').GameState): Promise<void> {
  await redis.set(`game:${roomCode}`, state, { ex: GAME_TTL });
}
```

- [ ] **Step 3: Commit**

```bash
git add api/_lib/types.ts api/_lib/redis.ts
git commit -m "feat: add shared types and Redis client for game state"
```

---

## Task 3: Backend — Game Logic (TDD)

**Files:**
- Create: `api/_lib/game-logic.ts`, `api/_tests/game-logic.test.ts`

- [ ] **Step 1: Add vitest config**

Add to `package.json` scripts:
```json
"test:api": "vitest run api/_tests/"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/_tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write failing tests for win detection**

Create `api/_tests/game-logic.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { checkWinner, generateRoomCode, validateMove, createInitialState } from '../_lib/game-logic';

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
    const state = createInitialState('token-x');
    expect(validateMove(state, 9, 'token-x')).toBe('Invalid position');
    expect(validateMove(state, -1, 'token-x')).toBe('Invalid position');
  });

  it('rejects move on occupied cell', () => {
    const state = createInitialState('token-x');
    state.board[4] = 'X';
    state.currentTurn = 'O';
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 4, 'token-o')).toBe('Cell already occupied');
  });

  it('rejects move when not your turn', () => {
    const state = createInitialState('token-x');
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 0, 'token-o')).toBe('Not your turn');
  });

  it('rejects move from unknown player', () => {
    const state = createInitialState('token-x');
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 0, 'unknown')).toBe('Not a player in this game');
  });

  it('rejects move when game is not playing', () => {
    const state = createInitialState('token-x');
    expect(validateMove(state, 0, 'token-x')).toBe('Game is not in progress');
  });

  it('accepts valid move', () => {
    const state = createInitialState('token-x');
    state.players.O = 'token-o';
    state.status = 'playing';
    expect(validateMove(state, 0, 'token-x')).toBeNull();
  });
});

describe('generateRoomCode', () => {
  it('returns a 6-character alphanumeric string', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe('createInitialState', () => {
  it('creates a valid initial state', () => {
    const state = createInitialState('my-token');
    expect(state.board).toEqual(Array(9).fill(null));
    expect(state.players.X).toBe('my-token');
    expect(state.players.O).toBeNull();
    expect(state.currentTurn).toBe('X');
    expect(state.status).toBe('waiting');
    expect(state.winner).toBeNull();
    expect(state.winLine).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run api/_tests/
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement game logic**

Create `api/_lib/game-logic.ts`:
```typescript
import type { GameState, Player } from './types';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
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

export function validateMove(state: GameState, position: number, playerToken: string): string | null {
  if (state.status !== 'playing') return 'Game is not in progress';
  if (position < 0 || position > 8 || !Number.isInteger(position)) return 'Invalid position';

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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createInitialState(playerXToken: string): GameState {
  return {
    board: Array(9).fill(null),
    players: { X: playerXToken, O: null },
    currentTurn: 'X',
    status: 'waiting',
    winner: null,
    winLine: null,
    lastActivity: Date.now(),
  };
}

export function toPublicState(state: GameState, playerToken: string | null): import('./types').PublicGameState {
  const you = playerToken ? getPlayerByToken(state, playerToken) : null;
  return {
    board: state.board,
    currentTurn: state.currentTurn,
    status: state.status,
    winner: state.winner,
    winLine: state.winLine,
    players: { X: !!state.players.X, O: !!state.players.O },
    you,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run api/_tests/
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/game-logic.ts api/_tests/game-logic.test.ts vitest.config.ts package.json
git commit -m "feat: implement game logic with win detection and move validation (TDD)"
```

---

## Task 4: Backend — API Endpoints

**Files:**
- Create: `api/game/index.ts`, `api/game/[id]/index.ts`, `api/game/[id]/join.ts`, `api/game/[id]/move.ts`

- [ ] **Step 1: Create POST /api/game (create game)**

Create `api/game/index.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../_lib/redis';
import { createInitialState, generateRoomCode } from '../_lib/game-logic';
import type { CreateGameResponse } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let roomCode: string;
  let attempts = 0;
  do {
    roomCode = generateRoomCode();
    const existing = await getGame(roomCode);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    return res.status(500).json({ error: 'Could not generate unique room code' });
  }

  const playerToken = uuidv4();
  const state = createInitialState(playerToken);
  await setGame(roomCode, state);

  const response: CreateGameResponse = {
    roomCode,
    playerToken,
    player: 'X',
  };
  return res.status(201).json(response);
}
```

- [ ] **Step 2: Create GET /api/game/:id (get state)**

Create `api/game/[id]/index.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame } from '../../_lib/redis';
import { toPublicState } from '../../_lib/game-logic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const state = await getGame(roomCode);

  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const playerToken = req.headers['x-player-token'] as string | undefined;
  return res.status(200).json(toPublicState(state, playerToken ?? null));
}
```

- [ ] **Step 3: Create POST /api/game/:id/join**

Create `api/game/[id]/join.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../../_lib/redis';
import type { JoinGameResponse } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const state = await getGame(roomCode);

  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (state.players.O) {
    return res.status(400).json({ error: 'Game is full' });
  }

  const playerToken = uuidv4();
  state.players.O = playerToken;
  state.status = 'playing';
  state.lastActivity = Date.now();
  await setGame(roomCode, state);

  const response: JoinGameResponse = {
    playerToken,
    player: 'O',
  };
  return res.status(200).json(response);
}
```

- [ ] **Step 4: Create POST /api/game/:id/move**

Create `api/game/[id]/move.ts`:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis';
import { validateMove, checkWinner, isDraw, getPlayerByToken, toPublicState } from '../../_lib/game-logic';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;
  const { position } = req.body as { position: number };

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const error = validateMove(state, position, playerToken);
  if (error) {
    const statusCode = error === 'Not a player in this game' ? 403
      : error === 'Not your turn' ? 403
      : 400;
    return res.status(statusCode).json({ error });
  }

  const player = getPlayerByToken(state, playerToken)!;
  state.board[position] = player;
  state.lastActivity = Date.now();

  const winResult = checkWinner(state.board);
  if (winResult) {
    state.status = 'won';
    state.winner = winResult.winner;
    state.winLine = winResult.winLine;
  } else if (isDraw(state.board)) {
    state.status = 'draw';
  } else {
    state.currentTurn = player === 'X' ? 'O' : 'X';
  }

  await setGame(roomCode, state);
  return res.status(200).json(toPublicState(state, playerToken));
}
```

- [ ] **Step 5: Install @vercel/node**

```bash
npm install -D @vercel/node
```

- [ ] **Step 6: Commit**

```bash
git add api/game/ package.json package-lock.json
git commit -m "feat: add API endpoints for create, join, get state, and make move"
```

---

## Task 5: Frontend — Game Service

**Files:**
- Create: `src/app/services/game.service.ts`

- [ ] **Step 1: Create GameService**

Create `src/app/services/game.service.ts`:
```typescript
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
      // Silently refresh state on failure (race condition)
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
```

- [ ] **Step 2: Ensure HttpClient is provided**

Edit `src/app/app.config.ts` to include `provideHttpClient()`:
```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/services/game.service.ts src/app/app.config.ts
git commit -m "feat: add GameService with HTTP client, polling, and state management"
```

---

## Task 6: Frontend — Home Component

**Files:**
- Create: `src/app/home/home.component.ts`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Create HomeComponent**

Create `src/app/home/home.component.ts`:
```typescript
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="home-container">
      <h1 class="title">Tic Tac Toe</h1>
      <p class="subtitle">Play with a friend online</p>

      <div class="actions">
        <button class="btn btn-primary" (click)="createGame()" [disabled]="loading()">
          {{ loading() ? 'Creating...' : 'Create Game' }}
        </button>

        <div class="divider">or</div>

        <div class="join-section">
          <input
            type="text"
            class="input-code"
            [(ngModel)]="joinCode"
            placeholder="Enter room code"
            maxlength="6"
            (keyup.enter)="joinGame()"
          />
          <button class="btn btn-secondary" (click)="joinGame()" [disabled]="loading() || !joinCode()">
            Join Game
          </button>
        </div>
      </div>

      @if (errorMsg()) {
        <p class="error">{{ errorMsg() }}</p>
      }
    </div>
  `,
  styles: [`
    .home-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .title {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #22d3ee, #fb7185);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: #a3a3a3;
      margin-bottom: 3rem;
      font-size: 1.1rem;
    }
    .actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      width: 100%;
      max-width: 320px;
    }
    .btn {
      width: 100%;
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn:hover:not(:disabled) {
      transform: scale(1.03);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-primary {
      background: #22d3ee;
      color: #0a0a0a;
    }
    .btn-primary:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
    }
    .btn-secondary {
      background: #fb7185;
      color: #0a0a0a;
    }
    .btn-secondary:hover:not(:disabled) {
      box-shadow: 0 0 20px rgba(251, 113, 133, 0.3);
    }
    .divider {
      color: #525252;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .join-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }
    .input-code {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 1px solid #333;
      border-radius: 12px;
      background: #171717;
      color: #e5e5e5;
      font-size: 1.1rem;
      font-family: monospace;
      text-align: center;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      outline: none;
      box-sizing: border-box;
    }
    .input-code:focus {
      border-color: #fb7185;
    }
    .error {
      color: #f87171;
      margin-top: 1rem;
      font-size: 0.875rem;
    }
  `],
})
export class HomeComponent {
  joinCode = signal('');
  loading = signal(false);
  errorMsg = signal('');

  constructor(private gameService: GameService, private router: Router) {}

  async createGame() {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const roomCode = await this.gameService.createGame();
      this.router.navigate(['/game', roomCode]);
    } catch {
      this.errorMsg.set('Failed to create game. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async joinGame() {
    const code = this.joinCode().trim();
    if (!code) return;
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      await this.gameService.joinGame(code);
      this.router.navigate(['/game', code.toUpperCase()]);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'Failed to join game.');
    } finally {
      this.loading.set(false);
    }
  }
}
```

- [ ] **Step 2: Set up routes**

Edit `src/app/app.routes.ts`:
```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'game/:roomCode', loadComponent: () => import('./game/game.component').then(m => m.GameComponent) },
];
```

- [ ] **Step 3: Update app.component.ts**

Edit `src/app/app.component.ts` to just render `<router-outlet>`:
```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/home/home.component.ts src/app/app.routes.ts src/app/app.component.ts
git commit -m "feat: add home component with create/join game UI and routing"
```

---

## Task 7: Frontend — Cell Component with SVG Animations

**Files:**
- Create: `src/app/game/cell/cell.component.ts`

- [ ] **Step 1: Create CellComponent**

Create `src/app/game/cell/cell.component.ts`:
```typescript
import { Component, input, output } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-cell',
  standalone: true,
  animations: [
    trigger('appear', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.5)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
  ],
  template: `
    <div
      class="cell"
      [class.interactive]="interactive()"
      [class.winning]="winning()"
      (click)="interactive() ? cellClick.emit() : null"
    >
      @if (value() === 'X') {
        <svg viewBox="0 0 100 100" class="mark x-mark" @appear>
          <line x1="20" y1="20" x2="80" y2="80" />
          <line x1="80" y1="20" x2="20" y2="80" />
        </svg>
      }
      @if (value() === 'O') {
        <svg viewBox="0 0 100 100" class="mark o-mark" @appear>
          <circle cx="50" cy="50" r="30" />
        </svg>
      }
    </div>
  `,
  styles: [`
    .cell {
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #171717;
      border-radius: 12px;
      cursor: default;
      transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .cell.interactive {
      cursor: pointer;
    }
    .cell.interactive:hover {
      transform: scale(1.05);
      background: #1f1f1f;
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.05);
    }
    .cell.winning {
      box-shadow: 0 0 20px rgba(250, 204, 21, 0.4);
      background: #1a1a0a;
    }
    .mark {
      width: 60%;
      height: 60%;
    }
    .x-mark line {
      stroke: #22d3ee;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 85;
      stroke-dashoffset: 85;
      animation: draw-line 0.3s ease-out forwards;
    }
    .x-mark line:nth-child(2) {
      animation-delay: 0.1s;
    }
    .o-mark circle {
      fill: none;
      stroke: #fb7185;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 189;
      stroke-dashoffset: 189;
      animation: draw-line 0.3s ease-out forwards;
    }
    @keyframes draw-line {
      to { stroke-dashoffset: 0; }
    }
  `],
})
export class CellComponent {
  value = input<'X' | 'O' | null>(null);
  interactive = input(false);
  winning = input(false);
  cellClick = output<void>();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/cell/cell.component.ts
git commit -m "feat: add cell component with SVG draw animations for X and O"
```

---

## Task 8: Frontend — Board Component

**Files:**
- Create: `src/app/game/board/board.component.ts`

- [ ] **Step 1: Create BoardComponent**

Create `src/app/game/board/board.component.ts`:
```typescript
import { Component, input, output } from '@angular/core';
import { CellComponent } from '../cell/cell.component';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CellComponent],
  template: `
    <div class="board">
      @for (cell of board(); track $index) {
        <app-cell
          [value]="cell"
          [interactive]="interactive() && cell === null"
          [winning]="isWinningCell($index)"
          (cellClick)="cellClicked.emit($index)"
        />
      }
    </div>
  `,
  styles: [`
    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      width: 100%;
      max-width: 360px;
      padding: 8px;
      background: #262626;
      border-radius: 16px;
    }
  `],
})
export class BoardComponent {
  board = input<('X' | 'O' | null)[]>(Array(9).fill(null));
  interactive = input(false);
  winLine = input<number[] | null>(null);
  cellClicked = output<number>();

  isWinningCell(index: number): boolean {
    return this.winLine()?.includes(index) ?? false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/board/board.component.ts
git commit -m "feat: add board component with 3x3 grid layout"
```

---

## Task 9: Frontend — Win Line Component

**Files:**
- Create: `src/app/game/win-line/win-line.component.ts`

- [ ] **Step 1: Create WinLineComponent**

Create `src/app/game/win-line/win-line.component.ts`:
```typescript
import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-win-line',
  standalone: true,
  template: `
    @if (coords()) {
      <svg class="win-line-svg" viewBox="0 0 3 3" preserveAspectRatio="xMidYMid meet">
        <line
          [attr.x1]="coords()!.x1"
          [attr.y1]="coords()!.y1"
          [attr.x2]="coords()!.x2"
          [attr.y2]="coords()!.y2"
          stroke="#facc15"
          stroke-width="0.12"
          stroke-linecap="round"
          class="win-stroke"
        />
      </svg>
    }
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .win-line-svg {
      width: 100%;
      height: 100%;
    }
    .win-stroke {
      stroke-dasharray: 4.3;
      stroke-dashoffset: 4.3;
      animation: draw-win 0.5s ease-out 0.2s forwards;
    }
    @keyframes draw-win {
      to { stroke-dashoffset: 0; }
    }
  `],
})
export class WinLineComponent {
  winLine = input<number[] | null>(null);

  coords = computed(() => {
    const line = this.winLine();
    if (!line || line.length !== 3) return null;

    const getCenter = (idx: number) => ({
      x: (idx % 3) + 0.5,
      y: Math.floor(idx / 3) + 0.5,
    });

    const start = getCenter(line[0]);
    const end = getCenter(line[2]);

    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/win-line/win-line.component.ts
git commit -m "feat: add animated SVG win line overlay component"
```

---

## Task 10: Frontend — Confetti Component

**Files:**
- Create: `src/app/game/confetti/confetti.component.ts`

- [ ] **Step 1: Create ConfettiComponent**

Create `src/app/game/confetti/confetti.component.ts`:
```typescript
import { Component, ElementRef, OnInit, OnDestroy, viewChild } from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
}

@Component({
  selector: 'app-confetti',
  standalone: true,
  template: `<canvas #canvas class="confetti-canvas"></canvas>`,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 100;
    }
    .confetti-canvas {
      width: 100%;
      height: 100%;
    }
  `],
})
export class ConfettiComponent implements OnInit, OnDestroy {
  canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private particles: Particle[] = [];
  private animationId: number | null = null;
  private startTime = 0;
  private readonly DURATION = 2500;
  private readonly COLORS = ['#22d3ee', '#fb7185', '#facc15', '#a78bfa', '#34d399'];

  ngOnInit() {
    const el = this.canvas().nativeElement;
    el.width = window.innerWidth;
    el.height = window.innerHeight;
    this.spawnParticles();
    this.startTime = performance.now();
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  private spawnParticles() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      });
    }
  }

  private animate() {
    const elapsed = performance.now() - this.startTime;
    if (elapsed > this.DURATION) return;

    const ctx = this.canvas().nativeElement.getContext('2d')!;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.rotation += p.rotationSpeed;
      p.life = Math.max(0, 1 - elapsed / this.DURATION);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/confetti/confetti.component.ts
git commit -m "feat: add canvas-based confetti burst component"
```

---

## Task 11: Frontend — Game Component (Orchestrator)

**Files:**
- Create: `src/app/game/game.component.ts`

- [ ] **Step 1: Create GameComponent**

Create `src/app/game/game.component.ts`:
```typescript
import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService } from '../services/game.service';
import { BoardComponent } from './board/board.component';
import { WinLineComponent } from './win-line/win-line.component';
import { ConfettiComponent } from './confetti/confetti.component';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [BoardComponent, WinLineComponent, ConfettiComponent],
  template: `
    <div class="game-container">
      <div class="header">
        <h1 class="logo">Tic Tac Toe</h1>

        @if (roomCode()) {
          <div class="room-badge" (click)="copyRoomCode()">
            <span class="room-label">Room</span>
            <span class="room-code">{{ roomCode() }}</span>
            <span class="copy-hint">{{ copied() ? 'Copied!' : 'Click to copy' }}</span>
          </div>
        }
      </div>

      <div class="status-bar">
        @if (connectionLost()) {
          <span class="status-text error">Connection lost. Reconnecting...</span>
        } @else if (gameState()?.status === 'waiting') {
          <span class="status-text waiting">Waiting for opponent<span class="dots"></span></span>
        } @else if (gameState()?.status === 'won') {
          <span class="status-text won">
            {{ gameState()?.winner === myPlayer() ? 'You win!' : 'You lose!' }}
          </span>
        } @else if (gameState()?.status === 'draw') {
          <span class="status-text draw">It's a draw!</span>
        } @else if (isMyTurn()) {
          <span class="status-text your-turn">Your turn</span>
        } @else {
          <span class="status-text opponent-turn">Opponent's turn<span class="dots"></span></span>
        }
      </div>

      <div class="player-indicators">
        <div class="player" [class.active]="gameState()?.currentTurn === 'X'" [class.you]="myPlayer() === 'X'">
          <span class="player-mark x">X</span>
          <span class="player-label">{{ myPlayer() === 'X' ? 'You' : 'Opponent' }}</span>
        </div>
        <div class="player" [class.active]="gameState()?.currentTurn === 'O'" [class.you]="myPlayer() === 'O'">
          <span class="player-mark o">O</span>
          <span class="player-label">{{ myPlayer() === 'O' ? 'You' : 'Opponent' }}</span>
        </div>
      </div>

      <div class="board-wrapper">
        <app-board
          [board]="gameState()?.board ?? emptyBoard"
          [interactive]="isMyTurn()"
          [winLine]="gameState()?.winLine ?? null"
          (cellClicked)="onCellClick($event)"
        />
        <app-win-line [winLine]="gameState()?.winLine ?? null" />
      </div>

      @if (gameState()?.status === 'won' || gameState()?.status === 'draw') {
        <button class="btn btn-primary play-again" (click)="playAgain()">Play Again</button>
        <app-confetti />
      }
    </div>
  `,
  styles: [`
    .game-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 2rem;
      gap: 1.5rem;
    }
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #e5e5e5;
    }
    .room-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #171717;
      border: 1px solid #333;
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .room-badge:hover {
      border-color: #525252;
    }
    .room-label {
      font-size: 0.75rem;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .room-code {
      font-family: monospace;
      font-size: 1.1rem;
      font-weight: 700;
      color: #e5e5e5;
      letter-spacing: 0.15em;
    }
    .copy-hint {
      font-size: 0.7rem;
      color: #525252;
    }
    .status-bar {
      min-height: 2rem;
      display: flex;
      align-items: center;
    }
    .status-text {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .status-text.your-turn { color: #22d3ee; }
    .status-text.opponent-turn { color: #a3a3a3; }
    .status-text.won { color: #facc15; font-size: 1.5rem; }
    .status-text.draw { color: #a78bfa; font-size: 1.5rem; }
    .status-text.waiting { color: #a3a3a3; }
    .status-text.error { color: #f87171; }
    .dots::after {
      content: '';
      animation: dots 1.5s infinite;
    }
    @keyframes dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
    }
    .player-indicators {
      display: flex;
      gap: 2rem;
    }
    .player {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      border: 1px solid #262626;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    .player.active {
      border-color: #404040;
    }
    .player.active.you {
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.05);
      animation: pulse 2s infinite;
    }
    .player-mark {
      font-size: 1.2rem;
      font-weight: 700;
    }
    .player-mark.x { color: #22d3ee; }
    .player-mark.o { color: #fb7185; }
    .player-label {
      font-size: 0.85rem;
      color: #a3a3a3;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .board-wrapper {
      position: relative;
    }
    .play-again {
      padding: 0.875rem 2rem;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      background: #22d3ee;
      color: #0a0a0a;
    }
    .play-again:hover {
      transform: scale(1.03);
      box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
    }
    .btn-primary { background: #22d3ee; color: #0a0a0a; }
  `],
})
export class GameComponent implements OnInit, OnDestroy {
  emptyBoard: (null)[] = Array(9).fill(null);
  copied = signal(false);

  gameState = this.gameService.gameState;
  roomCode = this.gameService.roomCode;
  myPlayer = this.gameService.myPlayer;
  isMyTurn = this.gameService.isMyTurn;
  connectionLost = this.gameService.connectionLost;

  constructor(
    private gameService: GameService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    // If user navigated directly (e.g. refresh), we can't recover the token.
    // Redirect to home.
    if (!this.gameService.roomCode()) {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy() {
    this.gameService.stopPolling();
  }

  async onCellClick(position: number) {
    await this.gameService.makeMove(position);
  }

  async copyRoomCode() {
    const code = this.roomCode();
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async playAgain() {
    this.gameService.reset();
    const roomCode = await this.gameService.createGame();
    this.router.navigate(['/game', roomCode]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/game.component.ts
git commit -m "feat: add game component with polling, status display, and play-again flow"
```

---

## Task 12: Global Styles (Dark Theme)

**Files:**
- Modify: `src/styles.css`, `src/index.html`

- [ ] **Step 1: Set global dark theme styles**

Replace contents of `src/styles.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #0a0a0a;
  color: #e5e5e5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 2: Update index.html meta**

Ensure `src/index.html` has the dark color scheme meta tag in `<head>`:
```html
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0a0a0a">
```

- [ ] **Step 3: Commit**

```bash
git add src/styles.css src/index.html
git commit -m "feat: add global dark theme styles"
```

---

## Task 13: Verify Build + Local Dev

- [ ] **Step 1: Verify Angular build succeeds**

```bash
npx ng build
```

Expected: Build succeeds.

- [ ] **Step 2: Fix any TypeScript/compilation errors**

Address any errors surfaced by the build.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues"
```

---

## Task 14: Deploy to Vercel + Provision Upstash Redis

- [ ] **Step 1: Link Vercel project**

```bash
vercel link
```

Follow prompts to create/link the project.

- [ ] **Step 2: Install Upstash Redis via Marketplace**

```bash
vercel integration add upstash
```

This provisions `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables.

- [ ] **Step 3: Pull env vars for local dev**

```bash
vercel env pull
```

- [ ] **Step 4: Deploy preview**

```bash
vercel
```

Expected: Deployment succeeds, preview URL returned.

- [ ] **Step 5: Test multiplayer in two browser tabs**

1. Open the preview URL in tab 1 → click "Create Game" → note the room code.
2. Open the preview URL in tab 2 → enter room code → click "Join Game."
3. Play a full game, verify moves sync, win detection works, confetti fires.

- [ ] **Step 6: Deploy to production**

```bash
vercel --prod
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: configure Vercel deployment with Upstash Redis"
```
