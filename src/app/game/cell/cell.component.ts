import { Component, input, output } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-cell',
  standalone: true,
  animations: [
    trigger('appear', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.5)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
    ]),
  ],
  template: `
    <div
      class="cell"
      [class.interactive]="interactive()"
      [class.winning]="winning()"
      (click)="interactive() ? cellClick.emit() : null"
    >
      @if (value() === 'X') {
        <svg viewBox="0 0 100 100" class="mark x-mark" @appear>
          <line x1="20" y1="20" x2="80" y2="80" />
          <line x1="80" y1="20" x2="20" y2="80" />
        </svg>
      }
      @if (value() === 'O') {
        <svg viewBox="0 0 100 100" class="mark o-mark" @appear>
          <circle cx="50" cy="50" r="30" />
        </svg>
      }
    </div>
  `,
  styles: [`
    .cell {
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #171717;
      border-radius: 12px;
      cursor: default;
      transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .cell.interactive {
      cursor: pointer;
    }
    .cell.interactive:hover {
      transform: scale(1.05);
      background: #1f1f1f;
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.05);
    }
    .cell.winning {
      box-shadow: 0 0 20px rgba(250, 204, 21, 0.4);
      background: #1a1a0a;
    }
    .mark {
      width: 60%;
      height: 60%;
    }
    .x-mark line {
      stroke: #22d3ee;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 85;
      stroke-dashoffset: 85;
      animation: draw-line 0.3s ease-out forwards;
    }
    .x-mark line:nth-child(2) {
      animation-delay: 0.1s;
    }
    .o-mark circle {
      fill: none;
      stroke: #fb7185;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-dasharray: 189;
      stroke-dashoffset: 189;
      animation: draw-line 0.3s ease-out forwards;
    }
    @keyframes draw-line {
      to { stroke-dashoffset: 0; }
    }
  `],
})
export class CellComponent {
  value = input<'X' | 'O' | null>(null);
  interactive = input(false);
  winning = input(false);
  cellClick = output<void>();
}
