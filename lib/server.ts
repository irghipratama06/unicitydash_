import { Redis } from '@upstash/redis';

export const ATTEMPTS_PER_DEPOSIT = 20;
export const DEPOSIT_BASE_UNITS = '5000000000000000000';
export const UCT_COIN_ID = 'f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0';

let redisClient: Redis | null = null;

export function db() {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Upstash Redis is not connected. Add Upstash Redis from Vercel Marketplace.');
    redisClient = new Redis({ url, token, enableTelemetry: false });
  }
  return redisClient;
}

export function playerKey(wallet: string) {
  return `uctdash:player:${wallet}`;
}

export const LEADERBOARD_KEY = 'uctdash:leaderboard';
export const RUNS_KEY = 'uctdash:runs';

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function methodGuard(request: Request, expected: string) {
  if (request.method !== expected) return json({ error: 'Method not allowed' }, 405);
  return null;
}
