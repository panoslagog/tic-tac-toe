# Multi-Game Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Tic-Tac-Toe app into a multi-game platform supporting both Tic-Tac-Toe and competitive Hangman.

**Architecture:** Discriminated union on `type` field in game state. Existing tic-tac-toe logic stays in `game-logic.ts`, new hangman logic in `hangman-logic.ts`. API endpoints branch on game type. Frontend splits into `/game/tictactoe/:roomCode` and `/game/hangman/:roomCode` with a shared `GameService`.

**Tech Stack:** Angular 21, Vercel Functions, Upstash Redis, TypeScript, Vitest

---

## File Map

### Backend — Modified
- `api/_lib/types.ts` — Refactor into discriminated union types
- `api/_lib/game-logic.ts` — Rename `createInitialState` → `createTicTacToeState`, update `toPublicState` to add `type`, add `getPlayerByToken` to work with base type
- `api/_lib/redis.ts` — Update type imports for union type
- `api/game/index.ts` — Accept `{ type, language? }`, branch on type
- `api/game/[id]/index.ts` — Branch `toPublicState` by game type
- `api/game/[id]/join.ts` — Return `type` in response
- `api/game/[id]/move.ts` — Branch move handling by game type
- `api/game/[id]/rematch.ts` — Branch rematch by game type

### Backend — New
- `api/_lib/hangman-logic.ts` — Hangman game logic (word selection, guessing, masking, win detection)
- `api/_lib/words/en.json` — English word list
- `api/_lib/words/el.json` — Greek word list
- `api/_tests/hangman-logic.test.ts` — Hangman logic tests

### Frontend — Modified
- `src/app/app.routes.ts` — Split routes by game type
- `src/app/home/home.component.ts` — Add game-type toggle + language selector
- `src/app/services/game.service.ts` — Generalize for both game types

### Frontend — Moved (rename only)
- `src/app/game/game.component.ts` → `src/app/game/tictactoe/tictactoe-game.component.ts`
- Sub-components (`board/`, `cell/`, `win-line/`, `confetti/`) stay under `src/app/game/` as shared or moved into `tictactoe/`

### Frontend — New
- `src/app/game/hangman/hangman-game.component.ts` — Hangman game wrapper
- `src/app/game/hangman/gallows/gallows.component.ts` — SVG hangman figure
- `src/app/game/hangman/word-display/word-display.component.ts` — Masked word slots
- `src/app/game/hangman/keyboard/keyboard.component.ts` — Clickable letter grid
- `src/app/game/hangman/word-guess/word-guess.component.ts` — Full word guess input
- `src/app/game/hangman/opponent-status/opponent-status.component.ts` — Opponent lives display

---

## Phase 1 — Backend: Type-Aware Game State

### Task 1: Refactor types to discriminated union

**Files:**
- Modify: `api/_lib/types.ts`

- [ ] **Step 1: Write the new types**

Replace the entire contents of `api/_lib/types.ts` with:

```typescript
export type Player = 'X' | 'O';
export type GameType = 'tictactoe' | 'hangman';

// --- Base ---

interface BaseGameState {
  type: GameType;
  players: { X: string | null; O: string | null };
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
  playerState: {
    X: HangmanPlayerState;
    O: HangmanPlayerState;
  };
}

export interface HangmanPublicState {
  type: 'hangman';
  language: 'en' | 'el';
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc -p api/tsconfig.json --noEmit 2>&1 | head -30`

Expected: Type errors in files that still reference old `GameState` shape (that's OK, we fix them next).

### Task 2: Update game-logic.ts for type-aware state

**Files:**
- Modify: `api/_lib/game-logic.ts`

- [ ] **Step 1: Update imports and function signatures**

Replace the entire contents of `api/_lib/game-logic.ts` with:

```typescript
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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
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
```

- [ ] **Step 2: Update existing tests**

Replace the contents of `api/_tests/game-logic.test.ts` with:

```typescript
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
  it('returns a 6-character alphanumeric string', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
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
```

- [ ] **Step 3: Run tests**

Run: `npm run test:api`
Expected: All 15 tests pass.

- [ ] **Step 4: Commit**

```bash
git add api/_lib/types.ts api/_lib/game-logic.ts api/_tests/game-logic.test.ts
git commit -m "refactor: convert game state to discriminated union with type field"
```

### Task 3: Update redis.ts type reference

**Files:**
- Modify: `api/_lib/redis.ts`

- [ ] **Step 1: Update redis.ts**

Replace contents of `api/_lib/redis.ts` with:

```typescript
import { Redis } from '@upstash/redis';
import type { GameState } from './types.js';

export const redis = Redis.fromEnv();

const GAME_TTL = 3600; // 1 hour

export async function getGame(roomCode: string): Promise<GameState | null> {
  const data = await redis.get<GameState>(`game:${roomCode}`);
  return data;
}

export async function setGame(roomCode: string, state: GameState): Promise<void> {
  await redis.set(`game:${roomCode}`, state, { ex: GAME_TTL });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/_lib/redis.ts
git commit -m "refactor: use explicit type import in redis.ts"
```

### Task 4: Update API endpoints for type-aware state

**Files:**
- Modify: `api/game/index.ts`
- Modify: `api/game/[id]/index.ts`
- Modify: `api/game/[id]/join.ts`
- Modify: `api/game/[id]/move.ts`
- Modify: `api/game/[id]/rematch.ts`

- [ ] **Step 1: Update create endpoint**

Replace contents of `api/game/index.ts` with:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../_lib/redis.js';
import { createTicTacToeState, generateRoomCode } from '../_lib/game-logic.js';
import type { CreateGameResponse } from '../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type = 'tictactoe' } = req.body as { type?: string };

  if (type !== 'tictactoe') {
    return res.status(400).json({ error: `Unknown game type: ${type}` });
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
  const state = createTicTacToeState(playerToken);
  await setGame(roomCode, state);

  const response: CreateGameResponse = {
    roomCode,
    playerToken,
    player: 'X',
  };
  return res.status(201).json(response);
}
```

Note: Only `tictactoe` is accepted now. Hangman support is added in Phase 2.

- [ ] **Step 2: Update GET state endpoint**

Replace contents of `api/game/[id]/index.ts` with:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame } from '../../_lib/redis.js';
import { getPlayerByToken, toTicTacToePublicState } from '../../_lib/game-logic.js';

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

  if (state.type === 'tictactoe') {
    return res.status(200).json(toTicTacToePublicState(state, playerToken ?? null));
  }

  // Hangman public state will be added in Phase 2
  return res.status(400).json({ error: `Unknown game type: ${state.type}` });
}
```

- [ ] **Step 3: Update join endpoint to return type**

Replace contents of `api/game/[id]/join.ts` with:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../../_lib/redis.js';
import type { JoinGameResponse } from '../../_lib/types.js';

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
    type: state.type,
  };
  return res.status(200).json(response);
}
```

- [ ] **Step 4: Update move endpoint**

Replace contents of `api/game/[id]/move.ts` with:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { validateMove, checkWinner, isDraw, getPlayerByToken, toTicTacToePublicState } from '../../_lib/game-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (state.type === 'tictactoe') {
    const { position } = req.body as { position: number };

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
    return res.status(200).json(toTicTacToePublicState(state, playerToken));
  }

  // Hangman move handling will be added in Phase 2
  return res.status(400).json({ error: `Unknown game type: ${state.type}` });
}
```

