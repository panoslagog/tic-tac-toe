import { Component, input, output, computed } from '@angular/core';

const EN_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const EL_KEYS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'.split('');

@Component({
  selector: 'app-keyboard',
  standalone: true,
  template: `
    <div class="keyboard">
      @for (key of keys(); track key) {
        <button class="key" [class.correct]="correctSet().has(key)" [class.wrong]="wrongSet().has(key)" [disabled]="guessedSet().has(key) || !interactive()" (click)="letterClicked.emit(key)">{{ key }}</button>
      }
    </div>
  `,
  styles: [`.keyboard { display: flex; flex-wrap: wrap; gap: 0.35rem; justify-content: center; max-width: 380px; } .key { min-width: 2rem; height: 2.4rem; border: 1px solid #333; border-radius: 6px; background: #171717; color: #e5e5e5; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; } .key:hover:not(:disabled) { border-color: #525252; background: #262626; } .key:disabled { opacity: 0.3; cursor: not-allowed; } .key.correct { border-color: #22d3ee; color: #22d3ee; background: rgba(34, 211, 238, 0.1); } .key.wrong { border-color: #f87171; color: #f87171; background: rgba(248, 113, 113, 0.1); }`],
})
export class KeyboardComponent {
  language = input.required<'en' | 'el'>();
  guessedLetters = input.required<string[]>();
  wrongGuesses = input.required<string[]>();
  interactive = input.required<boolean>();
  letterClicked = output<string>();

  keys = computed(() => this.language() === 'el' ? EL_KEYS : EN_KEYS);
  guessedSet = computed(() => new Set(this.guessedLetters()));
  wrongSet = computed(() => new Set(this.wrongGuesses()));
  correctSet = computed(() => {
    const guessed = new Set(this.guessedLetters());
    const wrong = new Set(this.wrongGuesses());
    return new Set([...guessed].filter(l => !wrong.has(l)));
  });
}
