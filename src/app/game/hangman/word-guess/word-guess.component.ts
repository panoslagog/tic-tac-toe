import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-word-guess',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="word-guess" (submit)="submit($event)">
      <input type="text" class="guess-input" [ngModel]="guess" (ngModelChange)="guess = $event" placeholder="Guess the full word..." [disabled]="!interactive()" />
      <button type="submit" class="guess-btn" [disabled]="!interactive() || !guess.trim()">Guess</button>
    </form>
  `,
  styles: [`.word-guess { display: flex; gap: 0.5rem; width: 100%; max-width: 320px; } .guess-input { flex: 1; padding: 0.625rem 0.75rem; border: 1px solid #333; border-radius: 8px; background: #171717; color: #e5e5e5; font-size: 0.9rem; font-family: monospace; text-transform: uppercase; letter-spacing: 0.1em; outline: none; box-sizing: border-box; } .guess-input:focus { border-color: #a78bfa; } .guess-input:disabled { opacity: 0.4; } .guess-btn { padding: 0.625rem 1rem; border: none; border-radius: 8px; background: #a78bfa; color: #0a0a0a; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; } .guess-btn:hover:not(:disabled) { transform: scale(1.03); box-shadow: 0 0 12px rgba(167, 139, 250, 0.3); } .guess-btn:disabled { opacity: 0.4; cursor: not-allowed; }`],
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
