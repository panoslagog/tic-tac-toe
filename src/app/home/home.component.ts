import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GameService, GameType } from '../services/game.service';

interface CategoryOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="home-container">
      <h1 class="title">Game Room</h1>
      <p class="subtitle">Play with a friend online</p>

      <div class="actions">
        <input type="text" class="input-username" [ngModel]="usernameInput()" (ngModelChange)="usernameInput.set($event)" placeholder="Your name (optional)" maxlength="15" />

        <div class="game-type-picker">
          <button class="type-btn" [class.active]="selectedType() === 'tictactoe'" (click)="selectedType.set('tictactoe')">Tic Tac Toe</button>
          <button class="type-btn" [class.active]="selectedType() === 'hangman'" (click)="selectedType.set('hangman')">Hangman</button>
        </div>

        @if (selectedType() === 'hangman') {
          <div class="language-picker">
            <button class="lang-btn" [class.active]="selectedLanguage() === 'en'" (click)="selectedLanguage.set('en')">English</button>
            <button class="lang-btn" [class.active]="selectedLanguage() === 'el'" (click)="selectedLanguage.set('el')">Greek</button>
          </div>
          <div class="category-picker">
            @for (cat of categoryOptions; track cat.value) {
              <button class="cat-btn" [class.active]="selectedCategory() === cat.value" (click)="selectedCategory.set(cat.value)">{{ cat.label }}</button>
            }
          </div>
        }

        <button class="btn btn-primary" (click)="createGame()" [disabled]="loading()">
          {{ loading() ? 'Creating...' : 'Create Game' }}
        </button>

        <div class="divider">or</div>

        <div class="join-section">
          <input type="text" class="input-code" [ngModel]="joinCode" (ngModelChange)="joinCode = $event" placeholder="Enter room code" maxlength="4" (keyup.enter)="joinGame()" />
          <button class="btn btn-secondary" (click)="joinGame()" [disabled]="loading() || !joinCode">Join Game</button>
        </div>
      </div>

      @if (errorMsg()) {
        <p class="error">{{ errorMsg() }}</p>
      }
    </div>
  `,
  styles: [`
    .home-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
    .title { font-size: clamp(2rem, 8vw, 3rem); font-weight: 700; margin-bottom: 0.5rem; background: linear-gradient(135deg, #22d3ee, #fb7185); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; }
    .subtitle { color: #a3a3a3; margin-bottom: 3rem; font-size: 1.1rem; }
    .actions { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; width: 100%; max-width: 380px; }
    .game-type-picker, .language-picker { display: flex; gap: 0.5rem; width: 100%; }
    .type-btn, .lang-btn { flex: 1; padding: 0.75rem; border: 1px solid #333; border-radius: 10px; background: #171717; color: #a3a3a3; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .type-btn:hover, .lang-btn:hover { border-color: #525252; }
    .type-btn.active { border-color: #22d3ee; color: #22d3ee; background: rgba(34, 211, 238, 0.08); }
    .lang-btn.active { border-color: #a78bfa; color: #a78bfa; background: rgba(167, 139, 250, 0.08); }
    .category-picker { display: flex; flex-wrap: wrap; gap: 0.4rem; width: 100%; justify-content: center; }
    .cat-btn { padding: 0.35rem 0.75rem; border: 1px solid #333; border-radius: 20px; background: #171717; color: #a3a3a3; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
    .cat-btn:hover { border-color: #525252; }
    .cat-btn.active { border-color: #fb923c; color: #fb923c; background: rgba(251, 146, 60, 0.08); }
    .btn { width: 100%; padding: 0.875rem 1.5rem; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
    .btn:hover:not(:disabled) { transform: scale(1.03); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #22d3ee; color: #0a0a0a; }
    .btn-primary:hover:not(:disabled) { box-shadow: 0 0 20px rgba(34, 211, 238, 0.3); }
    .btn-secondary { background: #fb7185; color: #0a0a0a; }
    .btn-secondary:hover:not(:disabled) { box-shadow: 0 0 20px rgba(251, 113, 133, 0.3); }
    .divider { color: #525252; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.1em; }
    .join-section { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; }
    .input-username { width: 100%; padding: 0.875rem 1rem; border: 1px solid #333; border-radius: 12px; background: #171717; color: #e5e5e5; font-size: 1rem; text-align: left; outline: none; box-sizing: border-box; }
    .input-username:focus { border-color: #22d3ee; }
    .input-username::placeholder { color: #525252; }
    .input-code { width: 100%; padding: 0.875rem 1rem; border: 1px solid #333; border-radius: 12px; background: #171717; color: #e5e5e5; font-size: 1.1rem; font-family: monospace; text-align: center; letter-spacing: 0.2em; text-transform: uppercase; outline: none; box-sizing: border-box; }
    .input-code:focus { border-color: #fb7185; }
    .error { color: #f87171; margin-top: 1rem; font-size: 0.875rem; }
  `],
})
export class HomeComponent {
  joinCode = '';
  loading = signal(false);
  errorMsg = signal('');
  selectedType = signal<GameType>('tictactoe');
  selectedLanguage = signal<'en' | 'el'>('en');
  selectedCategory = signal<string>('random');
  usernameInput = signal('');

  categoryOptions: CategoryOption[] = [
    { value: 'random', label: 'Random' },
    { value: 'animals', label: 'Animals' },
    { value: 'food', label: 'Food & Drink' },
    { value: 'nature', label: 'Nature' },
    { value: 'body', label: 'Body Parts' },
    { value: 'home', label: 'Home & Objects' },
    { value: 'places', label: 'Places' },
    { value: 'sports', label: 'Sports' },
    { value: 'professions', label: 'Professions' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'music', label: 'Music' },
  ];

  constructor(private gameService: GameService, private router: Router) {}

  async createGame() {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const type = this.selectedType();
      const language = type === 'hangman' ? this.selectedLanguage() : undefined;
      const rawCategory = this.selectedCategory();
      const category = type === 'hangman' && rawCategory !== 'random' ? rawCategory : undefined;
      const { roomCode } = await this.gameService.createGame(type, language, category, this.usernameInput().trim() || undefined);
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
      const type = await this.gameService.joinGame(code, this.usernameInput().trim() || undefined);
      this.router.navigate(['/game', type, code.toUpperCase()]);
    } catch (err: any) {
      this.errorMsg.set(err.message || 'Failed to join game.');
    } finally {
      this.loading.set(false);
    }
  }
}
