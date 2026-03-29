import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGame, setGame } from '../../_lib/redis.js';
import { getPlayerByToken } from '../../_lib/game-logic.js';
import { pickRandomWord, giveStartingLetter } from '../../_lib/hangman-logic.js';

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

  const player = getPlayerByToken(state, playerToken);
  if (!player) {
    return res.status(403).json({ error: 'Not a player in this game' });
  }

  if (state.status !== 'won' && state.status !== 'draw') {
    return res.status(400).json({ error: 'Game is still in progress' });
  }

  const { category: newCategory, language: newLanguage } = req.body as { category?: string; language?: string };

  // Ensure scores and usernames exist (for games created before this feature)
  if (!state.scores) state.scores = { X: 0, O: 0 };
  if (!state.usernames) state.usernames = { X: null, O: null };

  // Increment winner's score before resetting
  if (state.status === 'won' && state.winner) {
    state.scores[state.winner] += 1;
  }

  if (state.type === 'tictactoe') {
    state.board = Array(9).fill(null);
    state.currentTurn = state.currentTurn === 'X' ? 'O' : 'X';
    state.status = 'playing';
    state.winner = null;
    state.winLine = null;
    state.lastActivity = Date.now();
    await setGame(roomCode, state);
    return res.status(200).json({ ok: true });
  }

  if (state.type === 'hangman') {
    // Update language/category if provided and valid
    if (newLanguage === 'en' || newLanguage === 'el') {
      state.language = newLanguage;
    }
    if (newCategory && newCategory !== 'random') {
      const validCategories = ['animals', 'food', 'nature', 'body', 'home', 'places', 'sports', 'professions', 'clothing', 'music', 'other'];
      if (validCategories.includes(newCategory)) {
        state.category = newCategory as any;
      }
    } else if (newCategory === 'random') {
      // pick random category by not passing a category to pickRandomWord
      state.category = 'other'; // placeholder; word will be picked from all categories
    }
    state.word = pickRandomWord(state.language, newCategory === 'random' ? undefined : state.category);
    state.status = 'playing';
    state.winner = null;
    state.lastActivity = Date.now();
    state.playerState = {
      X: { guessedLetters: [], wrongGuesses: [], lives: 6, solved: false, solvedAt: null },
      O: { guessedLetters: [], wrongGuesses: [], lives: 6, solved: false, solvedAt: null },
    };
    giveStartingLetter(state);
    await setGame(roomCode, state);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown game type' });
}
