import { setScoreboard } from '../_lib/redis.js';

async function seed() {
  await setScoreboard('hangman', 'plagog', 'kaylee', {
    plagog: 37,
    kaylee: 25,
  });
  console.log('Seeded: hangman plagog(37) vs kaylee(25)');
}

seed().catch(console.error);
