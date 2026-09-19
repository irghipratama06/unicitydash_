import { autoConnect } from '@unicitylabs/sphere-sdk/connect/browser';
import { SPHERE_NETWORKS } from '@unicitylabs/sphere-sdk/connect';

export type SphereSession = Awaited<ReturnType<typeof autoConnect>>;

export const UCT_COIN_ID = 'f581d30f593e4b369d684a4563b5246f07b1d265f7178a2c0a82b81f39c24dc0';
export const UCT_DECIMALS = 18;
export const DEPOSIT_UCT = '5';
export const DEPOSIT_BASE_UNITS = '5000000000000000000';
export const ATTEMPTS_PER_DEPOSIT = 20;
export const PAYMENT_RECIPIENT = import.meta.env.VITE_PAYMENT_RECIPIENT || '@uctdash';

export async function connectSphere(silent = false): Promise<SphereSession> {
  return autoConnect({
    dapp: {
      name: 'UCT DASH',
      description: 'Mobile Geometry Dash-style game on Unicity testnet2',
      url: location.origin,
    },
    walletUrl: 'https://sphere.unicity.network',
    network: SPHERE_NETWORKS.testnet2,
    permissions: ['identity:read', 'balance:read', 'transfer:request'],
    silent,
  });
}

export async function getBalance(session: SphereSession): Promise<string> {
  const assets = await session.client.query('sphere_getAssets') as Array<{
    symbol?: string;
    totalAmount?: string | number;
  }>;
  const uct = assets.find((asset) => asset.symbol === 'UCT');
  return String(uct?.totalAmount ?? '0');
}

export async function payDeposit(session: SphereSession) {
  return session.client.intent('send', {
    to: PAYMENT_RECIPIENT,
    amount: DEPOSIT_BASE_UNITS,
    coinId: UCT_COIN_ID,
    memo: 'UCT DASH — 20 attempts',
  });
}
