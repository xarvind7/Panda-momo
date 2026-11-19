import { useMemo } from 'react';
import QRCode from 'qrcode';

interface FoodQrProps {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}

function isFinderCell(row: number, col: number, count: number): boolean {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= count - 7;
  const inBottomLeft = row >= count - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

/**
 * Generates a food-themed, high-contrast, camera-scannable QR matrix (ECC Level H)
 * styled in roasted espresso cocoa & tandoor saffron parchment with a center momo emblem.
 */
export function FoodQr({ value, size = 220, className = '', label = 'Food Menu QR Code' }: FoodQrProps) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(value || '#/m', { errorCorrectionLevel: 'H' });
      return qr.modules;
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div className={`food-qr-fallback ${className}`} style={{ width: size, height: size }}>
        QR taiyaar ho raha hai…
      </div>
    );
  }

  const count = matrix.size;
  const margin = 3;
  const total = count + margin * 2;
  const centerIdx = total / 2;
  const badgeRadiusModules = count * 0.145; // ~16% safe center zone for ECC-H

  const cells: Array<{ r: number; c: number; spice: boolean }> = [];
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (isFinderCell(r, c, count)) continue;
      if (!matrix.get(r, c)) continue;

      const cx = margin + c + 0.5;
      const cy = margin + r + 0.5;
      const dist = Math.hypot(cx - centerIdx, cy - centerIdx);
      if (dist < badgeRadiusModules + 0.75) continue;

      // Subtle roasted spice accent on a small deterministic fraction of modules
      const spice = (r * 7 + c * 13) % 11 === 0;
      cells.push({ r, c, spice });
    }
  }

  const finders = [
    { x: margin, y: margin },
    { x: margin + count - 7, y: margin },
    { x: margin, y: margin + count - 7 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label}
      className={`food-qr-svg ${className}`}
    >
      {/* Warm Parchment Cream Base */}
      <rect x={0} y={0} width={total} height={total} rx={2.2} fill="#FFFBF2" />

      {/* Subtle Menu Card Inner Border */}
      <rect
        x={0.65}
        y={0.65}
        width={total - 1.3}
        height={total - 1.3}
        rx={1.8}
        fill="none"
        stroke="rgba(180, 83, 9, 0.22)"
        strokeWidth={0.28}
        strokeDasharray="0.9 0.7"
      />

      {/* Organic Rounded Food Modules (Espresso Cocoa + Roasted Spice) */}
      {cells.map((cell) => (
        <rect
          key={`${cell.r}-${cell.c}`}
          x={margin + cell.c + 0.08}
          y={margin + cell.r + 0.08}
          width={0.84}
          height={0.84}
          rx={0.28}
          fill={cell.spice ? '#7C2D12' : '#23140D'}
        />
      ))}

      {/* 3 Saffron & Espresso Corner Finder Eyes */}
      {finders.map((f, idx) => (
        <g key={idx}>
          <rect x={f.x} y={f.y} width={7} height={7} rx={1.7} fill="#B45309" />
          <rect x={f.x + 1} y={f.y + 1} width={5} height={5} rx={1.1} fill="#FFFBF2" />
          <rect x={f.x + 2} y={f.y + 2} width={3} height={3} rx={0.8} fill="#23140D" />
        </g>
      ))}

      {/* Center Steaming Momo Medallion (Safe within ECC-H limits) */}
      <g transform={`translate(${centerIdx}, ${centerIdx})`}>
        <circle r={badgeRadiusModules + 0.45} fill="#FFFBF2" />
        <circle
          className="food-qr-medallion-halo"
          r={badgeRadiusModules + 0.15}
          fill="#FEF3C7"
          stroke="#D97706"
          strokeWidth={0.28}
        />
        {/* Scale icon relative to medallion radius */}
        <g transform={`scale(${(badgeRadiusModules * 0.88) / 12})`}>
          {/* Animated Rising Steam Wisps */}
          <path
            className="food-qr-steam food-qr-steam-1"
            d="M-4,-8 C-4.8,-9.6 -3.2,-10.8 -4,-12"
            fill="none"
            stroke="#B45309"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path
            className="food-qr-steam food-qr-steam-2"
            d="M0,-9 C-0.8,-10.6 0.8,-11.8 0,-13.2"
            fill="none"
            stroke="#D97706"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path
            className="food-qr-steam food-qr-steam-3"
            d="M4,-8 C3.2,-9.6 4.8,-10.8 4,-12"
            fill="none"
            stroke="#B45309"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          {/* Hand-pleated Momo */}
          <path
            d="M-7.5,2.5 C-7.5,-2.5 -3.6,-5.8 0,-5.8 C3.6,-5.8 7.5,-2.5 7.5,2.5 C7.5,5.2 4.4,6.4 0,6.4 C-4.4,6.4 -7.5,5.2 -7.5,2.5 Z"
            fill="#FFFDF7"
            stroke="#23140D"
            strokeWidth="1.35"
          />
          {/* Momo Pleats */}
          <path
            d="M0,-5.4 L0,-1 M-3.2,-4.4 L-1.6,-0.8 M3.2,-4.4 L1.6,-0.8"
            fill="none"
            stroke="#D97706"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          {/* Bamboo Steamer Rim */}
          <path
            d="M-8.5,6.8 L8.5,6.8"
            stroke="#7C2D12"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * Renders a print-ready Food-Themed Menu QR Standee PNG (680x860) with
 * espresso/saffron styling, rounded food modules, and a center steaming momo badge.
 */
export async function renderFoodQrStandeePng(
  url: string,
  brand: string,
  subtitle = 'Scan for Menu & Table Order'
): Promise<string> {
  const qr = QRCode.create(url || '#/m', { errorCorrectionLevel: 'H' });
  const modules = qr.modules;
  const count = modules.size;
  const margin = 3;
  const total = count + margin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 860;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Warm Roasted Cocoa Menu Tent Background
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#2A160C');
  bg.addColorStop(0.55, '#3B1F11');
  bg.addColorStop(1, '#1B0E08');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle Golden Menu Border
  ctx.strokeStyle = 'rgba(245, 166, 35, 0.42)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(22, 22, canvas.width - 44, canvas.height - 44, 34);
  ctx.stroke();

  // Top Culinary Tag
  ctx.fillStyle = '#F59E0B';
  ctx.font = '700 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FRESH FROM THE STEAMER · DINE-IN MENU', canvas.width / 2, 74);

  // Brand Title
  ctx.fillStyle = '#FFFBF2';
  ctx.font = '800 42px sans-serif';
  ctx.fillText(brand, canvas.width / 2, 124);

  ctx.fillStyle = '#FDE68A';
  ctx.font = '600 20px sans-serif';
  ctx.fillText(subtitle, canvas.width / 2, 158);

  // Warm Parchment Plate Card
  const cardSize = 480;
  const cardX = (canvas.width - cardSize) / 2;
  const cardY = 194;
  ctx.fillStyle = '#FFFBF2';
  fillRoundRect(ctx, cardX, cardY, cardSize, cardSize, 32);

  // Dotted Gold Rim on Plate Card
  ctx.save();
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.roundRect(cardX + 12, cardY + 12, cardSize - 24, cardSize - 24, 24);
  ctx.stroke();
  ctx.restore();

  // Draw Food-Styled QR Modules
  const modSize = cardSize / total;
  const centerIdx = total / 2;
  const badgeRadiusModules = count * 0.145;

  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (isFinderCell(r, c, count)) continue;
      if (!modules.get(r, c)) continue;

      const cx = margin + c + 0.5;
      const cy = margin + r + 0.5;
      if (Math.hypot(cx - centerIdx, cy - centerIdx) < badgeRadiusModules + 0.75) continue;

      const spice = (r * 7 + c * 13) % 11 === 0;
      ctx.fillStyle = spice ? '#7C2D12' : '#23140D';
      fillRoundRect(
        ctx,
        cardX + (margin + c + 0.08) * modSize,
        cardY + (margin + r + 0.08) * modSize,
        0.84 * modSize,
        0.84 * modSize,
        0.28 * modSize
      );
    }
  }

  // Draw 3 Saffron + Espresso Finder Eyes
  const finders = [
    { x: margin, y: margin },
    { x: margin + count - 7, y: margin },
    { x: margin, y: margin + count - 7 },
  ];
  for (const f of finders) {
    ctx.fillStyle = '#B45309';
    fillRoundRect(ctx, cardX + f.x * modSize, cardY + f.y * modSize, 7 * modSize, 7 * modSize, 1.7 * modSize);
    ctx.fillStyle = '#FFFBF2';
    fillRoundRect(ctx, cardX + (f.x + 1) * modSize, cardY + (f.y + 1) * modSize, 5 * modSize, 5 * modSize, 1.1 * modSize);
    ctx.fillStyle = '#23140D';
    fillRoundRect(ctx, cardX + (f.x + 2) * modSize, cardY + (f.y + 2) * modSize, 3 * modSize, 3 * modSize, 0.8 * modSize);
  }

  // Center Momo Medallion
  const centerX = cardX + cardSize / 2;
  const centerY = cardY + cardSize / 2;
  const medR = badgeRadiusModules * modSize;
  ctx.fillStyle = '#FFFBF2';
  ctx.beginPath();
  ctx.arc(centerX, centerY, medR + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FEF3C7';
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, medR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Momo Icon inside Medallion
  const s = (medR * 0.88) / 12;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(s, s);
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(-4, -11.5);
  ctx.moveTo(0, -9);
  ctx.lineTo(0, -12.8);
  ctx.moveTo(4, -8);
  ctx.lineTo(4, -11.5);
  ctx.stroke();

  ctx.fillStyle = '#FFFDF7';
  ctx.strokeStyle = '#23140D';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-7.5, 2.5);
  ctx.bezierCurveTo(-7.5, -2.5, -3.6, -5.8, 0, -5.8);
  ctx.bezierCurveTo(3.6, -5.8, 7.5, -2.5, 7.5, 2.5);
  ctx.bezierCurveTo(7.5, 5.2, 4.4, 6.4, 0, 6.4);
  ctx.bezierCurveTo(-4.4, 6.4, -7.5, 5.2, -7.5, 2.5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, -5.4);
  ctx.lineTo(0, -1);
  ctx.moveTo(-3.2, -4.4);
  ctx.lineTo(-1.6, -0.8);
  ctx.moveTo(3.2, -4.4);
  ctx.lineTo(1.6, -0.8);
  ctx.stroke();

  ctx.strokeStyle = '#7C2D12';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8.5, 6.8);
  ctx.lineTo(8.5, 6.8);
  ctx.stroke();
  ctx.restore();

  // Bottom Culinary Strip
  ctx.fillStyle = '#F59E0B';
  ctx.font = '700 21px sans-serif';
  ctx.fillText('Steamed Momos  ·  Kulhad Chai  ·  Crispy Snacks', canvas.width / 2, 742);

  ctx.fillStyle = '#E7D8C9';
  ctx.font = '500 18px sans-serif';
  ctx.fillText('Scan with Phone Camera · Pick Table & Order Live', canvas.width / 2, 782);

  return canvas.toDataURL('image/png');
}
