import { Component, input, output } from '@angular/core';
import { CellComponent } from '../cell/cell.component';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CellComponent],
  template: `
    <div class="board">
      @for (cell of board(); track $index) {
        <app-cell
          [value]="cell"
          [interactive]="interactive() && cell === null"
          [winning]="isWinningCell($index)"
          (cellClick)="cellClicked.emit($index)"
        />
      }
    </div>
  `,
  styles: [`
    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      width: 100%;
      max-width: 360px;
      padding: 8px;
      background: #262626;
      border-radius: 16px;
    }
  `],
})
export class BoardComponent {
  board = input<('X' | 'O' | null)[]>(Array(9).fill(null));
  interactive = input(false);
  winLine = input<number[] | null>(null);
  cellClicked = output<number>();

  isWinningCell(index: number): boolean {
    return this.winLine()?.includes(index) ?? false;
  }
}
