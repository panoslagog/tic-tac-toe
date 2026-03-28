import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'game/:roomCode', loadComponent: () => import('./game/game.component').then(m => m.GameComponent) },
];
