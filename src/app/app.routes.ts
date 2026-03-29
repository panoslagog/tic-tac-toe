import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'game/tictactoe/:roomCode', loadComponent: () => import('./game/tictactoe/tictactoe-game.component').then(m => m.TicTacToeGameComponent) },
  { path: 'game/hangman/:roomCode', loadComponent: () => import('./game/hangman/hangman-game.component').then(m => m.HangmanGameComponent) },
  { path: 'join/:roomCode', loadComponent: () => import('./join/join.component').then(m => m.JoinComponent) },
];