- [ ] **Step 5: Update rematch endpoint**

Replace contents of `api/game/[id]/rematch.ts` with:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { getPlayerByToken } from '../../_lib/game-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const player = getPlayerByToken(state, playerToken);
  if (!player) {
    return res.status(403).json({ error: 'Not a player in this game' });
  }

  if (state.status !== 'won' && state.status !== 'draw') {
    return res.status(400).json({ error: 'Game is still in progress' });
  }

  if (state.type === 'tictactoe') {
    state.board = Array(9).fill(null);
    state.currentTurn = state.currentTurn === 'X' ? 'O' : 'X';
    state.status = 'playing';
    state.winner = null;
    state.winLine = null;
    state.lastActivity = Date.now();

    await setGame(roomCode, state);
    return res.status(200).json({ ok: true });
  }

  // Hangman rematch will be added in Phase 2
  return res.status(400).json({ error: `Unknown game type: ${state.type}` });
}
```

- [ ] **Step 6: Run tests and build**

Run: `npm run test:api && npx ng build`
Expected: All 15 tests pass, Angular build succeeds.

- [ ] **Step 7: Commit and push**

```bash
git add api/
git commit -m "refactor: make all API endpoints type-aware for multi-game support"
git push
```

Tic-Tac-Toe should be fully functional after this deploy.

---

## Phase 2 — Backend: Hangman Game Logic + Word Lists

### Task 5: Create word lists

**Files:**
- Create: `api/_lib/words/en.json`
- Create: `api/_lib/words/el.json`

- [ ] **Step 1: Create English word list**

Create `api/_lib/words/en.json` with ~200 common English nouns (4-10 chars, uppercase). Example subset:

```json
["APPLE","BEACH","BRAIN","BREAD","BRICK","BRUSH","CANDY","CHAIR","CHALK","CHASE","CHESS","CLIFF","CLOCK","CLOUD","COACH","CORAL","COUCH","CRANE","CREAM","CROWN","DANCE","DREAM","EARTH","FENCE","FLAME","FLASK","FLOAT","GLOBE","GRAPE","GRASS","GUARD","HEART","HOUSE","IMAGE","JUICE","KNIFE","LEMON","LIGHT","MAPLE","MATCH","MEDAL","MELON","MONEY","MOOSE","MOUSE","MUSIC","NIGHT","OCEAN","PAINT","PEARL","PHONE","PIANO","PLANT","PRIZE","QUEEN","RADIO","RIVER","ROBOT","SHARK","SHELL","SHIRT","SKATE","SLEEP","SMILE","SMOKE","SNAKE","SPACE","STAMP","STEAM","STONE","STORM","STOVE","SUGAR","SWORD","TABLE","TIGER","TOAST","TOWER","TRAIN","TRUCK","VOICE","WATER","WHEAT","WHEEL","WORLD","YACHT","ZEBRA","ALBUM","ARMOR","BADGE","BASIN","BERRY","BLOOM","BOARD","BOOTS","CABIN","CAMEL","CARGO","CEDAR","CHAIN","CHARM","CHEST","CIGAR","CIVIC","CORAL","COMET","COVER","CROWD","DAIRY","DELTA","DEMON","DIARY","DIVER","DONOR","EAGLE","ELBOW","EVENT","FAIRY","FEAST","FIBER","FLESH","FLUTE","FORGE","FROST","FRUIT","GIANT","GOOSE","GRAIN","GUIDE","HAVEN","IVORY","JEWEL","JOINT","KARMA","KNEEL","LABEL","LASER","LLAMA","LOGIC","LUNAR","MAGIC","MANOR","MARSH","MINER","MOCHA","NERVE","NEXUS","NOBLE","OLIVE","OMEGA","ORBIT","ORGAN","OTTER","PANEL","PASTA","PEACH","PENNY","PHASE","PILOT","PIXEL","PLUMB","POLAR","POUCH","PRIDE","PROOF","PUPIL","QUOTA","RADAR","RANCH","REIGN","RIDGE","RIVAL","ROYAL","SAINT","SALON","SATIN","SCARF","SCOUT","SHADE","SIEGE","SIREN","SKULL","SLOTH","SOLAR","SPINE","SPOON","SQUAD","STAGE","STAFF","STAIR","STEEL","STRAW","SWAMP","SWIRL","THUMB","TORCH","TRAIL","TRIBE","TROUT","TULIP","ULTRA","UMBRA","UNION","VALVE","VAULT","VIGOR","VIOLA","VIVID","VOWEL","WRIST","YACHT"]
```

- [ ] **Step 2: Create Greek word list**

Create `api/_lib/words/el.json` with ~200 common Greek nouns (4-10 chars, uppercase, no accents):

```json
["ΜΗΛΟ","ΝΕΡΟ","ΣΠΙΤΙ","ΔΡΟΜΟΣ","ΠΟΡΤΑ","ΒΙΒΛΙΟ","ΔΕΝΤΡΟ","ΦΩΤΙΑ","ΘΑΛΑΣΣΑ","ΗΛΙΟΣ","ΑΣΤΕΡΙ","ΒΟΥΝΟ","ΠΟΤΑΜΙ","ΓΕΦΥΡΑ","ΚΑΣΤΡΟ","ΠΥΡΓΟΣ","ΚΗΠΟΣ","ΛΟΥΛΟΥΔΙ","ΠΕΤΡΑ","ΑΜΜΟΣ","ΧΙΟΝΙ","ΒΡΟΧΗ","ΑΝΕΜΟΣ","ΣΥΝΝΕΦΟ","ΦΕΓΓΑΡΙ","ΚΥΜΑ","ΝΗΣΙ","ΛΙΜΑΝΙ","ΠΛΟΙΟ","ΚΑΡΑΒΙ","ΨΑΡΙ","ΠΟΥΛΙ","ΣΚΥΛΟΣ","ΓΑΤΑ","ΑΛΟΓΟ","ΛΙΟΝΤΑΡΙ","ΑΡΚΟΥΔΑ","ΛΥΚΟΣ","ΑΕΤΟΣ","ΔΕΛΦΙΝΙ","ΧΕΛΩΝΑ","ΠΕΤΑΛΟΥΔΑ","ΜΕΛΙΣΣΑ","ΤΡΙΑΝΤΑΦΥΛΛΟ","ΚΡΙΝΟΣ","ΣΤΑΦΥΛΙ","ΠΟΡΤΟΚΑΛΙ","ΚΕΡΑΣΙ","ΡΟΔΑΚΙΝΟ","ΑΧΛΑΔΙ","ΚΑΡΠΟΥΖΙ","ΠΕΠΟΝΙ","ΦΡΑΟΥΛΑ","ΜΠΑΝΑΝΑ","ΕΛΙΑ","ΝΤΟΜΑΤΑ","ΠΑΤΑΤΑ","ΚΡΕΜΜΥΔΙ","ΣΚΟΡΔΟ","ΜΑΡΟΥΛΙ","ΚΑΡΟΤΟ","ΨΩΜΙ","ΤΥΡΙ","ΓΑΛΑ","ΜΕΛΙ","ΚΡΕΑΣ","ΑΥΓΟ","ΑΛΑΤΙ","ΠΙΠΕΡΙ","ΖΑ��ΑΡΗ","ΛΑΔΙ","ΚΡΑΣΙ","ΜΠΥΡΑ","ΚΑΦΕΣ","ΤΣΑΙ","ΧΥΜΟΣ","ΠΑΓΩΤΟ","ΤΟΥΡΤΑ","ΜΠΙΣΚΟΤΟ","ΣΟΚΟΛΑΤΑ","ΚΑΡΕΚΛΑ","ΤΡΑΠΕΖΙ","ΚΡΕΒΑΤΙ","ΚΑΝΑΠΕΣ","ΝΤΟΥΛΑΠΑ","ΚΑΘΡΕΦΤΗΣ","ΚΟΥΡΤΙΝΑ","ΧΑΛΙ","ΣΚΑΛΑ","ΚΛΕΙΔΙ","ΚΟΥΔΟΥΝΙ","ΚΕΡΙ","ΟΜΠΡΕΛΑ","ΤΣΑΝΤΑ","ΚΑΠΕΛΟ","ΠΑΠΟΥΤΣΙ","ΦΟΡΕΜΑ","ΚΟΣΜΗΜΑ","ΔΑΧΤΥΛΙΔΙ","ΒΡΑΧΙΟΛΙ","ΡΟΛΟΙ","ΚΙΘΑΡΑ","ΠΙΑΝΟ","ΒΙΟΛΙ","ΤΥΜΠΑΝΟ","ΦΛΑΟΥΤΟ","ΜΟΛΥΒΙ","ΧΑΡΤΙ","ΣΧΟΛΕΙΟ","ΔΑΣΚΑΛΟΣ","ΜΑΘΗΤΗΣ","ΓΙΑΤΡΟΣ","ΔΙΚΗΓΟΡΟΣ","ΜΑΓΕΙΡΑΣ","ΖΩΓΡΑΦΟΣ","ΑΣΤΥΝΟΜΙΚΟΣ","ΣΤΡΑΤΙΩΤΗΣ","ΝΑΥΤΗΣ","ΠΙΛΟΤΟΣ","ΑΘΛΗΤΗΣ","ΗΘΟΠΟΙΟΣ","ΤΡΑΓΟΥΔΙ","ΧΟΡΟΣ","ΘΕΑΤΡΟ","ΣΙΝΕΜΑ","ΜΟΥΣΕΙΟ","ΕΚΚΛΗΣΙΑ","ΠΛΑΤΕΙΑ","ΠΑΡΚΟ","ΓΗΠΕΔΟ","ΣΤΡΑΤΟΠΕΔΟ","ΑΕΡΟΔΡΟΜΙΟ","ΝΟΣΟΚΟΜΕΙΟ","ΦΑΡΜΑΚΕΙΟ","ΒΙΒΛΙΟΘΗΚΗ","ΤΑΧΥΔΡΟΜΕΙΟ","ΤΡΑΠΕΖΑ","ΑΓΟΡΑ","ΚΑΤΑΣΤΗΜΑ","ΕΣΤΙΑΤΟΡΙΟ","ΞΕΝΟΔΟΧΕΙΟ","ΣΤΑΘΜΟΣ","ΓΡΑΦΕΙΟ","ΕΡΓΟΣΤΑΣΙΟ","ΠΑΝΕΠΙΣΤΗΜΙΟ"]
```

- [ ] **Step 3: Commit**

```bash
git add api/_lib/words/
git commit -m "feat: add English and Greek word lists for hangman"
```

### Task 6: Write hangman game logic

**Files:**
- Create: `api/_lib/hangman-logic.ts`
- Create: `api/_tests/hangman-logic.test.ts`

- [ ] **Step 1: Write the hangman logic tests**

Create `api/_tests/hangman-logic.test.ts`:

```typescript
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
    // Greek uppercase range
    expect(word).toMatch(/^[\u0391-\u03A9]+$/);
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
    const state = createHangmanState('token-x', 'en');
    state.players.O = 'token-o';
    state.status = 'playing';
    // Override word for testing
    (state as any).word = 'HELLO';

    const result = processLetterGuess(state, 'X', 'H');
    expect(result).toBe('correct');
    expect(state.playerState.X.guessedLetters).toContain('H');
    expect(state.playerState.X.wrongGuesses).not.toContain('H');
    expect(state.playerState.X.lives).toBe(6);
  });

  it('penalizes wrong letter with 1 life', () => {
    const state = createHangmanState('token-x', 'en');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    const result = processLetterGuess(state, 'X', 'Z');
    expect(result).toBe('wrong');
    expect(state.playerState.X.wrongGuesses).toContain('Z');
    expect(state.playerState.X.lives).toBe(5);
  });

  it('ignores already-guessed letter', () => {
    const state = createHangmanState('token-x', 'en');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    processLetterGuess(state, 'X', 'H');
    const result = processLetterGuess(state, 'X', 'H');
    expect(result).toBe('already-guessed');
    expect(state.playerState.X.lives).toBe(6);
  });

  it('marks player as solved when all letters revealed', () => {
    const state = createHangmanState('token-x', 'en');
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
    const state = createHangmanState('token-x', 'en');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';

    const result = processWordGuess(state, 'X', 'HELLO');
    expect(result).toBe('correct');
    expect(state.playerState.X.solved).toBe(true);
    expect(state.playerState.X.lives).toBe(6);
  });

  it('penalizes wrong word guess with 2 lives', () => {
    const state = createHangmanState('token-x', 'en');
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
    const state = createHangmanState('token-x', 'en');
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
    const state = createHangmanState('token-x', 'en');
    state.players.O = 'token-o';
    state.status = 'draw';
    (state as any).word = 'HELLO';

    const pub = toHangmanPublicState(state, 'token-x');
    expect(pub.revealedWord).toBe('HELLO');
  });

  it('shows opponent lives but not their letters', () => {
    const state = createHangmanState('token-x', 'en');
    state.players.O = 'token-o';
    state.status = 'playing';
    (state as any).word = 'HELLO';
    state.playerState.O.lives = 3;
    state.playerState.O.guessedLetters = ['A', 'B', 'C'];

    const pub = toHangmanPublicState(state, 'token-x');
    expect(pub.opponentLives).toBe(3);
    // pub should NOT contain opponent's guessed letters
    expect(pub.guessedLetters).toEqual([]); // X hasn't guessed anything
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:api`
Expected: FAIL — module `../_lib/hangman-logic` not found.

- [ ] **Step 3: Write the hangman logic implementation**

Create `api/_lib/hangman-logic.ts`:

```typescript
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
    // Both solved — tiebreak by timestamp
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
  // Otherwise game continues (one or both still alive and guessing)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:api`
Expected: All tests pass (existing tic-tac-toe + new hangman tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/hangman-logic.ts api/_tests/hangman-logic.test.ts
git commit -m "feat: add hangman game logic with word selection, guessing, and win detection"
```

### Task 7: Wire hangman into API endpoints

**Files:**
- Modify: `api/game/index.ts`
- Modify: `api/game/[id]/index.ts`
- Modify: `api/game/[id]/move.ts`
- Modify: `api/game/[id]/rematch.ts`

- [ ] **Step 1: Update create endpoint to support hangman**

In `api/game/index.ts`, replace the type validation and state creation block. Full file:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../_lib/redis.js';
import { createTicTacToeState, generateRoomCode } from '../_lib/game-logic.js';
import { createHangmanState } from '../_lib/hangman-logic.js';
import type { CreateGameResponse, GameType } from '../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type = 'tictactoe', language } = req.body as { type?: string; language?: string };

  if (type !== 'tictactoe' && type !== 'hangman') {
    return res.status(400).json({ error: `Unknown game type: ${type}` });
  }

  if (type === 'hangman' && language !== 'en' && language !== 'el') {
    return res.status(400).json({ error: 'Language must be "en" or "el"' });
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
  const state = type === 'hangman'
    ? createHangmanState(playerToken, language as 'en' | 'el')
    : createTicTacToeState(playerToken);
  await setGame(roomCode, state);

  const response: CreateGameResponse = {
    roomCode,
    playerToken,
    player: 'X',
  };
  return res.status(201).json(response);
}
```

- [ ] **Step 2: Update GET state endpoint for hangman**

Replace `api/game/[id]/index.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame } from '../../_lib/redis.js';
import { toTicTacToePublicState } from '../../_lib/game-logic.js';
import { toHangmanPublicState } from '../../_lib/hangman-logic.js';

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

  if (state.type === 'tictactoe') {
    return res.status(200).json(toTicTacToePublicState(state, playerToken ?? null));
  }

  if (state.type === 'hangman') {
    return res.status(200).json(toHangmanPublicState(state, playerToken ?? null));
  }

  return res.status(400).json({ error: `Unknown game type` });
}
```

- [ ] **Step 3: Update move endpoint for hangman**

Replace `api/game/[id]/move.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { validateMove, checkWinner, isDraw, getPlayerByToken, toTicTacToePublicState } from '../../_lib/game-logic.js';
import { normalizeInput, processLetterGuess, processWordGuess, resolveHangmanOutcome, toHangmanPublicState } from '../../_lib/hangman-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (state.status !== 'playing') {
    return res.status(400).json({ error: 'Game is not in progress' });
  }

  const player = getPlayerByToken(state, playerToken);
  if (!player) {
    return res.status(403).json({ error: 'Not a player in this game' });
  }

  if (state.type === 'tictactoe') {
    const { position } = req.body as { position: number };

    const error = validateMove(state, position, playerToken);
    if (error) {
      const statusCode = error === 'Not a player in this game' ? 403
        : error === 'Not your turn' ? 403
        : 400;
      return res.status(statusCode).json({ error });
    }

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
    return res.status(200).json(toTicTacToePublicState(state, playerToken));
  }

  if (state.type === 'hangman') {
    const body = req.body as { letter?: string; word?: string };

    if (state.playerState[player].lives <= 0) {
      return res.status(400).json({ error: 'No lives remaining' });
    }

    if (state.playerState[player].solved) {
      return res.status(400).json({ error: 'Already solved' });
    }

    let result: string;
    if (body.word) {
      const normalized = normalizeInput(body.word);
      result = processWordGuess(state, player, normalized);
    } else if (body.letter) {
      const normalized = normalizeInput(body.letter);
      if (normalized.length !== 1) {
        return res.status(400).json({ error: 'Letter must be a single character' });
      }
      result = processLetterGuess(state, player, normalized);
    } else {
      return res.status(400).json({ error: 'Must provide letter or word' });
    }

    state.lastActivity = Date.now();
    resolveHangmanOutcome(state);
    await setGame(roomCode, state);

    return res.status(200).json({
      result,
      ...toHangmanPublicState(state, playerToken),
    });
  }

  return res.status(400).json({ error: 'Unknown game type' });
}
```

- [ ] **Step 4: Update rematch endpoint for hangman**

Replace `api/game/[id]/rematch.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { getPlayerByToken } from '../../_lib/game-logic.js';
import { pickRandomWord } from '../../_lib/hangman-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const player = getPlayerByToken(state, playerToken);
  if (!player) {
    return res.status(403).json({ error: 'Not a player in this game' });
  }

  if (state.status !== 'won' && state.status !== 'draw') {
    return res.status(400).json({ error: 'Game is still in progress' });
  }

  if (state.type === 'tictactoe') {
    state.board = Array(9).fill(null);
    state.currentTurn = state.currentTurn === 'X' ? 'O' : 'X';
    state.status = 'playing';
    state.winner = null;
    state.winLine = null;
    state.lastActivity = Date.now();
    await setGame(roomCode, state);
    return res.status(200).json({ ok: true });
  }

  if (state.type === 'hangman') {
    state.word = pickRandomWord(state.language);
    state.status = 'playing';
    state.winner = null;
    state.lastActivity = Date.now();
    state.playerState = {
      X: { guessedLetters: [], wrongGuesses: [], lives: 6, solved: false, solvedAt: null },
      O: { guessedLetters: [], wrongGuesses: [], lives: 6, solved: false, solvedAt: null },
    };
    await setGame(roomCode, state);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown game type' });
}
```

- [ ] **Step 5: Run all tests and build**

Run: `npm run test:api && npx ng build`
Expected: All tests pass, Angular build succeeds.

- [ ] **Step 6: Commit and push**

```bash
git add api/
git commit -m "feat: wire hangman game logic into all API endpoints"
git push
```

---

## Phase 3 — Frontend: Routing + Home Page + Service Updates

### Task 8: Restructure game component and update routes

**Files:**
- Move: `src/app/game/game.component.ts` → `src/app/game/tictactoe/tictactoe-game.component.ts`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Create tictactoe directory and move component**

```bash
mkdir -p src/app/game/tictactoe
mv src/app/game/game.component.ts src/app/game/tictactoe/tictactoe-game.component.ts
```

- [ ] **Step 2: Update the moved component**

In `src/app/game/tictactoe/tictactoe-game.component.ts`:

- Change the class name from `GameComponent` to `TicTacToeGameComponent`
- Change the selector from `app-game` to `app-tictactoe-game`
- Update the import paths for sub-components (add `../` prefix since we're one level deeper):

```typescript
import { BoardComponent } from '../board/board.component';
import { WinLineComponent } from '../win-line/win-line.component';
import { ConfettiComponent } from '../confetti/confetti.component';
```

And update the service import:

```typescript
import { GameService } from '../../services/game.service';
```

- [ ] **Step 3: Update routes**

Replace contents of `src/app/app.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'game/tictactoe/:roomCode', loadComponent: () => import('./game/tictactoe/tictactoe-game.component').then(m => m.TicTacToeGameComponent) },
  { path: 'game/hangman/:roomCode', loadComponent: () => import('./game/hangman/hangman-game.component').then(m => m.HangmanGameComponent) },
];
```

Note: The hangman component doesn't exist yet — it will be a placeholder until Phase 4.

- [ ] **Step 4: Create placeholder hangman component**

Create `src/app/game/hangman/hangman-game.component.ts`:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-hangman-game',
  standalone: true,
  template: `<div class="placeholder"><h1>Hangman</h1><p>Coming soon...</p></div>`,
  styles: [`.placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; color: #e5e5e5; }`],
})
export class HangmanGameComponent {}
```

- [ ] **Step 5: Build and verify**

Run: `npx ng build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/
git commit -m "refactor: restructure routes for multi-game support"
```

### Task 9: Update GameService for multi-game support

**Files:**
- Modify: `src/app/services/game.service.ts`

- [ ] **Step 1: Update the service**

Replace contents of `src/app/services/game.service.ts`:

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Player = 'X' | 'O';
export type GameType = 'tictactoe' | 'hangman';

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

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    let h = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (this.playerToken()) {
      h = h.set('X-Player-Token', this.playerToken()!);
    }
    return h;
  }

  async createGame(type: GameType = 'tictactoe', language?: 'en' | 'el'): Promise<{ roomCode: string; type: GameType }> {
    const body: Record<string, string> = { type };
    if (language) body['language'] = language;

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
```

- [ ] **Step 2: Update TicTacToeGameComponent to use new service API**

In `src/app/game/tictactoe/tictactoe-game.component.ts`, update the `onCellClick` method:

```typescript
async onCellClick(position: number) {
  await this.gameService.makeMove({ position });
}
```

And update the `ngOnInit` to check for the right route:

```typescript
ngOnInit() {
  if (!this.gameService.roomCode()) {
    this.router.navigate(['/']);
  }
}
```

- [ ] **Step 3: Build and verify**

Run: `npx ng build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/services/game.service.ts src/app/game/tictactoe/tictactoe-game.component.ts
git commit -m "refactor: generalize GameService for multi-game support"
```

### Task 10: Update home component with game-type picker

**Files:**
- Modify: `src/app/home/home.component.ts`

- [ ] **Step 1: Update the home component**

Replace contents of `src/app/home/home.component.ts`:

```typescript
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GameService, GameType } from '../services/game.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="home-container">
      <h1 class="title">Game Room</h1>
      <p class="subtitle">Play with a friend online</p>

      <div class="actions">
        <div class="game-type-picker">
          <button
            class="type-btn"
            [class.active]="selectedType() === 'tictactoe'"
            (click)="selectedType.set('tictactoe')"
          >Tic Tac Toe</button>
          <button
            class="type-btn"
            [class.active]="selectedType() === 'hangman'"
            (click)="selectedType.set('hangman')"
          >Hangman</button>
        </div>

        @if (selectedType() === 'hangman') {
          <div class="language-picker">
            <button
              class="lang-btn"
              [class.active]="selectedLanguage() === 'en'"
              (click)="selectedLanguage.set('en')"
            >English</button>
            <button
              class="lang-btn"
              [class.active]="selectedLanguage() === 'el'"
              (click)="selectedLanguage.set('el')"
            >Greek</button>
          </div>
        }

        <button class="btn btn-primary" (click)="createGame()" [disabled]="loading()">
          {{ loading() ? 'Creating...' : 'Create Game' }}
        </button>

        <div class="divider">or</div>

        <div class="join-section">
          <input
            type="text"
            class="input-code"
            [ngModel]="joinCode"
            (ngModelChange)="joinCode = $event"
            placeholder="Enter room code"
            maxlength="6"
            (keyup.enter)="joinGame()"
          />
          <button class="btn btn-secondary" (click)="joinGame()" [disabled]="loading() || !joinCode">
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
      font-size: clamp(2rem, 8vw, 3rem);
      font-weight: 700;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #22d3ee, #fb7185);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-align: center;
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
    .game-type-picker, .language-picker {
      display: flex;
      gap: 0.5rem;
      width: 100%;
    }
    .type-btn, .lang-btn {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid #333;
      border-radius: 10px;
      background: #171717;
      color: #a3a3a3;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .type-btn:hover, .lang-btn:hover {
      border-color: #525252;
    }
    .type-btn.active {
      border-color: #22d3ee;
      color: #22d3ee;
      background: rgba(34, 211, 238, 0.08);
    }
    .lang-btn.active {
      border-color: #a78bfa;
      color: #a78bfa;
      background: rgba(167, 139, 250, 0.08);
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
  joinCode = '';
  loading = signal(false);
  errorMsg = signal('');
  selectedType = signal<GameType>('tictactoe');
  selectedLanguage = signal<'en' | 'el'>('en');

  constructor(private gameService: GameService, private router: Router) {}

  async createGame() {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const type = this.selectedType();
      const language = type === 'hangman' ? this.selectedLanguage() : undefined;
      const { roomCode } = await this.gameService.createGame(type, language);
      this.router.navigate(['/game', type, roomCode]);
    } catch {
      this.errorMsg.set('Failed to create game. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async joinGame() {
    const code = this.joinCode.trim();
    if (!code) return;
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const type = await this.gameService.joinGame(code);
      this.router.navigate(['/game', type, code.toUpperCase()]);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'Failed to join game.');
    } finally {
      this.loading.set(false);
    }
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `npx ng build`
Expected: Build succeeds.

- [ ] **Step 3: Commit and push**

```bash
git add src/app/
git commit -m "feat: add game-type picker and language selector to home page"
git push
```

Tic-Tac-Toe should work at `/game/tictactoe/:roomCode`. Hangman route exists with placeholder.

---

## Phase 4 — Frontend: Hangman UI

### Task 11: Build GallowsComponent

**Files:**
- Create: `src/app/game/hangman/gallows/gallows.component.ts`

- [ ] **Step 1: Create the component**

Create `src/app/game/hangman/gallows/gallows.component.ts`:

```typescript
import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-gallows',
  standalone: true,
  template: `
    <svg viewBox="0 0 200 220" class="gallows">
      <!-- Base -->
      <line x1="20" y1="200" x2="180" y2="200" stroke="#525252" stroke-width="3" stroke-linecap="round"/>
      <!-- Pole -->
      <line x1="60" y1="200" x2="60" y2="20" stroke="#525252" stroke-width="3" stroke-linecap="round"/>
      <!-- Top bar -->
      <line x1="60" y1="20" x2="140" y2="20" stroke="#525252" stroke-width="3" stroke-linecap="round"/>
      <!-- Rope -->
      <line x1="140" y1="20" x2="140" y2="45" stroke="#525252" stroke-width="2" stroke-linecap="round"/>

      <!-- Body parts (shown based on wrong guesses) -->
      @if (parts() >= 1) {
        <!-- Head -->
        <circle cx="140" cy="60" r="15" stroke="#e5e5e5" stroke-width="2" fill="none" class="part"/>
      }
      @if (parts() >= 2) {
        <!-- Body -->
        <line x1="140" y1="75" x2="140" y2="125" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/>
      }
      @if (parts() >= 3) {
        <!-- Left arm -->
        <line x1="140" y1="90" x2="115" y2="110" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/>
      }
      @if (parts() >= 4) {
        <!-- Right arm -->
        <line x1="140" y1="90" x2="165" y2="110" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/>
      }
      @if (parts() >= 5) {
        <!-- Left leg -->
        <line x1="140" y1="125" x2="115" y2="155" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/>
      }
      @if (parts() >= 6) {
        <!-- Right leg -->
        <line x1="140" y1="125" x2="165" y2="155" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/>
      }
    </svg>
  `,
  styles: [`
    .gallows {
      width: 180px;
      height: 200px;
    }
    .part {
      animation: fadeIn 0.3s ease-in;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `],
})
export class GallowsComponent {
  lives = input.required<number>();
  parts = computed(() => 6 - this.lives());
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/hangman/gallows/
git commit -m "feat: add GallowsComponent with progressive SVG hangman figure"
```

### Task 12: Build WordDisplayComponent

**Files:**
- Create: `src/app/game/hangman/word-display/word-display.component.ts`

- [ ] **Step 1: Create the component**

Create `src/app/game/hangman/word-display/word-display.component.ts`:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-word-display',
  standalone: true,
  template: `
    <div class="word">
      @for (char of maskedWord().split(''); track $index) {
        <span class="letter-slot" [class.revealed]="char !== '_'">
          {{ char === '_' ? '\u00A0' : char }}
        </span>
      }
    </div>
  `,
  styles: [`
    .word {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .letter-slot {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.2rem;
      height: 2.8rem;
      border-bottom: 2px solid #525252;
      font-size: 1.4rem;
      font-weight: 700;
      color: #e5e5e5;
      font-family: monospace;
      transition: border-color 0.2s;
    }
    .letter-slot.revealed {
      border-color: #22d3ee;
      color: #22d3ee;
    }
  `],
})
export class WordDisplayComponent {
  maskedWord = input.required<string>();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/hangman/word-display/
git commit -m "feat: add WordDisplayComponent for masked hangman word"
```

### Task 13: Build KeyboardComponent

**Files:**
- Create: `src/app/game/hangman/keyboard/keyboard.component.ts`

- [ ] **Step 1: Create the component**

Create `src/app/game/hangman/keyboard/keyboard.component.ts`:

```typescript
import { Component, input, output, computed } from '@angular/core';

const EN_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const EL_KEYS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'.split('');

@Component({
  selector: 'app-keyboard',
  standalone: true,
  template: `
    <div class="keyboard">
      @for (key of keys(); track key) {
        <button
          class="key"
          [class.correct]="correctSet().has(key)"
          [class.wrong]="wrongSet().has(key)"
          [disabled]="guessedSet().has(key) || !interactive()"
          (click)="letterClicked.emit(key)"
        >{{ key }}</button>
      }
    </div>
  `,
  styles: [`
    .keyboard {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      justify-content: center;
      max-width: 380px;
    }
    .key {
      min-width: 2rem;
      height: 2.4rem;
      border: 1px solid #333;
      border-radius: 6px;
      background: #171717;
      color: #e5e5e5;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .key:hover:not(:disabled) {
      border-color: #525252;
      background: #262626;
    }
    .key:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .key.correct {
      border-color: #22d3ee;
      color: #22d3ee;
      background: rgba(34, 211, 238, 0.1);
    }
    .key.wrong {
      border-color: #f87171;
      color: #f87171;
      background: rgba(248, 113, 113, 0.1);
    }
  `],
})
export class KeyboardComponent {
  language = input.required<'en' | 'el'>();
  guessedLetters = input.required<string[]>();
  wrongGuesses = input.required<string[]>();
  interactive = input.required<boolean>();
  letterClicked = output<string>();

  keys = computed(() => this.language() === 'el' ? EL_KEYS : EN_KEYS);
  guessedSet = computed(() => new Set(this.guessedLetters()));
  wrongSet = computed(() => new Set(this.wrongGuesses()));
  correctSet = computed(() => {
    const guessed = new Set(this.guessedLetters());
    const wrong = new Set(this.wrongGuesses());
    return new Set([...guessed].filter(l => !wrong.has(l)));
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/hangman/keyboard/
git commit -m "feat: add KeyboardComponent with language-aware letter grid"
```

### Task 14: Build WordGuessComponent

**Files:**
- Create: `src/app/game/hangman/word-guess/word-guess.component.ts`

- [ ] **Step 1: Create the component**

Create `src/app/game/hangman/word-guess/word-guess.component.ts`:

```typescript
import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-word-guess',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="word-guess" (submit)="submit($event)">
      <input
        type="text"
        class="guess-input"
        [ngModel]="guess"
        (ngModelChange)="guess = $event"
        [placeholder]="'Guess the full word...'"
        [disabled]="!interactive()"
      />
      <button type="submit" class="guess-btn" [disabled]="!interactive() || !guess.trim()">Guess</button>
    </form>
  `,
  styles: [`
    .word-guess {
      display: flex;
      gap: 0.5rem;
      width: 100%;
      max-width: 320px;
    }
    .guess-input {
      flex: 1;
      padding: 0.625rem 0.75rem;
      border: 1px solid #333;
      border-radius: 8px;
      background: #171717;
      color: #e5e5e5;
      font-size: 0.9rem;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      outline: none;
      box-sizing: border-box;
    }
    .guess-input:focus {
      border-color: #a78bfa;
    }
    .guess-input:disabled {
      opacity: 0.4;
    }
    .guess-btn {
      padding: 0.625rem 1rem;
      border: none;
      border-radius: 8px;
      background: #a78bfa;
      color: #0a0a0a;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .guess-btn:hover:not(:disabled) {
      transform: scale(1.03);
      box-shadow: 0 0 12px rgba(167, 139, 250, 0.3);
    }
    .guess-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `],
})
export class WordGuessComponent {
  interactive = input.required<boolean>();
  wordGuessed = output<string>();
  guess = '';

