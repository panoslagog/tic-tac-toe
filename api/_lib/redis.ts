import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const GAME_TTL = 3600; // 1 hour

export async function getGame(roomCode: string): Promise<import('./types').GameState | null> {
  const data = await redis.get<import('./types').GameState>(`game:${roomCode}`);
  return data;
}

export async function setGame(roomCode: string, state: import('./types').GameState): Promise<void> {
  await redis.set(`game:${roomCode}`, state, { ex: GAME_TTL });
}
