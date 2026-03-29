import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame } from '../../_lib/redis.js';
import { toTicTacToePublicState } from '../../_lib/game-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const state = await getGame(roomCode);

  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const playerToken = req.headers['x-player-token'] as string | undefined;

  if (state.type === 'tictactoe') {
    return res.status(200).json(toTicTacToePublicState(state, playerToken ?? null));
  }

  return res.status(400).json({ error: `Unknown game type: ${state.type}` });
}