  submit(event: Event) {
    event.preventDefault();
    const word = this.guess.trim();
    if (!word) return;
    this.wordGuessed.emit(word);
    this.guess = '';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/hangman/word-guess/
git commit -m "feat: add WordGuessComponent for full word guesses"
```

### Task 15: Build OpponentStatusComponent

**Files:**
- Create: `src/app/game/hangman/opponent-status/opponent-status.component.ts`

- [ ] **Step 1: Create the component**

Create `src/app/game/hangman/opponent-status/opponent-status.component.ts`:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-opponent-status',
  standalone: true,
  template: `
    <div class="opponent">
      <span class="label">Opponent</span>
      <div class="hearts">
        @for (i of livesArray(); track i) {
          <span class="heart" [class.lost]="i >= lives()">&#9829;</span>
        }
      </div>
      @if (solved()) {
        <span class="solved-badge">Solved!</span>
      }
    </div>
  `,
  styles: [`
    .opponent {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      border: 1px solid #262626;
      border-radius: 8px;
    }
    .label {
      font-size: 0.8rem;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .hearts {
      display: flex;
      gap: 0.15rem;
    }
    .heart {
      color: #fb7185;
      font-size: 1rem;
      transition: opacity 0.3s;
    }
    .heart.lost {
      opacity: 0.15;
    }
    .solved-badge {
      font-size: 0.75rem;
      font-weight: 600;
      color: #34d399;
      padding: 0.15rem 0.5rem;
      border: 1px solid #34d399;
      border-radius: 4px;
    }
  `],
})
export class OpponentStatusComponent {
  lives = input.required<number>();
  solved = input.required<boolean>();

  livesArray() {
    return Array.from({ length: 6 }, (_, i) => i);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/game/hangman/opponent-status/
git commit -m "feat: add OpponentStatusComponent with hearts display"
```

### Task 16: Build HangmanGameComponent (main wrapper)

**Files:**
- Modify: `src/app/game/hangman/hangman-game.component.ts`

- [ ] **Step 1: Replace placeholder with full implementation**

Replace contents of `src/app/game/hangman/hangman-game.component.ts`:

```typescript
import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, HangmanPublicState } from '../../services/game.service';
import { GallowsComponent } from './gallows/gallows.component';
import { WordDisplayComponent } from './word-display/word-display.component';
import { KeyboardComponent } from './keyboard/keyboard.component';
import { WordGuessComponent } from './word-guess/word-guess.component';
import { OpponentStatusComponent } from './opponent-status/opponent-status.component';

@Component({
  selector: 'app-hangman-game',
  standalone: true,
  imports: [GallowsComponent, WordDisplayComponent, KeyboardComponent, WordGuessComponent, OpponentStatusComponent],
  template: `
    <div class="game-container">
      <div class="header">
        <h1 class="logo">Hangman</h1>

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
        } @else if (hangmanState()?.status === 'waiting') {
          <span class="status-text waiting">Waiting for opponent<span class="dots"></span></span>
        } @else if (hangmanState()?.status === 'won') {
          <span class="status-text" [class.won]="iWon()" [class.lost]="!iWon()">
            {{ iWon() ? 'You win!' : 'You lose!' }}
          </span>
        } @else if (hangmanState()?.status === 'draw') {
          <span class="status-text draw">It's a draw!</span>
        } @else if (myLives() <= 0) {
          <span class="status-text lost">Out of lives! Waiting for opponent...</span>
        } @else {
          <span class="status-text playing">Guess the word!</span>
        }
      </div>

      @if (hangmanState(); as hs) {
        <div class="lives-display">
          <span class="lives-label">Your lives:</span>
          <div class="hearts">
            @for (i of livesArray; track i) {
              <span class="heart" [class.lost]="i >= hs.lives">&#9829;</span>
            }
          </div>
        </div>

        @if (hs.status === 'playing' || hs.status === 'won' || hs.status === 'draw') {
          <app-opponent-status [lives]="hs.opponentLives" [solved]="hs.opponentSolved" />
        }

        <div class="game-area">
          <app-gallows [lives]="hs.lives" />
          <app-word-display [maskedWord]="hs.status === 'won' || hs.status === 'draw' ? (hs.revealedWord ?? hs.maskedWord) : hs.maskedWord" />
        </div>

        @if (hs.status === 'playing' && hs.lives > 0) {
          <app-keyboard
            [language]="hs.language"
            [guessedLetters]="hs.guessedLetters"
            [wrongGuesses]="hs.wrongGuesses"
            [interactive]="true"
            (letterClicked)="onLetterClick($event)"
          />
          <app-word-guess
            [interactive]="true"
            (wordGuessed)="onWordGuess($event)"
          />
        } @else if (hs.status === 'playing') {
          <app-keyboard
            [language]="hs.language"
            [guessedLetters]="hs.guessedLetters"
            [wrongGuesses]="hs.wrongGuesses"
            [interactive]="false"
            (letterClicked)="onLetterClick($event)"
          />
        }

        @if (hs.revealedWord && (hs.status === 'won' || hs.status === 'draw')) {
          <p class="revealed">The word was: <strong>{{ hs.revealedWord }}</strong></p>
        }

        @if (hs.status === 'won' || hs.status === 'draw') {
          <button class="btn btn-primary play-again" (click)="playAgain()">Play Again</button>
        }
      }
    </div>
  `,
  styles: [`
    .game-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: 1.5rem 1rem;
      gap: 1.25rem;
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
    .status-text.playing { color: #22d3ee; }
    .status-text.waiting { color: #a3a3a3; }
    .status-text.won { color: #facc15; font-size: 1.5rem; }
    .status-text.lost { color: #f87171; font-size: 1.3rem; }
    .status-text.draw { color: #a78bfa; font-size: 1.5rem; }
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
    .lives-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .lives-label {
      font-size: 0.8rem;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .hearts {
      display: flex;
      gap: 0.15rem;
    }
    .heart {
      color: #fb7185;
      font-size: 1.1rem;
      transition: opacity 0.3s;
    }
    .heart.lost {
      opacity: 0.15;
    }
    .game-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }
    .revealed {
      color: #a3a3a3;
      font-size: 1rem;
    }
    .revealed strong {
      color: #facc15;
      font-family: monospace;
      letter-spacing: 0.1em;
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
  `],
})
export class HangmanGameComponent implements OnInit, OnDestroy {
  private gameService = inject(GameService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  copied = signal(false);
  livesArray = Array.from({ length: 6 }, (_, i) => i);

  gameState = this.gameService.gameState;
  roomCode = this.gameService.roomCode;
  myPlayer = this.gameService.myPlayer;
  connectionLost = this.gameService.connectionLost;

  hangmanState = computed(() => {
    const s = this.gameState();
    return s && s.type === 'hangman' ? s as HangmanPublicState : null;
  });

  iWon = computed(() => {
    const hs = this.hangmanState();
    return hs?.status === 'won' && hs.winner === this.myPlayer();
  });

  myLives = computed(() => this.hangmanState()?.lives ?? 6);

  ngOnInit() {
    if (!this.gameService.roomCode()) {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy() {
    this.gameService.stopPolling();
  }

  async onLetterClick(letter: string) {
    await this.gameService.makeMove({ letter });
  }

  async onWordGuess(word: string) {
    await this.gameService.makeMove({ word });
  }

  async copyRoomCode() {
    const code = this.roomCode();
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async playAgain() {
    await this.gameService.rematch();
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `npx ng build`
Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

Run: `npm run test:api`
Expected: All tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add src/app/game/hangman/
git commit -m "feat: build full Hangman UI with gallows, keyboard, word display, and opponent status"
git push
```

Full feature should be deployable and functional.
