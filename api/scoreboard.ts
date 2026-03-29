import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getScoreboard, setScoreboard } from './_lib/redis.js';
import type { GameType } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { type, player1, player2 } = req.query as { type?: string; player1?: string; player2?: string };

    if (!type || !player1 || !player2) {
      return res.status(400).json({ error: 'Missing type, player1, or player2' });
    }

    if (type !== 'tictactoe' && type !== 'hangman') {
      return res.status(400).json({ error: 'Invalid game type' });
    }

    const scores = await getScoreboard(type as GameType, player1, player2);
    return res.status(200).json(scores ?? {});
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
