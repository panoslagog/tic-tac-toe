import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../_lib/redis';
import { createInitialState, generateRoomCode } from '../_lib/game-logic';
import type { CreateGameResponse } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let roomCode: string;
  let attempts = 0;
  do {
    roomCode = generateRoomCode();
    const existing = await getGame(roomCode);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    return res.status(500).json({ error: 'Could not generate unique room code' });
  }

  const playerToken = uuidv4();
  const state = createInitialState(playerToken);
  await setGame(roomCode, state);

  const response: CreateGameResponse = {
    roomCode,
    playerToken,
    player: 'X',
  };
  return res.status(201).json(response);
}
