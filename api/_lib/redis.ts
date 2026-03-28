import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();

const GAME_TTL = 3600; // 1 hour

export async function getGame(roomCode: string): Promise<import('./types').GameState | null> {
  const data = await redis.get<import('./types').GameState>(`game:${roomCode}`);
  return data;
}

export async function setGame(roomCode: string, state: import('./types').GameState): Promise<void> {
  await redis.set(`game:${roomCode}`, state, { ex: GAME_TTL });
}
