import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../_lib/redis.js';
import { createTicTacToeState, generateRoomCode } from '../_lib/game-logic.js';
import type { CreateGameResponse } from '../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type = 'tictactoe' } = req.body as { type?: string };

  if (type !== 'tictactoe') {
    return res.status(400).json({ error: `Unknown game type: ${type}` });
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
  const state = createTicTacToeState(playerToken);
  await setGame(roomCode, state);

  const response: CreateGameResponse = {
    roomCode,
    playerToken,
    player: 'X',
  };
  return res.status(201).json(response);
}
