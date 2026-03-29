import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { getGame, setGame } from '../../_lib/redis.js';
import { giveStartingLetter } from '../../_lib/hangman-logic.js';
import type { JoinGameResponse } from '../../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const state = await getGame(roomCode);

  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (state.players.O) {
    return res.status(400).json({ error: 'Game is full' });
  }

  const playerToken = uuidv4();
  state.players.O = playerToken;
  state.status = 'playing';
  state.lastActivity = Date.now();
  if (state.type === 'hangman') {
    giveStartingLetter(state);
  }
  await setGame(roomCode, state);

  const response: JoinGameResponse = {
    playerToken,
    player: 'O',
    type: state.type,
  };
  return res.status(200).json(response);
}
