import { db, json, methodGuard, playerKey, LEADERBOARD_KEY } from '../lib/server';

export default async function handler(request: Request) {
  const blocked = methodGuard(request, 'GET');
  if (blocked) return blocked;
  try {
    const wallet = new URL(request.url).searchParams.get('wallet')?.trim();
    if (!wallet || wallet.length < 20) return json({ error: 'Invalid wallet.' }, 400);

    const redis = db();
    const [player, rank] = await Promise.all([
      redis.hgetall<Record<string, string>>(playerKey(wallet)),
      redis.zrevrank(LEADERBOARD_KEY, wallet),
    ]);

    return json({
      attempts: Number(player?.attempts ?? 0),
      bestDistance: Number(player?.bestDistance ?? 0),
      rank: rank == null ? null : rank + 1,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Player lookup failed.' }, 500);
  }
}
