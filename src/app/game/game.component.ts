import { Component, OnInit, OnDestroy, signal } from '@angular/core';
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
