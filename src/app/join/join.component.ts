import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GameService, PublicGameState } from '../services/game.service';

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
  private http = inject(HttpClient);
  private gameService = inject(GameService);

  error = signal('');

  async ngOnInit() {
    const roomCode = this.route.snapshot.paramMap.get('roomCode')?.toUpperCase();
    if (!roomCode) {
      this.error.set('Invalid join link.');
      return;
    }

    // If we're already in this game (same tab navigation), go straight to it
    if (this.gameService.roomCode() === roomCode && this.gameService.myPlayer()) {
      this.navigateToGame(roomCode);
      return;
    }

    // Try to fetch the game state first to check if it exists and get its type
    try {
      const state = await firstValueFrom(
        this.http.get<PublicGameState>(`/api/game/${roomCode}`)
      );

      // Game is full — both players already joined
      if (state.players.X && state.players.O) {
        this.error.set('This game is full. Both players have already joined.');
        return;
      }

      // Join the game
      const type = await this.gameService.joinGame(roomCode);
      this.router.navigate(['/game', type, roomCode], { replaceUrl: true });
    } catch (err: any) {
      const msg = err?.error?.error || err?.message || 'Failed to join game.';
      this.error.set(msg);
    }
  }

  private navigateToGame(roomCode: string) {
    const type = this.gameService.gameType() ?? 'tictactoe';
    this.router.navigate(['/game', type, roomCode], { replaceUrl: true });
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
