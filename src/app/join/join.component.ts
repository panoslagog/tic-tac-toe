import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="join-container">
      @if (error()) {
        <p class="error">{{ error() }}</p>
        <button class="btn" (click)="goHome()">Back to Home</button>
      } @else if (!joining()) {
        <div class="join-form">
          <p class="join-prompt">Enter your name to join</p>
          <input
            type="text"
            class="input-username"
            [(ngModel)]="usernameInput"
            placeholder="Your name (optional)"
            maxlength="15"
            (keyup.enter)="doJoin()"
            autofocus
          />
          <button class="btn btn-primary" (click)="doJoin()">Join Game</button>
        </div>
      } @else {
        <p class="loading">Joining game<span class="dots"></span></p>
      }
    </div>
  `,
  styles: [`
    .join-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 1.5rem; padding: 2rem; }
    .join-form { display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%; max-width: 320px; }
    .join-prompt { color: #a3a3a3; font-size: 1rem; margin: 0; }
    .input-username { width: 100%; padding: 0.875rem 1rem; border: 1px solid #333; border-radius: 12px; background: #171717; color: #e5e5e5; font-size: 1rem; outline: none; box-sizing: border-box; }
    .input-username:focus { border-color: #22d3ee; }
    .input-username::placeholder { color: #525252; }
    .loading { color: #a3a3a3; font-size: 1.1rem; }
    .error { color: #f87171; font-size: 1rem; }
    .btn { width: 100%; padding: 0.875rem 1.5rem; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
    .btn-primary { background: #22d3ee; color: #0a0a0a; }
    .btn-primary:hover { transform: scale(1.03); box-shadow: 0 0 20px rgba(34, 211, 238, 0.3); }
    .dots::after { content: ''; animation: dots 1.5s infinite; }
    @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
  `],
})
export class JoinComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gameService = inject(GameService);

  error = signal('');
  joining = signal(false);
  usernameInput = '';
  private roomCode = '';

  async ngOnInit() {
    const roomCode = this.route.snapshot.paramMap.get('roomCode')?.toUpperCase();
    if (!roomCode) {
      this.error.set('Invalid join link.');
      return;
    }
    this.roomCode = roomCode;

    // If we're already in this game (creator testing their own link), go straight to it
    if (this.gameService.roomCode() === roomCode && this.gameService.myPlayer()) {
      const type = this.gameService.gameType() ?? 'tictactoe';
      this.router.navigate(['/game', type, roomCode], { replaceUrl: true });
      return;
    }

    // Reset any stale service state before joining
    this.gameService.reset();
  }

  async doJoin() {
    this.joining.set(true);
    try {
      const username = this.usernameInput.trim() || undefined;
      const type = await this.gameService.joinGame(this.roomCode, username);
      this.router.navigate(['/game', type, this.roomCode], { replaceUrl: true });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to join game.');
      this.joining.set(false);
    }
  }

  goHome() {
    this.gameService.reset();
    this.router.navigate(['/']);
  }
}
