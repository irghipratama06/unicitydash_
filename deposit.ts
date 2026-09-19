import { db, json, methodGuard, ATTEMPTS_PER_DEPOSIT, playerKey } from '../lib/server';

const CREDIT_DEPOSIT_SCRIPT = `
local depositKey = KEYS[1]
local playerKey = KEYS[2]
if redis.call('EXISTS', depositKey) == 1 then
  return {0, tonumber(redis.call('HGET', playerKey, 'attempts') or '0')}
end
redis.call('SET', depositKey, '1')
local current = tonumber(redis.call('HGET', playerKey, 'attempts') or '0')
local nextAttempts = current + tonumber(ARGV[1])
redis.call('HSET', playerKey, 'attempts', nextAttempts, 'updatedAt', ARGV[2])
return {1, nextAttempts}
`;

export default async function handler(request: Request) {
  const blocked = methodGuard(request, 'POST');
  if (blocked) return blocked;
  try {
    const body = await request.json();
    const wallet = String(body.wallet ?? '').trim();
    const transferId = String(body.transferId ?? '').trim();
    if (!wallet || wallet.length < 20 || !transferId || transferId.length < 8) {
      return json({ error: 'Missing wallet or payment transaction id.' }, 400);
    }

    // The wallet itself performs and confirms the UCT transfer through Sphere Connect.
    // The backend only makes the credit idempotent; it does not hold a treasury key.
    const redis = db();
    const result = await redis.eval<number[]>(CREDIT_DEPOSIT_SCRIPT, [
      `uctdash:deposit:${transferId}`,
      playerKey(wallet),
    ], [ATTEMPTS_PER_DEPOSIT, new Date().toISOString()]);

    const added = Number(result?.[0] ?? 0) === 1 ? ATTEMPTS_PER_DEPOSIT : 0;
    return json({ attempts: Number(result?.[1] ?? 0), added });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Deposit credit failed.' }, 500);
  }
}
