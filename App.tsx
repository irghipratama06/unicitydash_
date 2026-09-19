import { useCallback, useEffect, useRef, useState } from 'react';
import type { SphereSession } from './sphere';
import {
  ATTEMPTS_PER_DEPOSIT,
  DEPOSIT_UCT,
  connectSphere,
  getBalance,
  payDeposit,
  PAYMENT_RECIPIENT,
} from './sphere';
import { claimDeposit, loadLeaderboard, loadPlayer, submitRun, type LeaderboardRow, type Player } from './api';
import { DashGame, type GameState } from './game';

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export default function App() {
  const [session, setSession] = useState<SphereSession | null>(null);
  const [wallet, setWallet] = useState('');
  const [player, setPlayer] = useState<Player>({ attempts: 0, bestDistance: 0, rank: null });
  const [balance, setBalance] = useState('0');
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [message, setMessage] = useState('Connect your Sphere wallet to start.');
  const [busy, setBusy] = useState(false);
  const [gameState, setGameState] = useState<GameState>({ distance: 0, alive: false, started: false, events: [] });
  const gameRef = useRef<DashGame | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const result = await loadLeaderboard();
      setLeaderboard(result.rows);
    } catch {
      // The game still works if the leaderboard backend is temporarily unavailable.
    }
  }, []);

  const refreshPlayer = useCallback(async (address: string) => {
    const data = await loadPlayer(address);
    setPlayer(data);
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage('Opening Sphere Connect…');
    try {
      const next = await connectSphere(false);
      const address = next.connection.identity?.chainPubkey ?? '';
      if (!address) throw new Error('Sphere did not return a wallet identity.');
      setSession(next);
      setWallet(address);
      const [p, b] = await Promise.all([refreshPlayer(address), getBalance(next)]);
      setPlayer(p);
      setBalance(b);
      setMessage('Wallet connected. You need 20 attempts to play.');
      void refreshLeaderboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Wallet connection failed.');
    } finally {
      setBusy(false);
    }
  };

  const creditDeposit = async (transferId: string) => {
    if (!wallet) return;
    setBusy(true);
    setMessage('Crediting your 20 attempts…');
    try {
      const credited = await claimDeposit({ wallet, transferId });
      setPlayer((old) => ({ ...old, attempts: credited.attempts }));
      setMessage(credited.added > 0 ? `Payment confirmed. +${credited.added} attempts.` : 'This payment was already credited.');
      if (session) setBalance(await getBalance(session));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not credit the payment.');
    } finally {
      setBusy(false);
    }
  };

  const deposit = async () => {
    if (!session || !wallet) return;
    setBusy(true);
    setMessage(`Confirm ${DEPOSIT_UCT} UCT in Sphere…`);
    try {
      const result = await payDeposit(session);
      const transferId = String((result as { transferId?: string; id?: string }).transferId ?? (result as { id?: string }).id ?? '');
      if (!transferId) throw new Error('Sphere did not return a payment id.');
      await creditDeposit(transferId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment was cancelled or failed.');
    } finally {
      setBusy(false);
    }
  };

  const startGame = () => {
    if (!session) return setMessage('Connect your Sphere wallet first.');
    if (player.attempts <= 0) return setMessage('No attempts left. Deposit 5 UCT for 20 attempts.');
    if (!gameRef.current || !canvasRef.current || !imageRef.current) return;
    setMessage('Tap the game area to jump.');
    gameRef.current.start();
  };

  const handleGameOver = async (state: GameState) => {
    if (!wallet) return;
    setGameState(state);
    try {
      const result = await submitRun({ wallet, distance: state.distance, events: state.events });
      setPlayer((old) => ({ ...old, attempts: result.attempts, bestDistance: result.bestDistance }));
      setMessage(`GAME OVER — ${state.distance}m. ${result.attempts} attempts left.`);
      void refreshLeaderboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the run.');
    }
  };

  useEffect(() => { refreshLeaderboard(); }, [refreshLeaderboard]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const image = new Image();
    image.src = '/character.jpeg';
    image.onload = () => {
      imageRef.current = image;
      const game = new DashGame(canvasRef.current!, image, setGameState, handleGameOver);
      gameRef.current = game;
    };
    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
      image.onload = null;
    };
    // Game creation only needs the mounted canvas; the image is loaded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        gameRef.current?.jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">UNICITY TESTNET2 · SPHERE</div>
          <h1>UCT DASH</h1>
        </div>
        <button className="wallet-button" onClick={connect} disabled={busy}>
          {session ? `● ${short(wallet)}` : 'CONNECT SPHERE'}
        </button>
      </header>

      <section className="hero">
        <div className="hud-card">
          <span>ATTEMPTS</span>
          <strong>{player.attempts}</strong>
        </div>
        <div className="hud-card">
          <span>BEST</span>
          <strong>{player.bestDistance}m</strong>
        </div>
        <div className="hud-card">
          <span>BALANCE</span>
          <strong>{Number(balance).toLocaleString()} UCT</strong>
        </div>
      </section>

      <section className="game-panel">
        <div className="game-labels">
          <span>{gameState.started && gameState.alive ? 'RUNNING' : 'READY'}</span>
          <span>{gameState.distance}m</span>
        </div>
        <div
          className="canvas-wrap"
          onPointerDown={() => gameRef.current?.jump()}
          role="button"
          tabIndex={0}
          aria-label="Game area. Tap to jump."
        >
          <canvas ref={canvasRef} />
          <img
            ref={imageRef}
            src="/character.jpeg"
            alt="UCT DASH character"
            className="preload-character"
            onLoad={() => setGameState((old) => old)}
          />
          {!gameState.started && (
            <div className="game-overlay">
              <div className="overlay-card">
                <span className="mini-tag">{session ? 'WALLET READY' : 'WALLET REQUIRED'}</span>
                <h2>RUN. JUMP. DON’T CRASH.</h2>
                <p>{session ? 'Each game over consumes 1 real attempt.' : 'Connect Sphere before you can play.'}</p>
                <button onClick={startGame} disabled={!session || player.attempts <= 0 || busy}>
                  {player.attempts > 0 ? 'START RUN' : 'DEPOSIT 5 UCT'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mobile-hint">TAP / CLICK TO JUMP · SPACE / ↑ ON DESKTOP</div>
      </section>

      <section className="action-row">
        <button className="deposit-button" onClick={deposit} disabled={!session || busy}>
          {busy ? 'WAIT…' : `DEPOSIT ${DEPOSIT_UCT} UCT → +${ATTEMPTS_PER_DEPOSIT} ATTEMPTS`}
        </button>
        <span className="status">{message}</span>
        <small className="payment-note">5 UCT → {PAYMENT_RECIPIENT}</small>
      </section>

      <section className="leaderboard-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">LIVE LEADERBOARD</div>
            <h2>LEADERBOARD</h2>
          </div>
          <span>LONGEST VERIFIED RUNS</span>
        </div>
        <div className="leaderboard">
          {leaderboard.length === 0 ? <div className="empty">No completed runs yet.</div> : leaderboard.map((row) => (
            <div className="leader-row" key={`${row.wallet}-${row.rank}`}>
              <b>#{row.rank}</b>
              <span>{short(row.wallet)}</span>
              <strong>{row.distance}m</strong>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <span>UCT DASH · testnet only</span>
        <span>5 UCT = 20 attempts</span>
      </footer>
    </main>
  );
}
