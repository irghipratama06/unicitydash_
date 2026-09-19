import { db, json, methodGuard, playerKey, LEADERBOARD_KEY, RUNS_KEY } from '../lib/server';

function validateRun(distance: number, events: unknown) {
  if (!Number.isFinite(distance) || distance < 0 || distance > 250000) return false;
  if (!Array.isArray(events) || events.length > 1500) return false;
  let previous = -Infinity;
  for (const event of events) {
    const t = Number((event as any)?.t);
    if (!Number.isFinite(t) || t < previous + 90) return false;
    previous = t;
  }
  return true;
}

const SUBMIT_RUN_SCRIPT = `
local playerKey = KEYS[1]
local leaderboardKey = KEYS[2]
local currentAttempts = tonumber(redis.call('HGET', playerKey, 'attempts') or '0')
if currentAttempts <= 0 then
  return {-1, 0, tonumber(redis.call('HGET', playerKey, 'bestDistance') or '0')}
end
local distance = tonumber(ARGV[1])
local best = tonumber(redis.call('HGET', playerKey, 'bestDistance') or '0')
if distance > best then best = distance end
local nextAttempts = currentAttempts - 1
redis.call('HSET', playerKey, 'attempts', nextAttempts, 'bestDistance', best, 'updatedAt', ARGV[2])
redis.call('ZADD', leaderboardKey, best, ARGV[3])
return {1, nextAttempts, best}
`;

export default async function handler(request: Request) {
  const blocked = methodGuard(request, 'POST');
  if (blocked) return blocked;
  try {
    const body = await request.json();
    const wallet = String(body.wallet ?? '').trim();
    const distance = Math.floor(Number(body.distance));
    const events = body.events;
    if (!wallet || wallet.length < 20 || !validateRun(distance, events)) return json({ error: 'Invalid run payload.' }, 400);

    const redis = db();
    const now = new Date().toISOString();
    const result = await redis.eval<number[]>(SUBMIT_RUN_SCRIPT, [playerKey(wallet), LEADERBOARD_KEY], [distance, now, wallet]);
    if (Number(result?.[0]) === -1) return json({ error: 'No attempts remaining.' }, 409);

    const run = JSON.stringify({ wallet, distance, jumpCount: events.length, at: now });
    await redis.lpush(RUNS_KEY, run);
    await redis.ltrim(RUNS_KEY, 0, 999);

    return json({ distance, bestDistance: Number(result?.[2] ?? distance), attempts: Number(result?.[1] ?? 0) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Score submission failed.' }, 500);
  }
}
