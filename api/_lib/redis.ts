import { Redis } from '@upstash/redis';
import type { GameState, GameType } from './types.js';

export const redis = Redis.fromEnv();

const GAME_TTL = 3600; // 1 hour

export async function getGame(roomCode: string): Promise<GameState | null> {
  const data = await redis.get<GameState>(`game:${roomCode}`);
  return data;
}

export async function setGame(roomCode: string, state: GameState): Promise<void> {
  await redis.set(`game:${roomCode}`, state, { ex: GAME_TTL });
}

// --- Persistent Scoreboard ---

export interface ScoreboardEntry {
  [playerName: string]: number;
}

function scoreboardKey(gameType: GameType, name1: string, name2: string): string {
  const sorted = [name1.toLowerCase(), name2.toLowerCase()].sort();
  return `scoreboard:${gameType}:${sorted[0]}:${sorted[1]}`;
}

export async function getScoreboard(gameType: GameType, name1: string, name2: string): Promise<ScoreboardEntry | null> {
  const key = scoreboardKey(gameType, name1, name2);
  return redis.get<ScoreboardEntry>(key);
}

export async function recordWin(gameType: GameType, winnerName: string, loserName: string): Promise<ScoreboardEntry> {
  const key = scoreboardKey(gameType, winnerName, loserName);
  const existing = await redis.get<ScoreboardEntry>(key) ?? {};
  const wKey = winnerName.toLowerCase();
  const lKey = loserName.toLowerCase();
  existing[wKey] = (existing[wKey] ?? 0) + 1;
  if (!(lKey in existing)) existing[lKey] = 0;
  await redis.set(key, existing);
  return existing;
}

export async function setScoreboard(gameType: GameType, name1: string, name2: string, scores: ScoreboardEntry): Promise<void> {
  const key = scoreboardKey(gameType, name1, name2);
  await redis.set(key, scores);
}
