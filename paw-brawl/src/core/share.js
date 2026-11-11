import { getLang, t } from './i18n.js';
import { getPortrait } from '../ui/portraits.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function paw(ctx, x, y, scale, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + 18 * scale, 42 * scale, 34 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-42, -24], [-14, -48], [18, -48], [46, -20]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * scale, y + dy * scale, 15 * scale, 20 * scale, dx * 0.008, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function makeCard({ rank, coins, kos, character, modeName }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const background = ctx.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, '#8FD3FF');
  background.addColorStop(0.52, '#DFF4FF');
  background.addColorStop(1, '#FFE9C7');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1350);
  paw(ctx, 110, 180, 1.5, 'rgba(255,255,255,.24)');
  paw(ctx, 930, 1010, 2.2, 'rgba(255,122,89,.10)');
  for (let index = 0; index < 36; index++) {
    ctx.save();
    ctx.translate((index * 193) % 1080, 90 + (index * 137) % 1100);
    ctx.rotate(index * 0.7);
    ctx.fillStyle = ['#FF7A59', '#FFD166', '#7EE0C0', '#B99CFF'][index % 4];
    ctx.fillRect(-6, -16, 12, 32);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.font = '900 118px Arial, sans-serif';
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#2B2440';
  ctx.strokeText('PAW BRAWL', 540, 190);
  ctx.fillStyle = '#FF7A59';
  ctx.fillText('PAW BRAWL', 540, 190);
  ctx.font = '900 34px Arial, sans-serif';
  ctx.fillStyle = '#6B5B95';
  ctx.fillText(modeName, 540, 250);

  ctx.fillStyle = 'rgba(255,248,233,.94)';
  ctx.strokeStyle = '#2B2440';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(120, 310, 840, 670, 70);
  ctx.fill();
  ctx.stroke();
  const portrait = await loadImage(getPortrait(character));
  ctx.drawImage(portrait, 260, 330, 560, 560);
  ctx.font = '900 54px Arial, sans-serif';
  ctx.fillStyle = '#2B2440';
  ctx.fillText(character.name[getLang()], 540, 935);

  const zh = getLang() === 'zh';
  const stats = [
    [zh ? '名次' : 'RANK', `#${rank}`],
    [zh ? '金币' : 'COINS', `+${coins}`],
    ['KO', String(kos)],
  ];
  stats.forEach(([label, value], index) => {
    const x = 220 + index * 320;
    ctx.fillStyle = index === 1 ? '#FFD166' : '#FFFFFF';
    ctx.strokeStyle = '#2B2440';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(x - 130, 1030, 260, 170, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6B5B95';
    ctx.font = '900 30px Arial, sans-serif';
    ctx.fillText(label, x, 1080);
    ctx.fillStyle = '#2B2440';
    ctx.font = '900 58px Arial, sans-serif';
    ctx.fillText(value, x, 1155);
  });
  ctx.fillStyle = '#6B5B95';
  ctx.font = '900 34px Arial, sans-serif';
  ctx.fillText('pipygames.com', 540, 1280);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Card export failed')), 'image/png'));
}

export async function shareResult({ rank, coins, kos, character, mode, modeName }) {
  const blob = await makeCard({ rank, coins, kos, character, modeName });
  const file = new File([blob], `paw-brawl-rank-${rank}.png`, { type: 'image/png' });
  const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let method = 'download';
  if (mobile && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'PAW BRAWL' });
      method = 'share';
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, aborted: true };
    }
  }
  if (method === 'download') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.G?.SDK?.track?.('share', { mode, rank, coins });
  return { ok: true, method };
}
