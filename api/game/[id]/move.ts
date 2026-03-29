import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { validateMove, checkWinner, isDraw, getPlayerByToken, toPublicState } from '../../_lib/game-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;
  const { position } = req.body as { position: number };

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const error = validateMove(state, position, playerToken);
  if (error) {
    const statusCode = error === 'Not a player in this game' ? 403
      : error === 'Not your turn' ? 403
      : 400;
    return res.status(statusCode).json({ error });
  }

  const player = getPlayerByToken(state, playerToken)!;
  state.board[position] = player;
  state.lastActivity = Date.now();

  const winResult = checkWinner(state.board);
  if (winResult) {
    state.status = 'won';
    state.winner = winResult.winner;
    state.winLine = winResult.winLine;
  } else if (isDraw(state.board)) {
    state.status = 'draw';
  } else {
    state.currentTurn = player === 'X' ? 'O' : 'X';
  }

  await setGame(roomCode, state);
  return res.status(200).json(toPublicState(state, playerToken));
}
