export type Player = {
  attempts: number;
  bestDistance: number;
  rank: number | null;
};

export type LeaderboardRow = {
  rank: number;
  wallet: string;
  distance: number;
  updatedAt: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export function loadPlayer(wallet: string) {
  return request<Player>(`/api/player?wallet=${encodeURIComponent(wallet)}`);
}

export function loadLeaderboard() {
  return request<{ rows: LeaderboardRow[] }>('/api/leaderboard');
}

export function submitRun(payload: { wallet: string; distance: number; events: Array<{ t: number; type: 'jump' }> }) {
  return request<{ distance: number; bestDistance: number; attempts: number }>('/api/score', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function claimDeposit(payload: { wallet: string; transferId?: string }) {
  return request<{ attempts: number; added: number }>('/api/deposit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

