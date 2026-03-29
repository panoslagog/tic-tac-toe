# Multi-Game Platform Design (Tic-Tac-Toe + Hangman)

## Overview

Evolve the single-game Tic-Tac-Toe app into a lightweight multiplayer game platform supporting both Tic-Tac-Toe and Hangman. The home page gains a game-type picker. Each game type has its own logic, components, and API behavior, but they share Redis infrastructure, the polling pattern, room codes, and token-based auth.

**Constraint:** Every incremental deploy must keep Tic-Tac-Toe fully functional.

---

## URL Structure

| Route | Purpose |
|---|---|
| `/` | Home — create (with game-type picker) or join by code |
| `/game/tictactoe/:roomCode` | Tic-Tac-Toe game |
| `/game/hangman/:roomCode` | Hangman game |

---

## API Endpoints

All endpoints remain under `/api/game`. The `type` field in the stored state determines behavior.

### `POST /api/game` — Create game

**Request body:**
```json
{ "type": "tictactoe" }
// or
{ "type": "hangman", "language": "en" | "el" }
```

**Response:** `{ roomCode, playerToken, player: 'X' }`

For hangman, the server picks a random word from the static word list for the chosen language.

### `GET /api/game/:id` — Get state

Returns game-type-specific public state. The `type` field in the response tells the client which shape to expect.

### `POST /api/game/:id/join` — Join game

Works for both game types — joins as player O.

**Response:** `{ playerToken, player: 'O', type: 'tictactoe' | 'hangman' }`

The `type` field is added to the join response so the client knows which route to navigate to after joining.

### `POST /api/game/:id/move` — Make move

**Tic-Tac-Toe:** `{ position: 0-8 }` (unchanged)

**Hangman:**
```json
{ "letter": "A" }
// or
{ "word": "HELLO" }
```

### `POST /api/game/:id/rematch` — Rematch

- **Tic-Tac-Toe:** Resets board, swaps who goes first (unchanged)
- **Hangman:** Picks a new random word in the same language, resets both players' state

---

## Data Model

### Base State (shared)

```typescript
interface BaseGameState {
  type: 'tictactoe' | 'hangman';
  players: { X: string | null; O: string | null }; // player tokens
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  lastActivity: number;
}
```

### Tic-Tac-Toe State

```typescript
interface TicTacToeGameState extends BaseGameState {
  type: 'tictactoe';
  board: (Player | null)[];
  currentTurn: Player;
  winLine: number[] | null;
}
```

No changes from existing behavior.

### Hangman State

```typescript
interface HangmanPlayerState {
  guessedLetters: string[];   // letters this player has guessed
  wrongGuesses: string[];     // subset of guessedLetters that were wrong
  lives: number;              // starts at 6, decrements on wrong guess
  solved: boolean;            // true when word fully revealed or correct word guess
  solvedAt: number | null;    // timestamp of solve (for race-condition tiebreak)
}

interface HangmanGameState extends BaseGameState {
  type: 'hangman';
  word: string;               // the secret word (uppercase, unaccented)
  language: 'en' | 'el';
  playerState: {
    X: HangmanPlayerState;
    O: HangmanPlayerState;
  };
}
```

### Public State (sent to clients)

**Tic-Tac-Toe:** Unchanged — `PublicGameState` as it exists today, plus `type: 'tictactoe'`.

**Hangman:**

```typescript
interface HangmanPublicState {
  type: 'hangman';
  language: 'en' | 'el';
  status: 'waiting' | 'playing' | 'won' | 'draw';
  winner: Player | null;
  you: Player | null;
  players: { X: boolean; O: boolean };

  // Your state (full visibility)
  maskedWord: string;         // e.g. "H_LL_" — based on YOUR guessed letters
  guessedLetters: string[];
  wrongGuesses: string[];
  lives: number;

  // Opponent state (partial visibility)
  opponentLives: number;
  opponentSolved: boolean;

  // Revealed on game end only
  revealedWord: string | null; // shown when game is won or draw
}
```

---

## Hangman Game Rules

### Setup
- Creator picks language (English or Greek)
- Server picks a random word from the static word list
- Both players start with 6 lives

### Gameplay
- Both players guess simultaneously (no turns)
- Each player has their own independent `guessedLetters` set
- A player cannot see which letters the opponent has guessed
- A player CAN see the opponent's remaining lives and whether they've solved

### Letter Guess
- Input normalized to uppercase (and accent-stripped for Greek)
- Already-guessed letter: no-op, no penalty
- Correct letter: revealed in the player's masked word
- Wrong letter: player loses 1 life

### Full Word Guess
- Input normalized to uppercase (and accent-stripped for Greek)
- Correct: player wins immediately (`solved = true`, `solvedAt` set)
- Wrong: player loses 2 lives

