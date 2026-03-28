import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-win-line',
  standalone: true,
  template: `
    @if (coords()) {
      <svg class="win-line-svg" viewBox="0 0 3 3" preserveAspectRatio="xMidYMid meet">
        <line
          [attr.x1]="coords()!.x1"
          [attr.y1]="coords()!.y1"
          [attr.x2]="coords()!.x2"
          [attr.y2]="coords()!.y2"
          stroke="#facc15"
          stroke-width="0.12"
          stroke-linecap="round"
          class="win-stroke"
        />
      </svg>
    }
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .win-line-svg {
      width: 100%;
      height: 100%;
    }
    .win-stroke {
      stroke-dasharray: 4.3;
      stroke-dashoffset: 4.3;
      animation: draw-win 0.5s ease-out 0.2s forwards;
    }
    @keyframes draw-win {
      to { stroke-dashoffset: 0; }
    }
  `],
})
export class WinLineComponent {
  winLine = input<number[] | null>(null);

  coords = computed(() => {
    const line = this.winLine();
    if (!line || line.length !== 3) return null;

    const getCenter = (idx: number) => ({
      x: (idx % 3) + 0.5,
      y: Math.floor(idx / 3) + 0.5,
    });

    const start = getCenter(line[0]);
    const end = getCenter(line[2]);

    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  });
}
