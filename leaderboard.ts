import { db, json, methodGuard, LEADERBOARD_KEY, playerKey } from '../lib/server';

export default async function handler(request: Request) {
  const blocked = methodGuard(request, 'GET');
  if (blocked) return blocked;
  try {
    const redis = db();
    const entries = await redis.zrange<string>(LEADERBOARD_KEY, 0, 49, { rev: true, withScores: true });
    const rows: Array<{ rank: number; wallet: string; distance: number; updatedAt: string }> = [];

    for (let i = 0; i < entries.length; i += 2) {
      const wallet = String(entries[i]);
      const distance = Number(entries[i + 1]);
      const player = await redis.hgetall<Record<string, string>>(playerKey(wallet));
      rows.push({
        rank: rows.length + 1,
        wallet,
        distance,
        updatedAt: player?.updatedAt ?? new Date().toISOString(),
      });
    }

    return json({ rows });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Leaderboard lookup failed.' }, 500);
  }
}
