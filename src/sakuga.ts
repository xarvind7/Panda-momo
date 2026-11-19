export type SakugaKind = 'primary' | 'secondary' | 'spark' | 'smoke' | 'star' | 'slash';

export interface SakugaPoint {
  x: number;
  y: number;
}

export interface SakugaToastItem {
  id: number;
  message: string;
  sfx: string;
  tone: 'gold' | 'green' | 'red';
}

interface BurstEffect {
  kind: SakugaKind;
  x: number;
  y: number;
  start: number;
  duration: number;
  sfx?: string;
  seed: number;
  palette: {
    ink: string;
    accent: string;
    flash: string;
    smoke: string;
  };
  sparks: Array<{
    angle: number;
    dist: number;
    size: number;
    len: number;
    color: string;
    shape: 'spike' | 'shard' | 'star' | 'line';
  }>;
  puffs: Array<{
    angle: number;
    dist: number;
    r: number;
    delay: number;
  }>;
}

const activeEffects: BurstEffect[] = [];
let canvasEl: HTMLCanvasElement | null = null;
let rafId: number | null = null;

// Toast pub/sub
let toasts: SakugaToastItem[] = [];
const toastListeners = new Set<() => void>();

function emitToasts(): void {
  for (const fn of toastListeners) fn();
}

export function getToasts(): SakugaToastItem[] {
  return toasts;
}

export function subscribeToasts(fn: () => void): () => void {
  toastListeners.add(fn);
  return () => {
    toastListeners.delete(fn);
  };
}

export function showSakugaToast(
  message: string,
  tone: SakugaToastItem['tone'] = 'gold',
  sfx = 'DON!'
): void {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  toasts = [...toasts.slice(-2), { id, message, tone, sfx }];
  emitToasts();
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      emitToasts();
    }, 2600);
  }
}

export function dismissSakugaToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function pickPalette(dark: boolean, kind: SakugaKind): BurstEffect['palette'] {
  if (kind === 'star') {
    return {
      ink: '#1B1A4A',
      accent: '#FFB81C',
      flash: '#FF5C8A',
      smoke: '#FFF5D1',
    };
  }
  if (dark) {
    return {
      ink: '#1B1A4A',
      accent: '#FFB81C',
      flash: '#FF5C8A',
      smoke: '#E5E2FF',
    };
  }
  return {
    ink: '#1B1A4A',
    accent: '#9B8CFF',
    flash: '#FF4F7B',
    smoke: '#FFFFFF',
  };
}

export function createBurstEffect(
  point: SakugaPoint,
  kind: SakugaKind,
  opts?: { sfx?: string; dark?: boolean; now?: number }
): BurstEffect {
  const now = opts?.now ?? performance.now();
  const palette = pickPalette(Boolean(opts?.dark), kind);
  const seed = Math.random() * 1000;

  const sparkCount =
    kind === 'primary' ? 16 : kind === 'star' ? 12 : kind === 'slash' ? 10 : 8;
  const puffCount =
    kind === 'primary' ? 7 : kind === 'smoke' ? 6 : kind === 'secondary' ? 4 : 3;

  const sparks: BurstEffect['sparks'] = [];
  for (let i = 0; i < sparkCount; i++) {
    const baseAngle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.28;
    const isFlash = i % 3 === 0;
    sparks.push({
      angle: baseAngle,
      dist:
        (kind === 'primary' ? 54 : kind === 'star' ? 44 : 32) +
        Math.random() * (kind === 'primary' ? 42 : 24),
      size: (kind === 'primary' ? 10 : 7) + Math.random() * 7,
      len: (kind === 'primary' ? 28 : 18) + Math.random() * 20,
      color: isFlash ? palette.flash : i % 2 === 0 ? palette.accent : '#FFB81C',
      shape:
        kind === 'star'
          ? 'star'
          : i % 4 === 0
          ? 'line'
          : i % 3 === 0
          ? 'shard'
          : 'spike',
    });
  }

  const puffs: BurstEffect['puffs'] = [];
  for (let i = 0; i < puffCount; i++) {
    const angle = (Math.PI * 2 * i) / puffCount + (Math.random() - 0.5) * 0.4;
    puffs.push({
      angle,
      dist: (kind === 'primary' ? 38 : 22) + Math.random() * 26,
      r: (kind === 'primary' ? 14 : 10) + Math.random() * 8,
      delay: Math.random() * 0.06,
    });
  }

  return {
    kind,
    x: point.x,
    y: point.y,
    start: now,
    duration: kind === 'primary' ? 560 : kind === 'star' ? 480 : 380,
    sfx: opts?.sfx,
    seed,
    palette,
    sparks,
    puffs,
  };
}

export function attachSakugaCanvas(el: HTMLCanvasElement | null): void {
  canvasEl = el;
  if (el) resizeCanvas();
}

export function resizeCanvas(): void {
  if (!canvasEl || typeof window === 'undefined') return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvasEl.width !== Math.round(w * dpr) || canvasEl.height !== Math.round(h * dpr)) {
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    canvasEl.style.width = `${w}px`;
    canvasEl.style.height = `${h}px`;
  }
}

