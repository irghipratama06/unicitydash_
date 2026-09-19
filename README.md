# UCT DASH — Sphere Testnet Game (No Supabase, No Treasury Mnemonic)

Mobile-first Geometry Dash-style runner using the supplied character image, Sphere Connect, real UCT testnet payment confirmation in the user's wallet, and a Redis-backed global leaderboard.

## What this version uses

- Vite + React frontend
- Vercel Functions backend
- Sphere Connect on testnet2
- 5 UCT = 20 attempts
- The player confirms the payment in their own Sphere wallet
- **No treasury private key, no mnemonic, no Supabase**
- Upstash Redis for attempts, scores and leaderboard

## Only public payment configuration

The game sends 5 UCT to a **public Sphere recipient**. A public recipient is safe to expose; it is not a private key.

Set this Vercel environment variable if you want to use your own recipient:

`VITE_PAYMENT_RECIPIENT` = your Sphere nametag or direct public address

Example:

`@your-game-wallet`

You can also set `PAYMENT_RECIPIENT` for the Vercel API, but the frontend value is normally enough. **Never put a mnemonic, seed phrase, private key, or service secret in this variable.**

The project defaults to `@uctdash` as a placeholder. If that nametag is not registered, payments will fail until you replace it with a valid recipient.

## Redis

Connect Upstash Redis through Vercel Marketplace. Vercel provides:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

No Supabase or SQL setup is required.

## Payment flow

1. Player connects Sphere.
2. Player taps **DEPOSIT 5 UCT**.
3. Sphere opens its own confirmation UI.
4. The player approves the transfer to the public game recipient.
5. After Sphere reports a successful transfer, the game credits 20 attempts.
6. The same transfer id cannot be credited twice.

This design deliberately does **not** put a treasury wallet or recovery phrase on Vercel. The dApp is only a payment initiator; the user's Sphere wallet remains the signer.

### Security note

Because there is no server-side treasury wallet, the Vercel backend cannot independently inspect the recipient wallet and certify the transfer. The credit endpoint is idempotent and keyed by the transfer id returned by Sphere, but this is not a trustless payment verifier. For a stronger production-grade payment gate, the next step would be an on-chain/payment-verification service or a dedicated merchant wallet service that never exposes a private key to Vercel.

## Deploy from a phone

1. Upload this project to GitHub.
2. Vercel → Add New → Project → import the repository.
3. **Application Preset: Vite**.
4. **Root Directory: `./`** if `package.json` is at repository root.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Add `VITE_PAYMENT_RECIPIENT` with your **public** Sphere recipient.
8. Connect Upstash Redis from Vercel Marketplace.
9. Deploy.

No `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `TREASURY_MNEMONIC` is required.

## Leaderboard

Scores are stored in Redis and ranked by each player's actual best submitted run distance. The list is not hard-coded. Attempts are consumed server-side when a run is submitted. Browser physics remain client-side, so this is not a cryptographic anti-cheat system.

## Official references

- Sphere SDK: https://github.com/unicity-sphere/sphere-sdk
- Sphere Connect examples: https://github.com/unicity-sphere/sphere-sdk-connect-example
- Sphere wallet: https://sphere.unicity.network/
