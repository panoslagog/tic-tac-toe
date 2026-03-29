import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCategoryWordCounts } from '../_lib/hangman-logic.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({
    en: getCategoryWordCounts('en'),
    el: getCategoryWordCounts('el'),
  });
}