export function triggerSakuga(
  target: Element | SakugaPoint | null,
  kind: SakugaKind = 'primary',
  sfx?: string
): void {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  let pt: SakugaPoint;
  let dark = false;

  if (target && 'getBoundingClientRect' in target) {
    const rect = target.getBoundingClientRect();
    pt = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    dark = Boolean(target.closest('.dark-page, .admin-login-screen'));
  } else if (target) {
    pt = target;
  } else {
    pt = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  const effect = createBurstEffect(pt, kind, { sfx, dark });
  activeEffects.push(effect);
  if (activeEffects.length > 14) activeEffects.shift();

  if (rafId === null) {
    rafId = window.requestAnimationFrame(tick);
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function drawStar4(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.34;
    const a = (i * Math.PI) / 4;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEffect(ctx: CanvasRenderingContext2D, e: BurstEffect, t: number): void {
  const ease = easeOutCubic(t);
  const fade = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);

  ctx.save();
  ctx.globalAlpha = fade;

  // 1. Impact ring / shockwave for primary bursts
  if (e.kind === 'primary' && t < 0.55) {
    const ringT = t / 0.55;
    const rx = 20 + easeOutCubic(ringT) * 58;
    const ry = 14 + easeOutCubic(ringT) * 42;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = e.palette.accent;
    ctx.lineWidth = Math.max(1, (1 - ringT) * 5);
    ctx.stroke();
  }

  // 2. Drawn cel smoke puffs with ink outline
  for (const p of e.puffs) {
    const pt = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
    if (pt <= 0) continue;
    const dist = easeOutCubic(pt) * p.dist;
    const cx = e.x + Math.cos(p.angle) * dist;
    const cy = e.y + Math.sin(p.angle) * dist;
    const r = p.r * (pt < 0.35 ? 0.4 + (pt / 0.35) * 0.8 : Math.max(0.1, 1.2 - (pt - 0.35) * 1.4));

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = e.palette.smoke;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = e.palette.ink;
    ctx.stroke();

    // Inner cel crescent
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy + r * 0.18, r * 0.55, 0.2, Math.PI * 1.1);
    ctx.strokeStyle = e.palette.accent;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // 3. Radiating anime spikes, speed lines, cel shards, 4-point stars
  for (const s of e.sparks) {
    const d = ease * s.dist;
    const sx = e.x + Math.cos(s.angle) * d;
    const sy = e.y + Math.sin(s.angle) * d;
    const scale = 1 - t * 0.55;

    ctx.fillStyle = s.color;
    ctx.strokeStyle = e.palette.ink;
    ctx.lineWidth = 2;

    if (s.shape === 'line') {
      const innerD = d * 0.52;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(s.angle) * innerD, e.y + Math.sin(s.angle) * innerD);
      ctx.lineTo(
        e.x + Math.cos(s.angle) * (d + s.len * scale),
        e.y + Math.sin(s.angle) * (d + s.len * scale)
      );
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1.5, 3.5 * scale);
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (s.shape === 'star') {
      drawStar4(ctx, sx, sy, s.size * scale, s.angle + t * 2);
    } else if (s.shape === 'shard') {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.angle + t * 3);
      const sz = s.size * scale;
      ctx.beginPath();
      ctx.moveTo(sz, 0);
      ctx.lineTo(-sz * 0.6, sz * 0.65);
      ctx.lineTo(-sz * 0.4, -sz * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // Cel impact spike wedge pointing outward
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(s.angle);
      const tip = d + s.len * 0.55 * scale;
      const base = Math.max(10, d * 0.45);
      const halfW = s.size * 0.42 * scale;
      ctx.beginPath();
      ctx.moveTo(base, -halfW);
      ctx.lineTo(tip, 0);
      ctx.lineTo(base, halfW);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Manga SFX lettering ("DON!", "KADAK!", "READY!", "WAH!")
  if (e.sfx) {
    const popScale =
      t < 0.18
        ? 0.4 + (t / 0.18) * 0.85
        : t < 0.35
        ? 1.25 - ((t - 0.18) / 0.17) * 0.25
        : 1;
    const rise = ease * 34;
    const tilt = ((e.seed % 16) - 8) * (Math.PI / 180) - 0.1;

    ctx.save();
    ctx.translate(e.x, e.y - 24 - rise);
    ctx.rotate(tilt);
    ctx.scale(popScale, popScale);
    ctx.font = 'italic 900 26px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Thick white manga sticker halo
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(e.sfx, 0, 0);

    // Offset cel drop shadow
    ctx.fillStyle = '#FFB81C';
    ctx.fillText(e.sfx, 2.5, 2.5);

    // Deep indigo ink fill
    ctx.fillStyle = '#1B1A4A';
    ctx.fillText(e.sfx, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function tick(now: number): void {
  if (!canvasEl) {
    rafId = null;
    return;
  }
  resizeCanvas();
  const ctx = canvasEl.getContext('2d');
  if (!ctx) {
    rafId = null;
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const ef = activeEffects[i];
    const t = (now - ef.start) / ef.duration;
    if (t >= 1) {
      activeEffects.splice(i, 1);
      continue;
    }
    drawEffect(ctx, ef, Math.max(0, t));
  }

  if (activeEffects.length > 0) {
    rafId = window.requestAnimationFrame(tick);
  } else {
    rafId = null;
  }
}

// Helper for automatic SFX label based on button text
export function inferSfxFromLabel(label: string): string | undefined {
  const s = label.toLowerCase();
  if (s.includes('order bhejo') || s.includes('send to kitchen')) return 'BHEJA!';
  if (s.includes('banana shuru')) return 'SHURU!';
  if (s.includes('ready')) return 'READY!';
  if (s.includes('served')) return 'SERVED!';
  if (s.includes('pay ₹') || s.includes('collect')) return 'PAID!';
  if (s.includes('waiter ko bulao')) return 'TING!';
  if (s.includes('aa raha')) return 'AAYA!';
  if (s.includes('save karo')) return 'SAVED!';
  if (s.includes('restock') || s === 'full') return 'FULL!';
  if (s.includes('review bhejo')) return 'WAH!';
  if (s.includes('whatsapp')) return 'DING!';
  if (s.includes('login')) return 'DON!';
  return undefined;
}
