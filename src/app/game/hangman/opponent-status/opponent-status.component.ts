import { Component, input } from '@angular/core';

@Component({
  selector: 'app-opponent-status',
  standalone: true,
  template: `
    <div class="opponent">
      <span class="label">Opponent</span>
      <div class="hearts">
        @for (i of livesArray; track i) {
          <span class="heart" [class.lost]="i >= lives()">&#9829;</span>
        }
      </div>
      @if (solved()) { <span class="solved-badge">Solved!</span> }
    </div>
  `,
  styles: [`.opponent { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border: 1px solid #262626; border-radius: 8px; } .label { font-size: 0.8rem; color: #737373; text-transform: uppercase; letter-spacing: 0.05em; } .hearts { display: flex; gap: 0.15rem; } .heart { color: #fb7185; font-size: 1rem; transition: opacity 0.3s; } .heart.lost { opacity: 0.15; } .solved-badge { font-size: 0.75rem; font-weight: 600; color: #34d399; padding: 0.15rem 0.5rem; border: 1px solid #34d399; border-radius: 4px; }`],
})
export class OpponentStatusComponent {
  lives = input.required<number>();
  solved = input.required<boolean>();
  livesArray = Array.from({ length: 6 }, (_, i) => i);
}
