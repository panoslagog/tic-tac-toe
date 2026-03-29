import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-gallows',
  standalone: true,
  template: `
    <svg viewBox="0 0 200 220" class="gallows">
      <line x1="20" y1="200" x2="180" y2="200" stroke="#525252" stroke-width="3" stroke-linecap="round"/>
      <line x1="60" y1="200" x2="60" y2="20" stroke="#525252" stroke-width="3" stroke-linecap="round"/>
      <line x1="60" y1="20" x2="140" y2="20" stroke="#525252" stroke-width="3" stroke-linecap="round"/>
      <line x1="140" y1="20" x2="140" y2="45" stroke="#525252" stroke-width="2" stroke-linecap="round"/>
      @if (parts() >= 1) { <circle cx="140" cy="60" r="15" stroke="#e5e5e5" stroke-width="2" fill="none" class="part"/> }
      @if (parts() >= 2) { <line x1="140" y1="75" x2="140" y2="125" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/> }
      @if (parts() >= 3) { <line x1="140" y1="90" x2="115" y2="110" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/> }
      @if (parts() >= 4) { <line x1="140" y1="90" x2="165" y2="110" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/> }
      @if (parts() >= 5) { <line x1="140" y1="125" x2="115" y2="155" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/> }
      @if (parts() >= 6) { <line x1="140" y1="125" x2="165" y2="155" stroke="#e5e5e5" stroke-width="2" stroke-linecap="round" class="part"/> }
    </svg>
  `,
  styles: [`.gallows { width: 180px; height: 200px; } .part { animation: fadeIn 0.3s ease-in; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`],
})
export class GallowsComponent {
  lives = input.required<number>();
  parts = computed(() => 6 - this.lives());
}
