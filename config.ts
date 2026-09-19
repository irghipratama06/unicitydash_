import { json, methodGuard } from '../lib/server';

const recipient = process.env.PAYMENT_RECIPIENT || process.env.VITE_PAYMENT_RECIPIENT || '@uctdash';

export default async function handler(request: Request) {
  const blocked = methodGuard(request, 'GET');
  if (blocked) return blocked;
  return json({ recipient });
}
