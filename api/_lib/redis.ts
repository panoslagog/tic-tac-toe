import { Redis } from '@upstash/redis';
import type { GameState } from './types.js';

export const redis = Redis.fromEnv();

const GAME_TTL = 3600; // 1 hour

export async function getGame(roomCode: string): Promise<GameState | null> {
  const data = await redis.get<GameState>(`game:${roomCode}`);
  return data;
}

export async function setGame(roomCode: string, state: GameState): Promise<void> {
  await redis.set(`game:${roomCode}`, state, { ex: GAME_TTL });
}
