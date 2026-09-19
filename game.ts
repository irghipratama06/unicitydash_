export type JumpEvent = { t: number; type: 'jump' };

export type GameState = {
  distance: number;
  alive: boolean;
  started: boolean;
  events: JumpEvent[];
};

type Obstacle = { x: number; w: number; h: number; passed?: boolean };

const WORLD_WIDTH = 960;
const GROUND_Y = 350;
const PLAYER_SIZE = 42;
const GRAVITY = 0.00195;
const JUMP_VELOCITY = -0.72;
const BASE_SPEED = 0.36;

export class DashGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement;
  private raf = 0;
  private last = 0;
  private x = 135;
  private y = GROUND_Y - PLAYER_SIZE;
  private vy = 0;
  private speed = BASE_SPEED;
  private worldX = 0;
  private distance = 0;
  private alive = false;
  private started = false;
  private obstacles: Obstacle[] = [];
  private events: JumpEvent[] = [];
  private onUpdate: (state: GameState) => void;
  private onGameOver: (state: GameState) => void;

  constructor(
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    onUpdate: (state: GameState) => void,
    onGameOver: (state: GameState) => void,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.image = image;
    this.onUpdate = onUpdate;
    this.onGameOver = onGameOver;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.clientWidth || WORLD_WIDTH;
    const height = this.canvas.clientHeight || 430;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  start() {
    this.started = true;
    this.alive = true;
    this.last = performance.now();
    this.spawnInitial();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
    this.onUpdate(this.snapshot());
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.started = false;
    this.alive = false;
  }

  jump() {
    if (!this.started || !this.alive) return;
    const onGround = this.y >= GROUND_Y - PLAYER_SIZE - 0.5;
    if (!onGround) return;
    this.vy = JUMP_VELOCITY;
    this.events.push({ t: Math.round(performance.now()), type: 'jump' });
  }

  snapshot(): GameState {
    return {
      distance: Math.floor(this.distance),
      alive: this.alive,
      started: this.started,
      events: [...this.events],
    };
  }

  private spawnInitial() {
    this.obstacles = [];
    this.worldX = 0;
    this.distance = 0;
    this.speed = BASE_SPEED;
    this.y = GROUND_Y - PLAYER_SIZE;
    this.vy = 0;
    this.events = [];
    for (let i = 0; i < 10; i++) this.spawnObstacle(430 + i * 220 + Math.random() * 120);
  }

  private spawnObstacle(x: number) {
    const h = 30 + Math.floor(Math.random() * 58);
    this.obstacles.push({ x, w: 34 + Math.floor(Math.random() * 22), h });
  }

  private frame = (now: number) => {
    if (!this.started) return;
    const dt = Math.min(32, now - this.last || 16);
    this.last = now;
    this.update(dt);
    this.draw();
    this.onUpdate(this.snapshot());
    if (this.alive) this.raf = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    this.speed = Math.min(0.62, BASE_SPEED + this.distance / 25000);
    this.worldX += this.speed * dt;
    this.distance += this.speed * dt * 0.1;
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.y > GROUND_Y - PLAYER_SIZE) {
      this.y = GROUND_Y - PLAYER_SIZE;
      this.vy = 0;
    }

    const viewportStart = this.worldX;
    for (const obstacle of this.obstacles) {
      const screenX = obstacle.x - viewportStart + this.x;
      if (screenX < -100) obstacle.passed = true;
      if (screenX > 1000) obstacle.passed = false;
      if (screenX < 750) {
        const playerLeft = this.x + 7;
        const playerRight = this.x + PLAYER_SIZE - 7;
        const playerBottom = this.y + PLAYER_SIZE;
        const obstacleTop = GROUND_Y - obstacle.h;
        const horizontal = playerRight > screenX && playerLeft < screenX + obstacle.w;
        const vertical = playerBottom > obstacleTop + 3 && this.y + 7 < GROUND_Y;
        if (horizontal && vertical) {
          this.gameOver();
          return;
        }
      }
    }

    const last = this.obstacles[this.obstacles.length - 1];
    if (last && last.x - this.worldX < 850) {
      this.spawnObstacle(last.x + 190 + Math.random() * 140);
    }
    this.obstacles = this.obstacles.filter((o) => o.x > this.worldX - 160);
  }

  private gameOver() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.onGameOver(this.snapshot());
  }

  private draw() {
    const w = this.canvas.clientWidth || WORLD_WIDTH;
    const h = this.canvas.clientHeight || 430;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#242432');
    gradient.addColorStop(1, '#111116');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let gx = -((this.worldX * 0.3) % 48); gx < w; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#f26b21';
    ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
    ctx.fillStyle = '#ff8b2c';
    ctx.fillRect(0, GROUND_Y, w, 4);

    for (const obstacle of this.obstacles) {
      const sx = obstacle.x - this.worldX + this.x;
      if (sx < -100 || sx > w + 100) continue;
      ctx.fillStyle = '#f7f7f7';
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y);
      ctx.lineTo(sx + obstacle.w / 2, GROUND_Y - obstacle.h);
      ctx.lineTo(sx + obstacle.w, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, this.x, this.y, PLAYER_SIZE, PLAYER_SIZE);
    ctx.restore();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }
}
