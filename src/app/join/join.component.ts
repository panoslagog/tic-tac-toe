import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-join',
  standalone: true,
  template: `
    <div class="join-container">
      @if (error()) {
        <p class="error">{{ error() }}</p>
        <button class="btn" (click)="goHome()">Back to Home</button>
      } @else {
        <p class="loading">Joining game<span class="dots"></span></p>
      }
    </div>
  `,
  styles: [`
    .join-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 1.5rem; }
    .loading { color: #a3a3a3; font-size: 1.1rem; }
    .error { color: #f87171; font-size: 1rem; }
    .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 10px; background: #22d3ee; color: #0a0a0a; font-weight: 600; cursor: pointer; }
    .dots::after { content: ''; animation: dots 1.5s infinite; }
    @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
  `],
})
export class JoinComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gameService = inject(GameService);

  error = signal('');

  async ngOnInit() {
    const roomCode = this.route.snapshot.paramMap.get('roomCode');
    if (!roomCode) {
      this.error.set('Invalid join link.');
      return;
    }

    try {
      const type = await this.gameService.joinGame(roomCode);
      this.router.navigate(['/game', type, roomCode.toUpperCase()], { replaceUrl: true });
    } catch (err: any) {
      this.error.set(err.message || 'Failed to join game.');
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
