# Multiplayer Tic-Tac-Toe — Design Spec

## Overview

A two-player online tic-tac-toe game built with Angular 19 and hosted on Vercel. Players connect via shareable room codes. Game state is stored in Upstash Redis and synchronized via HTTP polling.

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────┐       ┌─────────────┐
│   Angular 19 SPA    │ HTTP  │  Vercel Serverless Fns   │ Redis │   Upstash   │
│  (standalone comps) │◄─────►│  (Node.js, /api/*)       │◄─────►│   Redis     │
│  + Angular Anims    │       │                          │       │             │
└─────────────────────┘       └──────────────────────────┘       └─────────────┘
```

- **Frontend:** Angular 19 with standalone components, Angular Animations, and canvas-based confetti.
- **Backend:** Vercel Serverless Functions (Node.js/TypeScript) exposing a REST API.
- **State:** Upstash Redis via Vercel Marketplace. Each game has a 1-hour TTL for automatic cleanup.
- **Sync:** Client polls `GET /api/game/:id` every 1.5 seconds while waiting for the opponent's move. Polling pauses when it is the player's turn.

## Game Flow

1. **Home screen** — Two actions: "Create Game" and "Join Game."
2. **Create Game** — `POST /api/game` returns a 6-character alphanumeric room code and a player token (UUID). The player is assigned X. UI shows a waiting screen with the room code.
3. **Join Game** — Player enters a room code. `POST /api/game/:id/join` returns a player token. The player is assigned O. Both players enter the game.
4. **Gameplay** — Players alternate turns starting with X. The active player clicks a cell, which calls `POST /api/game/:id/move`. The opponent picks up the move via polling.
5. **End state** — Win (animated line + confetti), draw, or opponent disconnect (30-second inactivity timeout). A "Play Again" button creates a new game.

## API Endpoints

All endpoints are under `/api/`.

### POST /api/game

Create a new game.

**Response:**
```json
{
  "roomCode": "ABC123",
  "playerToken": "uuid-v4",
  "player": "X"
}
```

### GET /api/game/:id

Get current game state.

**Response:**
```json
{
  "board": [null, "X", null, "O", null, null, null, null, null],
  "currentTurn": "X",
  "status": "waiting" | "playing" | "won" | "draw",
  "winner": null | "X" | "O",
  "winLine": null | [0, 4, 8],
  "players": { "X": true, "O": false },
  "you": "X"
}
```

The `players` field indicates which slots are filled (boolean, not tokens). The `you` field is determined by the `X-Player-Token` header.

### POST /api/game/:id/join

Join an existing game.

**Request header:** None required (new player).

**Response:**
```json
{
  "playerToken": "uuid-v4",
  "player": "O"
}
```

**Errors:**
- `404` — Game not found.
- `400` — Game is full.

### POST /api/game/:id/move

Make a move.

**Request header:** `X-Player-Token: <token>`

**Request body:**
```json
{
  "position": 4
}
```

Position is 0-8 (left-to-right, top-to-bottom).

**Response:** Updated game state (same shape as GET).

**Errors:**
- `403` — Not your turn / invalid token.
- `400` — Invalid position / cell occupied / game not in "playing" status.

## Redis Data Model

**Key:** `game:{roomCode}`

```json
{
  "board": [null, null, null, null, null, null, null, null, null],
  "players": {
    "X": "player-token-uuid",
    "O": null
  },
  "currentTurn": "X",
  "status": "waiting",
  "winner": null,
  "winLine": null,
  "lastActivity": 1711648000000
}
```

- **TTL:** 3600 seconds (1 hour) from creation.
- **Room code generation:** 6 alphanumeric characters (uppercase + digits), collision-checked on creation.
- **Win detection:** Server-side after each move. Checks all 8 winning lines. Sets `status` to `"won"`, `winner` to `"X"` or `"O"`, and `winLine` to the array of 3 winning positions.
- **Draw detection:** All 9 cells filled with no winner. Sets `status` to `"draw"`.

## Win Lines

```
[0,1,2], [3,4,5], [6,7,8],  // rows
[0,3,6], [1,4,7], [2,5,8],  // columns
[0,4,8], [2,4,6]             // diagonals
```

## UI Components

### HomeComponent
- Route: `/`
- Two buttons: "Create Game" and "Join Game."
- "Join Game" reveals a text input for the room code.
- On create: navigates to `/game/:roomCode` with the player token stored in a service.
- On join: validates room code, navigates to `/game/:roomCode`.

### GameComponent
- Route: `/game/:roomCode`
- Orchestrates the board, status, and end-game UI.
- Manages the polling interval (1.5s).
- Shows room code in a copyable badge for sharing.
- Displays "Waiting for opponent..." when status is `"waiting"`.
- Displays turn indicator: "Your turn" or "Opponent's turn."
- On game end: shows result, win animation, and "Play Again" button.

### BoardComponent
- Renders the 3x3 grid.
- Emits cell click events to GameComponent.
- Disables interaction when it is not the player's turn or game is over.

### CellComponent
- Individual cell in the grid.
- Inputs: value (`null`, `"X"`, `"O"`), interactive (boolean), winning (boolean).
- Hover effect: subtle scale + glow when interactive.
- X drawn as two animated SVG lines.
- O drawn as an animated SVG circle stroke.
- Winning cells get a highlight glow.

### WinLineComponent
- Overlay SVG that draws an animated line through the 3 winning cells.
- Receives the `winLine` array and calculates start/end coordinates.
- Animated stroke-dashoffset for a drawing effect.

### ConfettiComponent
- Canvas overlay triggered on win.
- Particle burst lasting 2-3 seconds.
- Removed from DOM after animation completes.

## Animations

| Animation | Trigger | Duration | Implementation |
|---|---|---|---|
| Cell hover | Mouse enter on empty, interactive cell | Instant | Angular Animations (scale 1.05, box-shadow glow) |
| X placement | X value set on cell | 300ms | SVG path stroke-dashoffset animation |
| O placement | O value set on cell | 300ms | SVG circle stroke-dashoffset animation |
| Win line | Game status becomes "won" | 500ms | SVG stroke-dashoffset on overlay line |
| Confetti | Game status becomes "won" | 2500ms | Canvas 2D particle system |
| Turn indicator pulse | Current turn changes | Continuous | CSS keyframe pulse on active player badge |
| Waiting dots | Status is "waiting" | Continuous | CSS keyframe dot animation |

## Visual Style

- **Theme:** Dark background (`#0a0a0a`), light grid lines (`#333`).
- **Colors:** X in cyan (`#22d3ee`), O in rose (`#fb7185`). Neutral text in `#e5e5e5`.
- **Typography:** System font stack (Geist Sans if available, else Inter/system-ui).
- **Grid:** Rounded corners, subtle border, centered on screen.
- **Buttons:** Filled with accent color, hover scale effect.
- **Room code badge:** Monospace, click-to-copy, subtle background.

## Routing

| Route | Component | Description |
|---|---|---|
| `/` | HomeComponent | Landing page |
| `/game/:roomCode` | GameComponent | Active game |

## State Management

- **GameService** — injectable service holding the current player token and player symbol (`X`/`O`). Provides methods: `createGame()`, `joinGame(code)`, `getState(code)`, `makeMove(code, position)`. Handles HTTP calls and polling logic.
- Player token stored in the service (in-memory). Refreshing the page loses the session, which is acceptable for a simple game.

## Error Handling

- **Network errors during polling:** Silent retry on next poll interval. Show a "Connection lost" indicator after 3 consecutive failures. Resume automatically when connection restores.
- **Invalid room code:** Toast/snackbar message, stay on home screen.
- **Game full:** Toast/snackbar message, stay on home screen.
- **Invalid move (race condition):** Refresh state from server, ignore the failed move.

## Testing Strategy

- **Unit tests:** Win detection logic, room code generation, move validation (server-side).
- **Component tests:** Board renders correctly, cell interactions, disabled states.
- **E2E consideration:** Out of scope for initial build. Manual testing with two browser tabs.

## Deployment

- Angular app builds to `dist/` and is served as static files by Vercel.
- Serverless functions live in an `api/` directory at the project root.
- Upstash Redis provisioned via `vercel integration add upstash` (provides `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars).
- `vercel.json` configures the SPA fallback rewrite for Angular routing.

## Out of Scope

- User accounts or persistent history.
- Spectator mode.
- Game chat.
- Mobile-specific layout (responsive but not mobile-first).
- E2E tests.
- Rematch with same room code.