### Win Conditions
- **Win:** First player to solve the word (all letters revealed or correct word guess). Tiebreak by `solvedAt` timestamp. If same millisecond: draw.
- **One player loses all lives:** They can no longer guess. If the other player still has lives, they continue. If they solve it, they win. If they also run out, it's a draw.
- **Both lose all lives:** Draw — the word is revealed, rematch offered.

### Rematch
- New random word picked from the same language
- Both players' states reset (6 lives, empty guesses)
- Same room code and player assignments

---

## Word Lists

Static JSON files at:
- `api/_lib/words/en.json` — English words
- `api/_lib/words/el.json` — Greek words

Each file is an array of uppercase strings. Greek words stored without accents (standard for uppercase Greek). ~200-500 words per language to start. Words should be common nouns, 4-10 characters long.

Example:
```json
// en.json
["APPLE", "BRIDGE", "CASTLE", ...]

// el.json
["ΜΗΛΟ", "ΓΕΦΥΡΑ", "ΚΑΣΤΡΟ", ...]
```

---

## Frontend Changes

### Home Component

- Add a game-type toggle: **Tic-Tac-Toe** / **Hangman** (default: Tic-Tac-Toe)
- When Hangman is selected, show a language selector: **English** / **Greek**
- "Create Game" sends `{ type, language? }` to the API
- "Join Game" remains code-only — the game type is determined by the room's stored state

### Routing

```typescript
Routes = [
  { path: '', component: HomeComponent },
  { path: 'game/tictactoe/:roomCode', component: TicTacToeGameComponent },
  { path: 'game/hangman/:roomCode', component: HangmanGameComponent },
];
```

The existing `GameComponent` is renamed to `TicTacToeGameComponent` and moved under `game/tictactoe/`. Its internal logic and sub-components (board, cell, win-line, confetti) are unchanged.

### Game Service

The existing `GameService` is generalized:
- `createGame(type, language?)` — sends type/language to API
- `joinGame(roomCode)` — unchanged, but after joining, the service reads the `type` from the returned state
- `makeMove(payload)` — accepts either `{ position }` or `{ letter }` / `{ word }`
- `rematch()` — unchanged
- Polling and connection-lost logic: unchanged
- The `gameState` signal holds a discriminated union (`TicTacToePublicState | HangmanPublicState`)
- After create or join, the service navigates to the correct route based on game type

### Hangman Components

New component tree under `src/app/game/hangman/`:

| Component | Purpose |
|---|---|
| `HangmanGameComponent` | Main wrapper — status, player info, game layout |
| `GallowsComponent` | SVG hangman figure, drawn progressively as lives decrease |
| `WordDisplayComponent` | Shows masked word with letter slots (revealed/hidden) |
| `KeyboardComponent` | Clickable letter grid (A-Z or Greek alphabet). Disables used letters, colors correct/wrong |
| `WordGuessComponent` | Text input for full-word guess attempts |
| `OpponentStatusComponent` | Shows opponent's remaining lives (hearts/icons) and solved status |

---

## Incremental Delivery Phases

### Phase 1 — Backend: Type-aware game state

- Add `type` field to `GameState` discriminated union
- Update `createGame` to accept `{ type }` and default to `'tictactoe'`
- Update `getGame` / state endpoint to include `type` in public state
- Update all existing endpoints to work with the new type-aware state shape
- All existing Tic-Tac-Toe behavior remains identical
- **Deployable:** Yes, tic-tac-toe works as before

### Phase 2 — Backend: Hangman game logic + word lists

- Add static word lists (`en.json`, `el.json`)
- Add `api/_lib/hangman-logic.ts` with: word selection, letter validation, word guess validation, masked word generation, win/draw detection
- Update create endpoint to handle `type: 'hangman'` with `language`
- Update move endpoint to handle hangman moves (`{ letter }` or `{ word }`)
- Update rematch endpoint to handle hangman (new word, reset player states)
- Update state endpoint to return hangman-specific public state
- Add tests for hangman game logic
- **Deployable:** Yes, hangman API works but no UI yet; tic-tac-toe unaffected

### Phase 3 — Frontend: Routing + home page + service updates

- Rename `GameComponent` to `TicTacToeGameComponent`, move to `game/tictactoe/`
- Update routes: `/game/tictactoe/:roomCode` and `/game/hangman/:roomCode`
- Update home component: add game-type toggle and language selector
- Generalize `GameService` to handle both game types
- Add navigation logic: after create/join, route to correct game path based on type
- **Deployable:** Yes, tic-tac-toe works at new route; hangman route exists but no UI

### Phase 4 — Frontend: Hangman UI

- Build hangman component tree: game wrapper, gallows SVG, word display, keyboard, word guess input, opponent status
- Wire up to `GameService` hangman state
- Style consistently with existing dark theme and color palette
- **Deployable:** Yes, full feature complete
