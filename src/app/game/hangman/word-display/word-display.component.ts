import { Component, input } from '@angular/core';

@Component({
  selector: 'app-word-display',
  standalone: true,
  template: `
    <div class="word">
      @for (char of maskedWord().split(''); track $index) {
        <span class="letter-slot" [class.revealed]="char !== '_'">{{ char === '_' ? '\u00A0' : char }}</span>
      }
    </div>
  `,
  styles: [`.word { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; } .letter-slot { display: flex; align-items: center; justify-content: center; width: 2.2rem; height: 2.8rem; border-bottom: 2px solid #525252; font-size: 1.4rem; font-weight: 700; color: #e5e5e5; font-family: monospace; transition: border-color 0.2s; } .letter-slot.revealed { border-color: #22d3ee; color: #22d3ee; }`],
})
export class WordDisplayComponent {
  maskedWord = input.required<string>();
}
