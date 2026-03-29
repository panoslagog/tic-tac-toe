import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { validateMove, checkWinner, isDraw, getPlayerByToken, toTicTacToePublicState } from '../../_lib/game-logic.js';
import { normalizeInput, processLetterGuess, processWordGuess, resolveHangmanOutcome, toHangmanPublicState } from '../../_lib/hangman-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const roomCode = req.query.id as string;
  const playerToken = req.headers['x-player-token'] as string;

  if (!playerToken) {
    return res.status(401).json({ error: 'Missing player token' });
  }

  const state = await getGame(roomCode);
  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (state.status !== 'playing') {
    return res.status(400).json({ error: 'Game is not in progress' });
  }

  const player = getPlayerByToken(state, playerToken);
  if (!player) {
    return res.status(403).json({ error: 'Not a player in this game' });
  }

  if (state.type === 'tictactoe') {
    const { position } = req.body as { position: number };

    const error = validateMove(state, position, playerToken);
    if (error) {
      const statusCode = error === 'Not a player in this game' ? 403
        : error === 'Not your turn' ? 403
        : 400;
      return res.status(statusCode).json({ error });
    }

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
    return res.status(200).json(toTicTacToePublicState(state, playerToken));
  }

  if (state.type === 'hangman') {
    const body = req.body as { letter?: string; word?: string };

    if (state.playerState[player].lives <= 0) {
      return res.status(400).json({ error: 'No lives remaining' });
    }

    if (state.playerState[player].solved) {
      return res.status(400).json({ error: 'Already solved' });
    }

    let result: string;
    if (body.word) {
      const normalized = normalizeInput(body.word);
      result = processWordGuess(state, player, normalized);
    } else if (body.letter) {
      const normalized = normalizeInput(body.letter);
      if (normalized.length !== 1) {
        return res.status(400).json({ error: 'Letter must be a single character' });
      }
      result = processLetterGuess(state, player, normalized);
    } else {
      return res.status(400).json({ error: 'Must provide letter or word' });
    }

    state.lastActivity = Date.now();
    resolveHangmanOutcome(state);
    await setGame(roomCode, state);

    return res.status(200).json({
      result,
      ...toHangmanPublicState(state, playerToken),
    });
  }

  return res.status(400).json({ error: 'Unknown game type' });
}
