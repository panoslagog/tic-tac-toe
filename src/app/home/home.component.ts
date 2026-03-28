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
  joinCode = '';
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
    const code = this.joinCode.trim();
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
