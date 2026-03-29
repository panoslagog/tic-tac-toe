import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, HangmanPublicState, HangmanCategory } from '../../services/game.service';
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
        <div class="header-badges">
          @if (roomCode()) {
            <div class="room-badge" (click)="copyRoomCode()">
              <span class="room-label">Room</span>
              <span class="room-code">{{ roomCode() }}</span>
              <span class="copy-hint">{{ copied() ? 'Link copied!' : 'Share invite link' }}</span>
            </div>
          }
          @if (hangmanState()?.category) {
            <div class="category-badge">
              <span class="category-label">{{ categoryLabel(hangmanState()!.category) }}</span>
            </div>
          }
        </div>
      </div>

      <div class="status-bar">
        @if (connectionLost()) {
          <span class="status-text error">Connection lost. Reconnecting...</span>
        } @else if (hangmanState()?.status === 'waiting') {
          <span class="status-text waiting">Waiting for opponent<span class="dots"></span></span>
        } @else if (hangmanState()?.status === 'won') {
          <span class="status-text" [class.won]="iWon()" [class.lost]="!iWon()">{{ iWon() ? 'You win!' : 'You lose!' }}</span>
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
          <app-keyboard [language]="hs.language" [guessedLetters]="hs.guessedLetters" [wrongGuesses]="hs.wrongGuesses" [interactive]="true" (letterClicked)="onLetterClick($event)" />
          <app-word-guess [interactive]="true" (wordGuessed)="onWordGuess($event)" />
        } @else if (hs.status === 'playing') {
          <app-keyboard [language]="hs.language" [guessedLetters]="hs.guessedLetters" [wrongGuesses]="hs.wrongGuesses" [interactive]="false" (letterClicked)="onLetterClick($event)" />
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
    .game-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; min-height: 100dvh; padding: 1.5rem 1rem; gap: 1.25rem; }
    .header { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .logo { font-size: 1.5rem; font-weight: 700; color: #e5e5e5; }
    .header-badges { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
    .room-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #171717; border: 1px solid #333; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
    .room-badge:hover { border-color: #525252; }
    .room-label { font-size: 0.75rem; color: #737373; text-transform: uppercase; letter-spacing: 0.05em; }
    .room-code { font-family: monospace; font-size: 1.1rem; font-weight: 700; color: #e5e5e5; letter-spacing: 0.15em; }
    .copy-hint { font-size: 0.7rem; color: #525252; }
    .category-badge { padding: 0.35rem 0.75rem; background: rgba(251, 146, 60, 0.08); border: 1px solid rgba(251, 146, 60, 0.4); border-radius: 20px; }
    .category-label { font-size: 0.75rem; font-weight: 600; color: #fb923c; text-transform: uppercase; letter-spacing: 0.05em; }
    .status-bar { min-height: 2rem; display: flex; align-items: center; }
    .status-text { font-size: 1.1rem; font-weight: 600; }
    .status-text.playing { color: #22d3ee; }
    .status-text.waiting { color: #a3a3a3; }
    .status-text.won { color: #facc15; font-size: 1.5rem; }
    .status-text.lost { color: #f87171; font-size: 1.3rem; }
    .status-text.draw { color: #a78bfa; font-size: 1.5rem; }
    .status-text.error { color: #f87171; }
    .dots::after { content: ''; animation: dots 1.5s infinite; }
    @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
    .lives-display { display: flex; align-items: center; gap: 0.5rem; }
    .lives-label { font-size: 0.8rem; color: #737373; text-transform: uppercase; letter-spacing: 0.05em; }
    .hearts { display: flex; gap: 0.15rem; }
    .heart { color: #fb7185; font-size: 1.1rem; transition: opacity 0.3s; }
    .heart.lost { opacity: 0.15; }
    .game-area { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
    .revealed { color: #a3a3a3; font-size: 1rem; }
    .revealed strong { color: #facc15; font-family: monospace; letter-spacing: 0.1em; }
    .play-again { padding: 0.875rem 2rem; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; background: #22d3ee; color: #0a0a0a; }
    .play-again:hover { transform: scale(1.03); box-shadow: 0 0 20px rgba(34, 211, 238, 0.3); }
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
    const link = `${window.location.origin}/join/${code}`;
    await navigator.clipboard.writeText(link);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async playAgain() {
    await this.gameService.rematch();
  }

  categoryLabel(category: HangmanCategory): string {
    const labels: Record<HangmanCategory, string> = {
      animals: 'Animals',
      food: 'Food & Drink',
      nature: 'Nature',
      body: 'Body Parts',
      home: 'Home & Objects',
      places: 'Places',
      sports: 'Sports',
      professions: 'Professions',
      clothing: 'Clothing',
      music: 'Music',
      other: 'Other',
    };
    return labels[category] ?? category;
  }
}
